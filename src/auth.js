import {
  AUTH_INTENT_KEY,
  AUTH_STATE_KEY,
  BUTTON_RESET_DELAY_MS,
  DEMO_MODE,
  ONBOARDING_KEY,
  PRE_AUTH_BACKUP_KEY,
  STORAGE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  SYNC_DEBOUNCE_MS,
  SYNC_POLL_MS
} from "./constants.js?v=empty-sync-guard-20260817";
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
import { fetchBillingStatus, resetBilling } from "./billing.js";
import { offerPwaInstallAfterLogin } from "./pwa-install.js";

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

export async function initSupabaseAuth() {
  if (authInitStarted) return;
  authInitStarted = true;
  if (!supabase) return;
  const shouldFocusTodayOnEntry = (() => {
    try {
      return sessionStorage.getItem(AUTH_INTENT_KEY) === "1";
    } catch {
      return false;
    }
  })();
  const { data } = await supabase.auth.getSession();
  syncUser = data?.session?.user || null;
  persistAuthMarker(syncUser);
  const enteredFromMarketing = !getHasEnteredApp() && syncUser && !marketingPage?.classList.contains("hidden");
  if (enteredFromMarketing) {
    enterApp({ skipOnboarding: true });
  }
  updateAuthUI();
  if (syncUser) {
    preservePreAuthBackup();
    await loadFromCloud({ fromAuthBootstrap: true });
    fetchBillingStatus(await getAccessToken()).catch(() => {});
    if (shouldFocusTodayOnEntry) {
      focusPeriodToToday();
      clearAuthIntent();
    }
    if (shouldFocusTodayOnEntry) offerPwaInstallAfterLogin();
    startSyncPolling();
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    const wasSignedIn = Boolean(syncUser);
    syncUser = session?.user || null;
    const enteredFromMarketingNow = !getHasEnteredApp() && syncUser && !marketingPage?.classList.contains("hidden");
    if (enteredFromMarketingNow) {
      enterApp({ skipOnboarding: true });
    }
    persistAuthMarker(syncUser);
    updateAuthUI();
    if (syncUser) {
      if (!wasSignedIn) preservePreAuthBackup();
      await loadFromCloud({ fromAuthBootstrap: !wasSignedIn });
      fetchBillingStatus(await getAccessToken()).catch(() => {});
      if (!wasSignedIn && shouldFocusTodayOnEntry) {
        focusPeriodToToday();
        clearAuthIntent();
      }
      if (!wasSignedIn) offerPwaInstallAfterLogin();
      startSyncPolling();
    } else {
      if (DEMO_MODE) {
        lastSyncError = "";
        stopSyncPolling();
        resetBilling();
        updateAuthUI();
        return;
      }
      lastSyncError = "";
      stopSyncPolling();
      resetBilling();
      // An initial signed-out auth event is normal for a local-only diary.
      // Keep its in-memory state intact so a subsequent sign-in can back it up
      // instead of initializing the cloud from an empty snapshot.
      if (wasSignedIn) {
        showMarketingPage();
        resetToLoggedOut();
      }
      updateAuthUI();
    }
  });
  document.addEventListener("visibilitychange", handleVisibilitySync);
}

export async function refreshAuthSession({ loadCloud = false } = {}) {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  syncUser = data?.session?.user || null;
  persistAuthMarker(syncUser);
  updateAuthUI();
  if (syncUser) {
    preservePreAuthBackup();
    if (loadCloud) await loadFromCloud({ silentError: true });
    fetchBillingStatus(await getAccessToken()).catch(() => {});
    startSyncPolling();
  } else {
    stopSyncPolling();
  }
  return syncUser;
}

export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
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

export async function requestEmailCode(overrideEmail, sourceButton) {
  if (!supabase) return false;
  const email = overrideEmail?.trim() || authEmailInput?.value?.trim();
  if (!email) {
    showToast("Enter an email first.");
    return false;
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
    email
  });
  if (error) {
    const message = error?.message ? `Could not send code: ${error.message}` : "Could not send a sign-in code.";
    showToast(message);
    console.error("Email code error:", error);
    if (sourceButton) {
      sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send code";
      sourceButton.disabled = false;
    }
    return false;
  } else {
    showToast("Sign-in code sent. Check your email.");
    if (sourceButton) {
      sourceButton.textContent = "Code sent";
      sourceButton.disabled = false;
      window.setTimeout(() => {
        sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send code";
      }, BUTTON_RESET_DELAY_MS);
    }
    return true;
  }
}

