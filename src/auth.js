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
  render,
  resetToLoggedOut
} from "./ui.js";
import { normalizeNote } from "./utils.js";
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
let pendingSyncToast = false;
let lastSyncedAt = null;
let syncInFlight = null;
let syncInProgress = false;
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
    await loadFromCloud();
    startSyncPolling();
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
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
      await loadFromCloud();
      startSyncPolling();
    } else {
      stopSyncPolling();
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
  } else {
    showToast("Magic link sent. Check your email.");
    if (sourceButton) {
      if (!sourceButton.dataset.defaultLabel) {
        sourceButton.dataset.defaultLabel = sourceButton.textContent || "";
      }
      sourceButton.textContent = "Sent!";
      window.setTimeout(() => {
        sourceButton.textContent = sourceButton.dataset.defaultLabel || "Send magic link";
      }, 2000);
    }
  }
}

export async function signOutSupabase() {
  if (!supabase) return;
  await supabase.auth.signOut();
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  stopSyncPolling();
  syncInFlight = null;
  syncInProgress = false;
  pendingSyncToast = false;
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
    authStatus.textContent = "Sign in to sync this diary across devices.";
    authStatus.classList.add("muted");
    authSignOutButton.classList.add("hidden");
    if (authRow) authRow.classList.remove("hidden");
    if (syncStatus) syncStatus.textContent = "";
  }
}

export function scheduleSync() {
  if (!supabase || !syncUser) return;
  if (syncTimer) clearTimeout(syncTimer);
  pendingSyncToast = true;
  syncTimer = setTimeout(() => {
    syncToCloud();
  }, SYNC_DEBOUNCE_MS);
}

async function loadFromCloud({ silentError = false } = {}) {
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
    await syncToCloud();
    return;
  }
  const remoteState = normalizeImportedState(data.data);
  const remoteTimestamp = new Date(data.updated_at || remoteState.lastModified || 0).getTime();
  const localTimestamp = getStateTimestamp();
  if (!remoteTimestamp && localTimestamp) {
    await syncToCloud();
    return;
  }
  if (remoteTimestamp === localTimestamp) {
    lastSyncedAt = new Date().toISOString();
    updateAuthUI();
    return;
  }
  const preferRemote = remoteTimestamp > localTimestamp;
  setState(mergeStates(state, remoteState, preferRemote));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  requestRender();
  lastSyncedAt = new Date().toISOString();
  updateAuthUI();
  await syncToCloud();
}

async function syncToCloud() {
  if (!supabase || !syncUser) return;
  if (syncInFlight) return syncInFlight;
  syncInProgress = true;
  updateAuthUI();
  const payload = {
    user_id: syncUser.id,
    data: state,
    updated_at: new Date().toISOString()
  };
  syncInFlight = (async () => {
    const { error } = await supabase.from("user_data").upsert(payload);
    if (error) {
      showToast("Could not sync to cloud.");
      pendingSyncToast = false;
    } else {
      lastSyncedAt = new Date().toISOString();
      if (pendingSyncToast) {
        showToast("Synced.");
        pendingSyncToast = false;
      }
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
  if (syncInProgress) return "Syncing...";
  return lastSyncedAt ? `Last synced ${formatSyncTime(lastSyncedAt)}.` : "Signed in. Waiting to sync changes.";
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

function mergeStates(localState, remoteState, preferRemote) {
  const winner = preferRemote ? remoteState : localState;
  const loser = preferRemote ? localState : remoteState;
  const dotTypes = Array.isArray(winner.dotTypes) ? structuredClone(winner.dotTypes) : [];
  const validDotIds = new Set(dotTypes.map((dot) => dot.id));
  const dayDots = {};
  const rawDayDots = winner.dayDots && typeof winner.dayDots === "object" ? winner.dayDots : {};
  Object.entries(rawDayDots).forEach(([iso, ids]) => {
    if (!Array.isArray(ids)) return;
    const filtered = ids.filter((id) => validDotIds.has(id));
    if (filtered.length > 0) dayDots[iso] = filtered;
  });
  const dotPositions = {};
  const rawDotPositions = winner.dotPositions && typeof winner.dotPositions === "object" ? winner.dotPositions : {};
  Object.entries(rawDotPositions).forEach(([iso, positions]) => {
    if (!positions || typeof positions !== "object") return;
    const filtered = {};
    Object.entries(positions).forEach(([dotId, pos]) => {
      if (validDotIds.has(dotId)) filtered[dotId] = pos;
    });
    if (Object.keys(filtered).length > 0) dotPositions[iso] = filtered;
  });
  const dayNotes = {};
  const rawDayNotes = winner.dayNotes && typeof winner.dayNotes === "object" ? winner.dayNotes : {};
  Object.entries(rawDayNotes).forEach(([iso, note]) => {
    const normalized = normalizeNote(note);
    if (normalized) dayNotes[iso] = normalized;
  });

  return {
    ...localState,
    monthCursor: winner.monthCursor || loser.monthCursor || localState.monthCursor,
    yearCursor: winner.yearCursor || loser.yearCursor || localState.yearCursor,
    weekStartsMonday:
      typeof winner.weekStartsMonday === "boolean"
        ? winner.weekStartsMonday
        : typeof loser.weekStartsMonday === "boolean"
          ? loser.weekStartsMonday
          : localState.weekStartsMonday,
    darkMode:
      typeof winner.darkMode === "boolean"
        ? winner.darkMode
        : typeof loser.darkMode === "boolean"
          ? loser.darkMode
          : localState.darkMode,
    dotTypes,
    dayDots,
    dotPositions,
    dayNotes,
    lastModified: new Date(
      Math.max(getStateTimestamp(), new Date(remoteState.lastModified || 0).getTime())
    ).toISOString()
  };
}
