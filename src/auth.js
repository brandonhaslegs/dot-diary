import {
  AUTH_INTENT_KEY,
  AUTH_STATE_KEY,
  BUTTON_RESET_DELAY_MS,
  ONBOARDING_KEY,
  STORAGE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  SYNC_DEBOUNCE_MS,
  SYNC_POLL_MS
} from "./constants.js";
import {
  authEmailInput,
  authRow,
  authSignOutButton,
  authStatus,
  loginOtpRow,
  settingsOtpRow,
  onboardingOtpRow,
  marketingPage,
  syncStatus
} from "./dom.js";
import {
  defaultState,
  normalizeImportedState,
  requestRender,
  setState,
  state
} from "./state.js";
import { startOfMonth } from "./utils.js";
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
let pendingOtpEmail = "";

export async function initSupabaseAuth() {
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
  if (!syncUser) {
    // Prevent stale auth bootstrap state from implying cloud sync is active.
    try {
      localStorage.removeItem(AUTH_STATE_KEY);
    } catch {
      // ignore
    }
  }
  const enteredFromMarketing = !getHasEnteredApp() && syncUser && !marketingPage?.classList.contains("hidden");
  if (enteredFromMarketing) {
    enterApp({ skipOnboarding: true });
  }
  updateAuthUI();
  if (syncUser) {
    await loadFromCloud({ fromAuthBootstrap: true });
    if (shouldFocusTodayOnEntry) {
      focusPeriodToToday();
      clearAuthIntent();
    }
    startSyncPolling();
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    const wasSignedIn = Boolean(syncUser);
    syncUser = session?.user || null;
    const enteredFromMarketingNow = !getHasEnteredApp() && syncUser && !marketingPage?.classList.contains("hidden");
    if (enteredFromMarketingNow) {
      enterApp({ skipOnboarding: true });
    }
    try {
      if (syncUser) {
        localStorage.setItem(AUTH_STATE_KEY, "1");
      } else {
        localStorage.removeItem(AUTH_STATE_KEY);
      }
    } catch {
      // ignore
    }
    updateAuthUI();
    if (syncUser) {
      await loadFromCloud({ fromAuthBootstrap: !wasSignedIn });
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

export async function refreshAuthSession({ loadCloud = false } = {}) {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  syncUser = data?.session?.user || null;
  try {
    if (syncUser) {
      localStorage.setItem(AUTH_STATE_KEY, "1");
    } else {
      localStorage.removeItem(AUTH_STATE_KEY);
    }
  } catch {
    // ignore
  }
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

export async function handleMagicLink(overrideEmail, sourceButton) {
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
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getMagicLinkRedirectTo()
    }
  });
  if (error) {
    const message = error?.message ? `Magic link failed: ${error.message}` : "Could not send magic link.";
    showToast(message);
    console.error("Magic link error:", error);
    if (sourceButton) {
      sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send magic link";
      sourceButton.disabled = false;
    }
  } else {
    pendingOtpEmail = email;
    showToast("Magic link sent. Check your email.");
    showOtpRows();
    if (sourceButton) {
      sourceButton.textContent = "Check your email";
      sourceButton.disabled = false;
      window.setTimeout(() => {
        sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send magic link";
      }, BUTTON_RESET_DELAY_MS);
    }
  }
}

function showOtpRows() {
  loginOtpRow?.classList.remove("hidden");
  settingsOtpRow?.classList.remove("hidden");
  onboardingOtpRow?.classList.remove("hidden");
}

function hideOtpRows() {
  loginOtpRow?.classList.add("hidden");
  settingsOtpRow?.classList.add("hidden");
  onboardingOtpRow?.classList.add("hidden");
  pendingOtpEmail = "";
}

export async function verifyOtpCode(code, sourceButton) {
  if (!supabase) return;
  const token = code?.trim();
  if (!token) {
    showToast("Enter the code from your email.");
    return;
  }
  if (!pendingOtpEmail) {
    showToast("Send a magic link first.");
    return;
  }
  if (sourceButton) {
    if (!sourceButton.dataset.defaultLabel) {
      sourceButton.dataset.defaultLabel = sourceButton.textContent || "";
    }
    sourceButton.disabled = true;
    sourceButton.textContent = "Verifying...";
  }
  const { error } = await supabase.auth.verifyOtp({
    email: pendingOtpEmail,
    token,
    type: "email"
  });
  if (error) {
    showToast(error.message || "Invalid code. Try again.");
    if (sourceButton) {
      sourceButton.textContent = sourceButton.dataset.defaultLabel || "Verify";
      sourceButton.disabled = false;
    }
  } else {
    hideOtpRows();
    showToast("Signed in!");
    if (sourceButton) {
      sourceButton.textContent = sourceButton.dataset.defaultLabel || "Verify";
      sourceButton.disabled = false;
    }
  }
}

export async function signOutSupabase() {
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
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ONBOARDING_KEY);
        localStorage.removeItem(AUTH_STATE_KEY);
      } catch {
        // ignore
      }
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

export function updateAuthUI() {
  if (!authStatus || !authSignOutButton) return;
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
    authStatus.textContent = "Local-only mode on this device. Sign in to sync and back up.";
    authStatus.classList.add("muted");
    authSignOutButton.classList.add("hidden");
    if (authRow) authRow.classList.remove("hidden");
    if (syncStatus) {
      syncStatus.textContent = "";
      syncStatus.classList.add("muted");
    }
  }
}

export function scheduleSync() {
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
    await syncToCloud();
    if (!fromAuthBootstrap) showToast("Cloud data initialized.");
    return;
  }
  lastSyncError = "";
  const remoteState = normalizeImportedState(latest.data);
  const localDiffersFromRemote = !areStatesEqual(state, remoteState);
  if (localDiffersFromRemote) {
    const localMonthCursor = state.monthCursor;
    const localYearCursor = state.yearCursor;
    const merged = mergeDiaryStates(state, remoteState, {
      preferLocalSettings: true,
      preferLocalConflicts: false
    });
    merged.monthCursor = localMonthCursor;
    merged.yearCursor = localYearCursor;
    setState(merged);
    requestRender();
  }
  lastSyncedAt = new Date().toISOString();
  updateAuthUI();
}

async function syncToCloud() {
  if (!supabase || !syncUser) return;
  if (syncInFlight) return syncInFlight;
  syncInProgress = true;
  updateAuthUI();
  const snapshot = getCloudStateSnapshot(state);
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
  if (document.hidden || !syncUser) return;
  loadFromCloud({ silentError: true });
}

function getMagicLinkRedirectTo() {
  return `${window.location.origin}${window.location.pathname}`;
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
  const { monthCursor, yearCursor, ...data } = sourceState;
  return structuredClone(data);
}
