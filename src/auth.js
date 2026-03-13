import {
  AUTH_INTENT_KEY,
  CANONICAL_APP_URL,
  LOCAL_DEV_MODE,
  SUPABASE_ANON_KEY,
  SUPABASE_URL
} from "./constants.js";
import {
  authEmailInput,
  authRow,
  authSignOutButton,
  authStatus,
  marketingPage,
  syncStatus
} from "./dom.js";
import {
  defaultState,
  normalizeImportedState,
  persistStateSnapshot,
  requestRender,
  saveAndRender,
  setState,
  state
} from "./state.js";
import { startOfMonth } from "./utils.js";
import { getMagicLinkRedirectTargets } from "./auth-redirect.mjs";
import { areStatesEqual, mergeDiaryStates, pickLatestCloudRow } from "./sync-core.mjs";
import {
  closeDeleteModal,
  closePopover,
  closeSettingsModal,
  enterApp,
  getHasEnteredApp,
  showMarketingPage,
  resetToLoggedOut
} from "./ui.js";
import { showToast } from "./toast.js";

const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
let syncUser = null;
let syncTimer = null;
let syncPollTimer = null;
let lastSyncedAt = null;
let syncInFlight = null;
let syncInProgress = false;
let signOutInProgress = false;
let authInitStarted = false;
let lastSyncError = "";
const SYNC_DEBOUNCE_MS = 250;
const SYNC_POLL_MS = 5000;

// initSupabaseAuth: Initializes Supabase auth, restores sessions, and wires auth listeners.
export async function initSupabaseAuth() {
  if (LOCAL_DEV_MODE) {
    updateAuthUI();
    return;
  }
  if (authInitStarted) return;
  authInitStarted = true;
  if (!supabase) return;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const hadMagicLinkTokens = Boolean(accessToken && refreshToken);
  const shouldFocusTodayOnEntry =
    hadMagicLinkTokens ||
    (() => {
      try {
        return sessionStorage.getItem(AUTH_INTENT_KEY) === "1";
      } catch {
        return false;
      }
    })();
  if (accessToken && refreshToken) {
    try {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
    } catch {
      // ignore session errors and continue
    } finally {
      try {
        sessionStorage.removeItem(AUTH_INTENT_KEY);
      } catch {
        // ignore
      }
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }
  const { data } = await supabase.auth.getSession();
  syncUser = data?.session?.user || null;
  updateAuthUI();
  if (syncUser) {
    await loadFromCloud({ fromAuthBootstrap: true });
    const enteredFromMarketing = !getHasEnteredApp() && !marketingPage?.classList.contains("hidden");
    if (enteredFromMarketing) {
      enterApp();
    }
    if (shouldFocusTodayOnEntry) {
      focusPeriodToToday();
      clearAuthIntent();
    }
    startSyncPolling();
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    const wasSignedIn = Boolean(syncUser);
    syncUser = session?.user || null;
    updateAuthUI();
    if (syncUser) {
      await loadFromCloud({ fromAuthBootstrap: !wasSignedIn });
      const enteredFromMarketingNow = !getHasEnteredApp() && !marketingPage?.classList.contains("hidden");
      if (enteredFromMarketingNow) {
        enterApp();
      }
      if (!wasSignedIn && shouldFocusTodayOnEntry) {
        focusPeriodToToday();
        clearAuthIntent();
      }
      startSyncPolling();
    } else {
      lastSyncError = "";
      stopSyncPolling();
      setState(structuredClone(defaultState));
      requestRender();
      showMarketingPage();
      resetToLoggedOut();
    }
  });
  document.addEventListener("visibilitychange", handleVisibilitySync);
}

// refreshAuthSession: Re-reads Supabase session and updates local auth UI/state.
export async function refreshAuthSession({ loadCloud = false } = {}) {
  if (LOCAL_DEV_MODE) {
    updateAuthUI();
    return null;
  }
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  syncUser = data?.session?.user || null;
  updateAuthUI();
  if (syncUser) {
    if (loadCloud) await loadFromCloud({ silentError: true });
    startSyncPolling();
  } else {
    stopSyncPolling();
  }
  return syncUser;
}

function focusPeriodToToday() {
  const todayMonth = startOfMonth(new Date());
  state.monthCursor = todayMonth.toISOString();
  state.yearCursor = todayMonth.getFullYear();
  requestRender();
}

function clearAuthIntent() {
  try {
    sessionStorage.removeItem(AUTH_INTENT_KEY);
  } catch {
    // ignore
  }
}