export async function verifyEmailCode(overrideEmail, overrideCode, sourceButton) {
  if (!supabase) return false;
  const email = overrideEmail?.trim() || authEmailInput?.value?.trim();
  const token = String(overrideCode || "").replace(/\s/g, "");
  if (!email) {
    showToast("Enter your email first.");
    return false;
  }
  if (!token) {
    showToast("Enter the sign-in code from your email.");
    return false;
  }
  if (sourceButton) {
    sourceButton.disabled = true;
    sourceButton.textContent = "Signing in...";
  }
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
    showToast("Signed in.");
    return true;
  } catch (error) {
    showToast(error?.message || "That sign-in code did not work. Try requesting a new one.");
    return false;
  } finally {
    if (sourceButton) {
      sourceButton.disabled = false;
      sourceButton.textContent = sourceButton.dataset.defaultLabel || "Sign in";
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
    // Never create a cloud record from an empty device. A fresh install can
    // otherwise overwrite the only recoverable copy during sign-in.
    if (hasDiaryContent(state)) {
      await syncToCloud();
      if (!fromAuthBootstrap) showToast("Cloud backup created.");
    } else {
      lastSyncError = "";
      updateAuthUI();
    }
    return;
  }
  lastSyncError = "";
  const remoteState = normalizeImportedState(latest.data);
  const localDiffersFromRemote = !areStatesEqual(state, remoteState);
  if (localDiffersFromRemote) {
    const localMonthCursor = state.monthCursor;
    const localYearCursor = state.yearCursor;
    const merged = mergeDiaryStates(state, remoteState, {
      // A sign-out intentionally clears this device's local state. When the
      // account signs back in, do not let those fresh defaults overwrite
      // settings already saved with the account (such as keyboard hints).
      preferLocalSettings: !fromAuthBootstrap,
      preferLocalConflicts: false
    });
    merged.monthCursor = localMonthCursor;
    merged.yearCursor = localYearCursor;
    setState(merged);
    requestRender();
    if (hasDiaryContent(merged) && !areStatesEqual(merged, remoteState)) {
      scheduleSync();
    }
  }
  lastSyncedAt = new Date().toISOString();
  updateAuthUI();
}

async function syncToCloud() {
  if (!supabase || !syncUser) return;
  if (syncInFlight) return syncInFlight;
  const snapshot = getCloudStateSnapshot(state);
  // A blank device must never replace cloud history. This includes auth
  // bootstrap, a fresh install, and any other sync path.
  if (!hasDiaryContent(snapshot)) {
    lastSyncError = "";
    updateAuthUI();
    return;
  }
  syncInProgress = true;
  updateAuthUI();
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
  if (document.hidden) return;
  // An installed PWA can be suspended for long periods. Ask Supabase to restore
  // or refresh its persisted session before deciding that the user is signed out.
  refreshAuthSession({ loadCloud: true }).catch(() => {});
}

function persistAuthMarker(user) {
  try {
    if (user) {
      localStorage.setItem(AUTH_STATE_KEY, "1");
    } else {
      // Prevent stale auth bootstrap state from implying cloud sync is active.
      localStorage.removeItem(AUTH_STATE_KEY);
    }
  } catch {
    // Storage can be unavailable in private browsing or under device policy.
  }
}

function hasDiaryContent(sourceState) {
  if (!sourceState || typeof sourceState !== "object") return false;
  if (Array.isArray(sourceState.dotTypes) && sourceState.dotTypes.length > 0) return true;
  return [sourceState.dayDots, sourceState.dayNotes, sourceState.dotPositions].some(
    (value) => value && typeof value === "object" && Object.keys(value).length > 0
  );
}

function preservePreAuthBackup() {
  if (!hasDiaryContent(state)) return;
  try {
    localStorage.setItem(
      PRE_AUTH_BACKUP_KEY,
      JSON.stringify({ backedUpAt: new Date().toISOString(), data: getCloudStateSnapshot(state) })
    );
  } catch {
    // Local storage is an additional safeguard; sync remains available if it is blocked.
  }
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
