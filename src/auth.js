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
    detectSessionInUrl: false
  }
});
let syncUser = null;
let syncTimer = null;
let pendingSyncToast = false;
let lastSyncedAt = null;

export async function initSupabaseAuth() {
  if (!supabase) return;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) {
    const hasIntent = (() => {
      try {
        return sessionStorage.getItem(AUTH_INTENT_KEY) === "1";
      } catch {
        return false;
      }
    })();
    try {
      if (hasIntent) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
      }
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
    }
  });
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
      emailRedirectTo: "https://dot-diary.com"
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
      syncStatus.textContent = lastSyncedAt ? `Last synced ${formatSyncTime(lastSyncedAt)}.` : "Not synced yet.";
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
  }, 800);
}

async function loadFromCloud() {
  if (!supabase || !syncUser) return;
  const { data, error } = await supabase
    .from("user_data")
    .select("data, updated_at")
    .eq("user_id", syncUser.id)
    .maybeSingle();
  if (error) {
    showToast("Cloud sync failed.");
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
  if (remoteTimestamp === localTimestamp) return;
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
  const payload = {
    user_id: syncUser.id,
    data: state,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("user_data").upsert(payload);
  if (error) {
    showToast("Could not sync to cloud.");
    pendingSyncToast = false;
  } else {
    lastSyncedAt = new Date().toISOString();
    updateAuthUI();
    if (pendingSyncToast) {
      showToast("Synced.");
      pendingSyncToast = false;
    }
  }
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

function mergeNotes(localNote, remoteNote) {
  const local = (localNote || "").trim();
  const remote = (remoteNote || "").trim();
  if (!local) return remote;
  if (!remote) return local;
  if (local === remote) return local;
  return normalizeNote(`${local} / ${remote}`);
}

function mergeDotTypes(localTypes, remoteTypes, preferRemote) {
  const localById = new Map(localTypes.map((dot) => [dot.id, dot]));
  const remoteById = new Map(remoteTypes.map((dot) => [dot.id, dot]));
  const localByName = new Map(localTypes.map((dot) => [dot.name.toLowerCase(), dot]));
  const remoteByName = new Map(remoteTypes.map((dot) => [dot.name.toLowerCase(), dot]));
  const idRemap = new Map();
  const merged = [];

  const allNames = new Set([...localByName.keys(), ...remoteByName.keys()]);
  allNames.forEach((name) => {
    const local = localByName.get(name);
    const remote = remoteByName.get(name);
    if (local && remote) {
      const chosen = preferRemote ? remote : local;
      const other = preferRemote ? local : remote;
      merged.push({ ...chosen });
      if (other.id !== chosen.id) {
        idRemap.set(other.id, chosen.id);
      }
    } else if (local) {
      merged.push({ ...local });
    } else if (remote) {
      merged.push({ ...remote });
    }
  });

  localById.forEach((dot, id) => {
    if (!merged.some((item) => item.id === id) && !idRemap.has(id)) {
      merged.push({ ...dot });
    }
  });
  remoteById.forEach((dot, id) => {
    if (!merged.some((item) => item.id === id) && !idRemap.has(id)) {
      merged.push({ ...dot });
    }
  });

  return { merged, idRemap };
}

function mergeStates(localState, remoteState, preferRemote) {
  const { merged: dotTypes, idRemap } = mergeDotTypes(
    localState.dotTypes || [],
    remoteState.dotTypes || [],
    preferRemote
  );

  const dayDots = {};
  const allDays = new Set([
    ...Object.keys(localState.dayDots || {}),
    ...Object.keys(remoteState.dayDots || {})
  ]);
  allDays.forEach((iso) => {
    const localIds = (localState.dayDots?.[iso] || []).map((id) => idRemap.get(id) || id);
    const remoteIds = (remoteState.dayDots?.[iso] || []).map((id) => idRemap.get(id) || id);
    const mergedIds = Array.from(new Set([...localIds, ...remoteIds]));
    if (mergedIds.length > 0) dayDots[iso] = mergedIds;
  });

  const dotPositions = {};
  allDays.forEach((iso) => {
    const localPos = localState.dotPositions?.[iso] || {};
    const remotePos = remoteState.dotPositions?.[iso] || {};
    const mergedPos = {};
    const allDotIds = new Set([...Object.keys(localPos), ...Object.keys(remotePos)]);
    allDotIds.forEach((dotId) => {
      const remapped = idRemap.get(dotId) || dotId;
      if (localPos[dotId]) {
        mergedPos[remapped] = localPos[dotId];
      } else if (remotePos[dotId]) {
        mergedPos[remapped] = remotePos[dotId];
      }
    });
    if (Object.keys(mergedPos).length > 0) dotPositions[iso] = mergedPos;
  });

  const dayNotes = {};
  const allNotes = new Set([
    ...Object.keys(localState.dayNotes || {}),
    ...Object.keys(remoteState.dayNotes || {})
  ]);
  allNotes.forEach((iso) => {
    const mergedNote = mergeNotes(localState.dayNotes?.[iso], remoteState.dayNotes?.[iso]);
    if (mergedNote) dayNotes[iso] = mergedNote;
  });

  return {
    ...localState,
    monthCursor: remoteState.monthCursor || localState.monthCursor,
    yearCursor: remoteState.yearCursor || localState.yearCursor,
    weekStartsMonday: Boolean(remoteState.weekStartsMonday),
    darkMode: typeof remoteState.darkMode === "boolean" ? remoteState.darkMode : localState.darkMode,
    dotTypes,
    dayDots,
    dotPositions,
    dayNotes,
    lastModified: new Date(
      Math.max(getStateTimestamp(), new Date(remoteState.lastModified || 0).getTime())
    ).toISOString()
  };
}