// handleMagicLink: Requests a magic-link email sign-in and updates button feedback states.
export async function handleMagicLink(overrideEmail, sourceButton) {
  if (LOCAL_DEV_MODE) {
    showToast("Local dev mode active. Magic link auth is disabled.");
    return;
  }
  if (!supabase) return;
  const email = overrideEmail?.trim() || authEmailInput?.value?.trim();
  if (!email) {
    showToast("Enter an email first.");
    return;
  }
  if (sourceButton) {
    if (!sourceButton.dataset.defaultLabel) {
      sourceButton.dataset.defaultLabel = sourceButton.textContent || "";
    }
    sourceButton.disabled = true;
    sourceButton.textContent = "Sending...";
  }
  try {
    sessionStorage.setItem(AUTH_INTENT_KEY, "1");
  } catch {
    // ignore
  }
  let error = null;
  let successfulTarget = undefined;
  const redirectTargets = getMagicLinkRedirectTargets(window.location);
  for (const target of redirectTargets) {
    const attempt = target
      ? await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: target
          }
        })
      : await supabase.auth.signInWithOtp({ email });
    if (!attempt.error) {
      error = null;
      successfulTarget = target;
      break;
    }
    error = attempt.error;
  }

  if (error) {
    const message = error?.message ? `Magic link failed: ${error.message}` : "Could not send magic link.";
    showToast(message);
    console.error("Magic link error:", error);
    if (sourceButton) {
      sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send magic link";
      sourceButton.disabled = false;
    }
  } else {
    const usedCanonicalRedirect = typeof successfulTarget === "string" && successfulTarget.startsWith(CANONICAL_APP_URL);
    const usedDefaultRedirect = successfulTarget == null;
    showToast(
      usedCanonicalRedirect
        ? "Magic link sent. Check your email. It will open on the main app URL."
        : usedDefaultRedirect
          ? "Magic link sent. Check your email. (Using default redirect.)"
          : "Magic link sent. Check your email."
    );
    if (sourceButton) {
      sourceButton.textContent = "Check your email";
      sourceButton.disabled = false;
      window.setTimeout(() => {
        sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send magic link";
      }, 2000);
    }
  }
}

// signOutSupabase: Signs the current user out and resets local app state to logged-out defaults.
export async function signOutSupabase() {
  if (LOCAL_DEV_MODE) {
    showToast("Local dev mode active. Sign out is disabled.");
    return;
  }
  if (signOutInProgress) return;
  signOutInProgress = true;
  if (authSignOutButton) authSignOutButton.disabled = true;
  if (syncStatus) syncStatus.textContent = "Signing out...";
  try {
    if (supabase) {
      // Local scope avoids network dependency and signs out this device reliably.
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (error) {
    console.warn("Supabase sign out failed, continuing local sign out:", error);
  } finally {
    try {
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
      stopSyncPolling();
      syncInFlight = null;
      syncInProgress = false;
      syncUser = null;
      lastSyncedAt = null;
      lastSyncError = "";
      setState(structuredClone(defaultState));
      closePopover();
      closeSettingsModal();
      closeDeleteModal();
      resetToLoggedOut();
      requestRender();
      updateAuthUI();
      showToast("Signed out.");
    } finally {
      signOutInProgress = false;
      if (authSignOutButton) authSignOutButton.disabled = false;
      if (syncStatus) syncStatus.textContent = "";
    }
  }
}

// updateAuthUI: Updates auth-related labels, buttons, and sync status text.
export function updateAuthUI() {
  if (!authStatus || !authSignOutButton) return;
  if (LOCAL_DEV_MODE) {
    authStatus.textContent = "Local dev mode: no login required, cloud sync disabled.";
    authStatus.classList.add("muted");
    authSignOutButton.classList.add("hidden");
    if (authRow) authRow.classList.add("hidden");
    if (syncStatus) {
      syncStatus.textContent = "";
      syncStatus.classList.add("muted");
    }
    return;
  }
  if (!supabase) {
    authStatus.textContent = "Supabase client not available.";
    authStatus.classList.add("muted");
    if (authRow) authRow.classList.remove("hidden");
    if (syncStatus) syncStatus.textContent = "";
    return;
  }
  if (syncUser) {
    authStatus.textContent = `Signed in as ${syncUser.email || "user"}.`;
    authStatus.classList.remove("muted");
    authSignOutButton.classList.remove("hidden");
    if (authRow) authRow.classList.add("hidden");
    if (syncStatus) {
      syncStatus.textContent = formatSyncStatus();
      syncStatus.classList.toggle("muted", !lastSyncError);
    }
  } else {
    authStatus.textContent = "Sign in to access your diary.";
    authStatus.classList.add("muted");
    authSignOutButton.classList.add("hidden");
    if (authRow) authRow.classList.remove("hidden");
    if (syncStatus) {
      syncStatus.textContent = "";
      syncStatus.classList.add("muted");
    }
  }
}

// scheduleSync: Handles schedule sync.
export function scheduleSync() {
  if (LOCAL_DEV_MODE) return false;
  if (!supabase || !syncUser) return false;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncToCloud();
  }, SYNC_DEBOUNCE_MS);
  return true;
}

