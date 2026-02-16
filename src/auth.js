import {
  AUTH_INTENT_KEY,
  AUTH_STATE_KEY,
  ONBOARDING_KEY,
  STORAGE_KEY,
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
  getStateTimestamp,
  normalizeImportedState,
  requestRender,
  setState,
  state
} from "./state.js";
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
const SYNC_DEBOUNCE_MS = 250;
const SYNC_POLL_MS = 5000;

export async function initSupabaseAuth() {
  if (authInitStarted) return;
  authInitStarted = true;
  if (!supabase) return;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
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
  if (!getHasEnteredApp() && syncUser && !marketingPage?.classList.contains("hidden")) {
    enterApp({ skipOnboarding: true });
  }
  updateAuthUI();
  if (syncUser) {
    await loadFromCloud({ fromAuthBootstrap: true });
    startSyncPolling();
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    const wasSignedIn = Boolean(syncUser);
    syncUser = session?.user || null;
    if (!getHasEnteredApp() && syncUser && !marketingPage?.classList.contains("hidden")) {
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
      startSyncPolling();
    } else {
      stopSyncPolling();
      setState(structuredClone(defaultState));
      requestRender();
      showMarketingPage();
      resetToLoggedOut();
    }
  });
  document.addEventListener("visibilitychange", handleVisibilitySync);
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
    showToast("Magic link sent. Check your email.");
    if (sourceButton) {
      sourceButton.textContent = "Check your email";
      sourceButton.disabled = false;
      window.setTimeout(() => {
        sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send magic link";
      }, 2000);
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
    }
  } else {
    authStatus.textContent = "Sign in to store this diary in the cloud.";
    authStatus.classList.add("muted");
    authSignOutButton.classList.add("hidden");
    if (authRow) authRow.classList.remove("hidden");
    if (syncStatus) syncStatus.textContent = "";
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
  const { data, error } = await supabase
    .from("user_data")
    .select("data, updated_at")
    .eq("user_id", syncUser.id)
    .maybeSingle();
  if (error) {
    if (!silentError) showToast("Cloud sync failed.");
    return;
  }
  if (!data?.data) {
    // Cloud-only mode: initialize row from current in-memory state once.
    await syncToCloud();
    if (!fromAuthBootstrap) showToast("Cloud data initialized.");
    return;
  }
  const remoteState = normalizeImportedState(data.data);
  const remoteTimestamp = new Date(data.updated_at || remoteState.lastModified || 0).getTime() || 0;
  const localTimestamp = getStateTimestamp() || 0;
  const preferLocalConflicts = localTimestamp >= remoteTimestamp;
  const mergedState = mergeDiaryStates(state, remoteState, {
    preferLocalSettings: preferLocalConflicts,
    preferLocalConflicts
  });
  const localDiffersFromMerged = !areStatesEqual(state, mergedState);
  const remoteDiffersFromMerged = !areStatesEqual(remoteState, mergedState);

  if (fromAuthBootstrap) {
    if (localDiffersFromMerged) {
      setState(mergedState);
      requestRender();
    }
    lastSyncedAt = new Date().toISOString();
    updateAuthUI();
    if (remoteDiffersFromMerged) {
      await syncToCloud();
    }
    return;
  }

  if (localDiffersFromMerged) {
    setState(mergedState);
    requestRender();
  }
  lastSyncedAt = new Date().toISOString();
  updateAuthUI();
  if (remoteDiffersFromMerged) {
    await syncToCloud();
  }
}

