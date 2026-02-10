import { DEMO_MODE, STORAGE_KEY } from "./constants.js";
import { formatISODate, hash32, normalizeNote, shuffleArray, startOfMonth } from "./utils.js";

export const defaultState = {
  monthCursor: startOfMonth(new Date()).toISOString(),
  yearCursor: new Date().getFullYear(),
  weekStartsMonday: false,
  hideSuggestions: false,
  darkMode: null,
  lastModified: new Date().toISOString(),
  dotTypes: [],
  dayDots: {},
  dotPositions: {},
  dayNotes: {}
};

let renderFn = () => {};
let renderQueued = false;
let renderCallbacks = [];
let scheduleSyncFn = () => {};

export function registerRender(fn) {
  renderFn = fn;
}

export function requestRender(callback) {
  if (typeof callback === "function") {
    renderCallbacks.push(callback);
  }
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderFn();
    if (renderCallbacks.length > 0) {
      const callbacks = renderCallbacks;
      renderCallbacks = [];
      callbacks.forEach((fn) => fn());
    }
  });
}

export function registerScheduleSync(fn) {
  scheduleSyncFn = fn;
}

export let state = DEMO_MODE ? createDemoState() : loadState();

export function setState(next) {
  state = next;
}

export function saveAndRender() {
  if (DEMO_MODE) {
    requestRender();
    return;
  }
  state.lastModified = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  requestRender();
  scheduleSyncFn();
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const yearFromMonthCursor = parsed.monthCursor ? new Date(parsed.monthCursor).getFullYear() : null;
    return {
      monthCursor: parsed.monthCursor || defaultState.monthCursor,
      yearCursor: Number.isInteger(parsed.yearCursor) ? parsed.yearCursor : yearFromMonthCursor || defaultState.yearCursor,
      weekStartsMonday: Boolean(parsed.weekStartsMonday),
      hideSuggestions: Boolean(parsed.hideSuggestions),
      darkMode: typeof parsed.darkMode === "boolean" ? parsed.darkMode : null,
      lastModified: typeof parsed.lastModified === "string" ? parsed.lastModified : new Date().toISOString(),
      dotTypes: Array.isArray(parsed.dotTypes) ? parsed.dotTypes : structuredClone(defaultState.dotTypes),
      dayDots: parsed.dayDots && typeof parsed.dayDots === "object" ? parsed.dayDots : {},
      dotPositions: parsed.dotPositions && typeof parsed.dotPositions === "object" ? parsed.dotPositions : {},
      dayNotes: parsed.dayNotes && typeof parsed.dayNotes === "object" ? parsed.dayNotes : {}
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export function getDayDotIds(isoDate) {
  return state.dayDots[isoDate] || [];
}

export function getDayNote(isoDate) {
  return state.dayNotes[isoDate] || "";
}

export function setDayNote(isoDate, rawValue) {
  const note = normalizeNote(rawValue);
  if (!note) {
    delete state.dayNotes[isoDate];
  } else {
    state.dayNotes[isoDate] = note;
  }
  saveAndRender();
}

export function createDemoState() {
  const now = new Date();
  const year = now.getFullYear();
  const dotTypes = [
    { id: "demo-exercise", name: "Exercise", color: "#FF0000" },
    { id: "demo-slept", name: "Slept Well", color: "#FFC700" },
    { id: "demo-reading", name: "Reading", color: "#15C771" },
    { id: "demo-cooking", name: "Cooking", color: "#2F8CFA" },
    { id: "demo-social", name: "Social Media", color: "#B632CC" },
    { id: "demo-sugar", name: "Sugar", color: "#875436" },
    { id: "demo-movie", name: "Movie", color: "#1D3557" },
    { id: "demo-music", name: "Music", color: "#0F766E" }
  ];
  const noteBank = [
    "Great walk downtown",
    "Late night movie",
    "Date night",
    "Sunset bike ride",
    "Met old friend",
    "Long studio session",
    "Felt grounded today",
    "Amazing ramen spot",
    "Park run",
    "Stayed in tonight",
    "Museum afternoon",
    "Long phone call",
    "Quiet morning coffee",
    "New recipe win",
    "Rainy day focus"
  ];
  const dayDots = {};
  const dayNotes = {};
  const dotPositions = {};
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  const isoNotes = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const iso = formatISODate(date);
    isoNotes.push(iso);
    const ids = [];
    const month = date.getMonth();
    const weekday = date.getDay();

    // Exercise: heavy Jan-Mar, off Jun-Aug, 3x/week Sep-Dec
    if (month <= 2 && weekday !== 0) ids.push("demo-exercise");
    if (month >= 5 && month <= 7) {
      // off
    } else if (month >= 8 && [1, 3, 5].includes(weekday)) {
      ids.push("demo-exercise");
    }

    // Slept well: most nights, but more misses in summer + holidays
    const sleepSkip = hash32(`${iso}|demo|sleep`) % 7 === 0;
    if (![5, 6].includes(weekday) && !sleepSkip) ids.push("demo-slept");
    if (month >= 10 && hash32(`${iso}|demo|sleep-holiday`) % 3 === 0) {
      const idx = ids.indexOf("demo-slept");
      if (idx >= 0) ids.splice(idx, 1);
    }

    // Reading: strong in winter, off in summer, light in spring
    if (month <= 1 && ![5, 6].includes(weekday)) ids.push("demo-reading");
    if (month >= 2 && month <= 3 && [0, 2, 4].includes(weekday)) ids.push("demo-reading");
    if (month >= 8 && [1, 3, 6].includes(weekday)) ids.push("demo-reading");

    // Cooking: bursts by season
    if (month <= 3 && [1, 3, 6].includes(weekday)) ids.push("demo-cooking");
    if (month >= 4 && month <= 5 && [2, 4].includes(weekday)) ids.push("demo-cooking");
    if (month >= 8 && [0, 2, 4, 6].includes(weekday)) ids.push("demo-cooking");

    // Social media: heavy Mar-Apr, break May, streaky otherwise
    if (month >= 2 && month <= 3) {
      ids.push("demo-social");
    } else if (month === 4) {
      // break
    } else {
      const socialCycle = hash32(`${iso}|demo|social`) % 12;
      if (socialCycle <= 3) ids.push("demo-social");
    }

    // Sugar: weekends mostly, heavy in Nov-Dec
    if ((weekday === 6 || weekday === 0) && (hash32(`${iso}|demo|sugar`) % 3 === 0)) {
      ids.push("demo-sugar");
    }
    if (month >= 10 && hash32(`${iso}|demo|sugar-holiday`) % 4 === 0) {
      ids.push("demo-sugar");
    }

    // Movie: mostly winter weekends, occasional summer
    if ((month <= 1 || month >= 9) && (weekday === 5 || weekday === 6)) ids.push("demo-movie");
    if (month >= 5 && month <= 7 && weekday === 6 && date.getDate() <= 7) ids.push("demo-movie");

    // Music: daily in May, weekends otherwise
    if (month === 4) ids.push("demo-music");
    if (month !== 4 && (weekday === 0 || weekday === 6)) ids.push("demo-music");

    if (ids.length > 0) {
      dayDots[iso] = ids;
      for (const id of ids) {
        const moved = hash32(`${iso}|${id}|demo|moved`) % 5 === 0;
        if (!moved) continue;
        if (!dotPositions[iso]) dotPositions[iso] = {};
        dotPositions[iso][id] = {
          left: 10 + (hash32(`${iso}|${id}|demo|x`) % 81),
          top: 14 + (hash32(`${iso}|${id}|demo|y`) % 73)
        };
      }
    }
  }

  const shuffledNotes = shuffleArray(noteBank);
  const noteCount = Math.min(shuffledNotes.length, Math.floor(isoNotes.length / 6));
  const monthBuckets = Array.from({ length: 12 }, () => []);
  isoNotes.forEach((iso) => {
    const month = Number(iso.slice(5, 7)) - 1;
    monthBuckets[month].push(iso);
  });
  for (let i = 0; i < noteCount; i += 1) {
    const monthIndex = i % 12;
    const bucket = monthBuckets[monthIndex];
    if (!bucket || bucket.length === 0) continue;
    const pick = (hash32(`${bucket[0]}|note|${i}`) % bucket.length + bucket.length) % bucket.length;
    const iso = bucket.splice(pick, 1)[0];
    dayNotes[iso] = normalizeNote(shuffledNotes[i]);
  }

  const holidayNotes = {
    [formatISODate(new Date(year, 0, 1))]: "New Year's Day",
    [formatISODate(new Date(year, 1, 14))]: "Valentine's Day date",
    [formatISODate(new Date(year, 6, 4))]: "Fourth of July fireworks",
    [formatISODate(new Date(year, 9, 31))]: "Halloween costumes",
    [formatISODate(new Date(year, 11, 24))]: "Christmas Eve dinner",
    [formatISODate(new Date(year, 11, 25))]: "Christmas Day family"
  };
  const thanksgiving = (() => {
    const nov1 = new Date(year, 10, 1);
    const firstThursdayOffset = (4 - nov1.getDay() + 7) % 7;
    const fourthThursday = 1 + firstThursdayOffset + 21;
    return formatISODate(new Date(year, 10, fourthThursday));
  })();
  holidayNotes[thanksgiving] = "Thanksgiving dinner";

  Object.entries(holidayNotes).forEach(([iso, note]) => {
    dayNotes[iso] = normalizeNote(note);
  });

  return {
    monthCursor: startOfMonth(now).toISOString(),
    yearCursor: year,
    weekStartsMonday: false,
    hideSuggestions: false,
    darkMode: null,
    lastModified: new Date().toISOString(),
    dotTypes,
    dayDots,
    dotPositions,
    dayNotes
  };
}

export function stickerPosition(isoDate, dotId) {
  const h1 = hash32(`${isoDate}|${dotId}|x`);
  const h2 = hash32(`${isoDate}|${dotId}|y`);
  const h3 = hash32(`${isoDate}|${dotId}|r`);

  return {
    left: 48 + (h1 % 46),
    top: 22 + (h2 % 58),
    rotate: -18 + (h3 % 37)
  };
}

export function stickerPositionMonth(isoDate, dotId) {
  const h1 = hash32(`${isoDate}|${dotId}|x|m`);
  const h2 = hash32(`${isoDate}|${dotId}|y|m`);
  const h3 = hash32(`${isoDate}|${dotId}|r|m`);
  return {
    left: 12 + (h1 % 76),
    top: 24 + (h2 % 64),
    rotate: -18 + (h3 % 37)
  };
}

export function getDemoDotPosition(demoState, isoDate, dotId) {
  const stored = demoState.dotPositions?.[isoDate]?.[dotId];
  const base = stickerPosition(isoDate, dotId);
  if (!stored) return base;
  return {
    left: stored.left,
    top: stored.top,
    rotate: base.rotate
  };
}

export function getDotPosition(isoDate, dotId, mode) {
  const stored = state.dotPositions?.[isoDate]?.[dotId];
  const base = mode === "month" ? stickerPositionMonth(isoDate, dotId) : stickerPosition(isoDate, dotId);
  if (!stored) return base;
  return {
    left: stored.left,
    top: stored.top,
    rotate: base.rotate
  };
}

export function saveDotPosition(isoDate, dotId, left, top) {
  if (!state.dotPositions[isoDate]) state.dotPositions[isoDate] = {};
  state.dotPositions[isoDate][dotId] = { left, top };
}

export function clearDotPosition(isoDate, dotId) {
  const dayPositions = state.dotPositions[isoDate];
  if (!dayPositions) return;
  delete dayPositions[dotId];
  if (Object.keys(dayPositions).length === 0) {
    delete state.dotPositions[isoDate];
  }
}

export function normalizeImportedState(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return structuredClone(defaultState);
  }
  const yearFromMonthCursor = parsed.monthCursor ? new Date(parsed.monthCursor).getFullYear() : null;
  return {
    monthCursor: typeof parsed.monthCursor === "string" ? parsed.monthCursor : defaultState.monthCursor,
    yearCursor: Number.isInteger(parsed.yearCursor) ? parsed.yearCursor : yearFromMonthCursor || defaultState.yearCursor,
    weekStartsMonday: Boolean(parsed.weekStartsMonday),
    hideSuggestions: Boolean(parsed.hideSuggestions),
    darkMode: typeof parsed.darkMode === "boolean" ? parsed.darkMode : null,
    lastModified: typeof parsed.lastModified === "string" ? parsed.lastModified : new Date().toISOString(),
    dotTypes: Array.isArray(parsed.dotTypes) ? parsed.dotTypes : [],
    dayDots: parsed.dayDots && typeof parsed.dayDots === "object" ? parsed.dayDots : {},
    dotPositions: parsed.dotPositions && typeof parsed.dotPositions === "object" ? parsed.dotPositions : {},
    dayNotes: parsed.dayNotes && typeof parsed.dayNotes === "object" ? parsed.dayNotes : {}
  };
}

export function getStateTimestamp() {
  return new Date(state.lastModified || 0).getTime();
}