async function loadFromCloud({ silentError = false, fromAuthBootstrap = false } = {}) {
  if (!supabase || !syncUser) return;
  let { data, error } = await supabase
    .from("user_data")
    .select("data, updated_at")
    .eq("user_id", syncUser.id)
    .order("updated_at", { ascending: false })
    .limit(25);
  if (error) {
    // Fallback for schemas that do not expose `updated_at`.
    const fallback = await supabase.from("user_data").select("data").eq("user_id", syncUser.id).limit(200);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    lastSyncError = error.message || "Cloud read failed.";
    if (!silentError) showToast(`Cloud sync failed: ${lastSyncError}`);
    updateAuthUI();
    return;
  }
  const latest = pickLatestCloudRow(data);
  if (!latest?.data) {
    // Initialize cloud row once if this account has no cloud data yet.
    await syncToCloud(state);
    if (!fromAuthBootstrap) showToast("Cloud data initialized.");
    return;
  }
  lastSyncError = "";
  const remoteState = normalizeImportedState(latest.data);
  const localState = normalizeImportedState(state);
  const localTimestamp = new Date(localState.lastModified || 0).getTime() || 0;
  const remoteTimestamp = new Date(remoteState.lastModified || 0).getTime() || 0;
  const preferLocalConflicts = localTimestamp >= remoteTimestamp;
  const mergedState = mergeDiaryStates(localState, remoteState, {
    preferLocalSettings: preferLocalConflicts,
    preferLocalConflicts,
    keepLocalCursor: true
  });

  if (!areStatesEqual(localState, mergedState)) {
    setState(mergedState);
    persistStateSnapshot(mergedState);
    requestRender();
  }
  if (!areStatesEqual(remoteState, mergedState)) {
    await syncToCloud(mergedState);
  }
  lastSyncedAt = new Date().toISOString();
  updateAuthUI();
}

async function syncToCloud(sourceState = state) {
  if (!supabase || !syncUser) return;
  if (syncInFlight) return syncInFlight;
  syncInProgress = true;
  updateAuthUI();
  const snapshot = getCloudStateSnapshot(sourceState);
  const updatedAt = snapshot.lastModified || new Date().toISOString();
  const payloadWithUpdatedAt = {
    user_id: syncUser.id,
    data: snapshot,
    updated_at: updatedAt
  };
  const payloadWithoutUpdatedAt = {
    user_id: syncUser.id,
    data: snapshot
  };
  syncInFlight = (async () => {
    let writeError = null;
    let result = await supabase.from("user_data").upsert(payloadWithUpdatedAt, { onConflict: "user_id" });
    writeError = result.error;

    if (writeError) {
      result = await supabase.from("user_data").upsert(payloadWithoutUpdatedAt, { onConflict: "user_id" });
      writeError = result.error;
    }
    if (writeError) {
      // Legacy fallback: update all rows for this user; insert if none exist.
      result = await supabase.from("user_data").update({ data: snapshot, updated_at: updatedAt }).eq("user_id", syncUser.id);
      writeError = result.error;
    }
    if (writeError) {
      result = await supabase.from("user_data").update({ data: snapshot }).eq("user_id", syncUser.id);
      writeError = result.error;
    }
    if (!writeError) {
      const existingRows = await supabase.from("user_data").select("user_id").eq("user_id", syncUser.id).limit(1);
      if (existingRows.error) {
        writeError = existingRows.error;
      } else if (!Array.isArray(existingRows.data) || existingRows.data.length === 0) {
        result = await supabase.from("user_data").insert(payloadWithUpdatedAt);
        writeError = result.error;
        if (writeError) {
          result = await supabase.from("user_data").insert(payloadWithoutUpdatedAt);
          writeError = result.error;
        }
      }
    }

    if (writeError) {
      lastSyncError = writeError.message || "Cloud write failed.";
      showToast(`Could not sync to cloud: ${lastSyncError}`);
    } else {
      lastSyncError = "";
      lastSyncedAt = new Date().toISOString();
    }
  })();
  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
    syncInProgress = false;
    updateAuthUI();
  }
}

function startSyncPolling() {
  if (syncPollTimer || !syncUser) return;
  syncPollTimer = window.setInterval(() => {
    if (!document.hidden) {
      loadFromCloud({ silentError: true });
    }
  }, SYNC_POLL_MS);
}

function stopSyncPolling() {
  if (!syncPollTimer) return;
  window.clearInterval(syncPollTimer);
  syncPollTimer = null;
}

function handleVisibilitySync() {
  if (document.hidden || !supabase) return;
  if (!syncUser) {
    refreshAuthSession({ loadCloud: true });
    return;
  }
  loadFromCloud({ silentError: true });
}

function formatSyncStatus() {
  if (lastSyncError) return `Sync error: ${lastSyncError}`;
  return lastSyncedAt ? `Saved to cloud ${formatSyncTime(lastSyncedAt)}.` : "Signed in. Saving changes to cloud.";
}
function formatSyncTime(iso) {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "just now";
  }
}

function getCloudStateSnapshot(sourceState) {
  return structuredClone(sourceState);
}