async function syncToCloud() {
  if (!supabase || !syncUser) return;
  if (syncInFlight) return syncInFlight;
  syncInProgress = true;
  updateAuthUI();
  const payload = {
    user_id: syncUser.id,
    data: getCloudStateSnapshot(state),
    updated_at: new Date().toISOString()
  };
  syncInFlight = (async () => {
    const { error } = await supabase.from("user_data").upsert(payload);
    if (error) {
      showToast("Could not sync to cloud.");
    } else {
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

function mergeSettingsFromLocal(baseState, localState) {
  return {
    ...baseState,
    weekStartsMonday: Boolean(localState.weekStartsMonday),
    hideSuggestions: Boolean(localState.hideSuggestions),
    showKeyboardHints:
      typeof localState.showKeyboardHints === "boolean"
        ? localState.showKeyboardHints
        : baseState.showKeyboardHints,
    darkMode: typeof localState.darkMode === "boolean" ? localState.darkMode : baseState.darkMode
  };
}

function mergeDiaryStates(localState, remoteState, { preferLocalSettings, preferLocalConflicts }) {
  const preferredState = preferLocalConflicts ? localState : remoteState;
  const fallbackState = preferLocalConflicts ? remoteState : localState;
  const settingsMerged = preferLocalSettings
    ? mergeSettingsFromLocal(remoteState, localState)
    : mergeSettingsFromLocal(localState, remoteState);
  const localTimestamp = new Date(localState.lastModified || 0).getTime() || 0;
  const remoteTimestamp = new Date(remoteState.lastModified || 0).getTime() || 0;
  const latestTimestamp = Math.max(localTimestamp, remoteTimestamp);

  return {
    ...settingsMerged,
    monthCursor: preferredState.monthCursor || fallbackState.monthCursor,
    yearCursor: Number.isInteger(preferredState.yearCursor)
      ? preferredState.yearCursor
      : fallbackState.yearCursor,
    lastModified: latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null,
    dotTypes: mergeDotTypes(localState.dotTypes, remoteState.dotTypes, preferLocalConflicts),
    dayDots: mergeDayDots(localState.dayDots, remoteState.dayDots, preferLocalConflicts),
    dotPositions: mergeDotPositions(localState.dotPositions, remoteState.dotPositions, preferLocalConflicts),
    dayNotes: mergeDayNotes(localState.dayNotes, remoteState.dayNotes, preferLocalConflicts)
  };
}

function mergeDotTypes(localDotTypes, remoteDotTypes, preferLocalConflicts) {
  const merged = [];
  const indexes = new Map();
  const primary = preferLocalConflicts ? localDotTypes || [] : remoteDotTypes || [];
  const secondary = preferLocalConflicts ? remoteDotTypes || [] : localDotTypes || [];

  const upsert = (dot, isPreferredSource) => {
    if (!dot || typeof dot !== "object") return;
    const key = getDotTypeKey(dot);
    const existingIndex = indexes.get(key);
    if (existingIndex == null) {
      indexes.set(key, merged.length);
      merged.push(dot);
      return;
    }
    if (isPreferredSource) {
      merged[existingIndex] = dot;
    }
  };

  primary.forEach((dot) => upsert(dot, true));
  secondary.forEach((dot) => upsert(dot, false));
  return merged;
}

function getDotTypeKey(dot) {
  if (typeof dot.id === "string" && dot.id.length > 0) return `id:${dot.id}`;
  const name = typeof dot.name === "string" ? dot.name : "";
  const color = typeof dot.color === "string" ? dot.color : "";
  return `anon:${name}|${color}`;
}

function mergeDayDots(localDayDots, remoteDayDots, preferLocalConflicts) {
  const merged = {};
  const allDates = new Set([...Object.keys(remoteDayDots || {}), ...Object.keys(localDayDots || {})]);
  for (const isoDate of allDates) {
    const primary = preferLocalConflicts ? localDayDots?.[isoDate] : remoteDayDots?.[isoDate];
    const secondary = preferLocalConflicts ? remoteDayDots?.[isoDate] : localDayDots?.[isoDate];
    const dotIds = dedupeDotIds([...(primary || []), ...(secondary || [])]);
    if (dotIds.length > 0) {
      merged[isoDate] = dotIds;
    }
  }
  return merged;
}

function dedupeDotIds(dotIds) {
  const seen = new Set();
  const deduped = [];
  dotIds.forEach((dotId) => {
    if (typeof dotId !== "string" || seen.has(dotId)) return;
    seen.add(dotId);
    deduped.push(dotId);
  });
  return deduped;
}

function mergeDotPositions(localPositions, remotePositions, preferLocalConflicts) {
  const merged = {};
  const allDates = new Set([...Object.keys(remotePositions || {}), ...Object.keys(localPositions || {})]);
  for (const isoDate of allDates) {
    const localDay = localPositions?.[isoDate] && typeof localPositions[isoDate] === "object" ? localPositions[isoDate] : {};
    const remoteDay =
      remotePositions?.[isoDate] && typeof remotePositions[isoDate] === "object" ? remotePositions[isoDate] : {};
    const nextDay = preferLocalConflicts ? { ...remoteDay, ...localDay } : { ...localDay, ...remoteDay };
    if (Object.keys(nextDay).length > 0) {
      merged[isoDate] = nextDay;
    }
  }
  return merged;
}

function mergeDayNotes(localNotes, remoteNotes, preferLocalConflicts) {
  const merged = {};
  const allDates = new Set([...Object.keys(remoteNotes || {}), ...Object.keys(localNotes || {})]);
  for (const isoDate of allDates) {
    const localNote = typeof localNotes?.[isoDate] === "string" ? localNotes[isoDate] : "";
    const remoteNote = typeof remoteNotes?.[isoDate] === "string" ? remoteNotes[isoDate] : "";
    const primary = preferLocalConflicts ? localNote : remoteNote;
    const secondary = preferLocalConflicts ? remoteNote : localNote;
    const nextNote = primary || secondary;
    if (nextNote) {
      merged[isoDate] = nextNote;
    }
  }
  return merged;
}

function areStatesEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
