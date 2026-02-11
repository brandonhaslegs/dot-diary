import {
  APP_ENTRY_KEY,
  AUTH_STATE_KEY,
  COLOR_PALETTE,
  DEMO_MODE,
  DOT_NAME_MAX_LENGTH,
  MOBILE_MONTH_BATCH_SIZE,
  MODAL_ANIMATION_MS,
  ONBOARDING_KEY,
  POPOVER_ANIMATION_MS,
  SUGGESTED_DOT_TYPES,
  STORAGE_KEY,
  VIEW_MODE_KEY,
  YEAR_BATCH_SIZE
} from "./constants.js";
import {
  appShell,
  colorModeDarkButton,
  colorModeLightButton,
  deleteModal,
  deleteText,
  dotTypeList,
  hideSuggestionsInput,
  marketingCalendar,
  marketingHero,
  marketingLogin,
  marketingMonth,
  marketingPage,
  marketingYear,
  menuScrim,
  mobileMenuPortal,
  monthGrid,
  onboardingDotTypeList,
  onboardingModal,
  onboardingSuggestedDotList,
  periodPickerLabel,
  periodPickerMenu,
  popover,
  popoverItemTemplate,
  popoverScrim,
  settingsModal,
  suggestedDotContent,
  suggestedDotList,
  todayButton,
  weekStartMondayInput,
  yearGrid
} from "./dom.js";
import {
  buildMonthCells,
  clamp,
  formatISODate,
  hash32,
  isMobileView,
  monthDiff,
  shuffleArray,
  startOfMonth,
  weekdayShort
} from "./utils.js";
import {
  clearDotPosition,
  createDemoState,
  defaultState,
  getDayDotIds,
  getDayNote,
  getDemoDotPosition,
  getDotPosition,
  normalizeImportedState,
  requestRender,
  saveAndRender,
  saveDotPosition,
  setDayNote,
  setState,
  state
} from "./state.js";
import { showToast } from "./toast.js";

const shuffledSuggestions = shuffleArray(SUGGESTED_DOT_TYPES);

let activePopover = null;
let activeNoteEdit = null;
let activeNoteEditMonthIso = null;
let pendingFocusDotId = null;
let pendingDeleteDotTypeId = null;
let pendingDeleteMode = "safe";
let pendingDeleteDotTypeName = "";
let loadedYearBatchCount = 1;
let loadedMobileMonthCount = 24;
let periodLoadInProgress = false;
let suppressDayOpenUntil = 0;
let monthScrollAttached = false;
let hasInitializedMobileMonthScroll = false;
let pendingMobileMonthAnchorIso = null;
let settingsModalHideTimer = null;
let popoverHideTimer = null;
let menuScrimHideTimer = null;
let hasEnteredApp = false;
let loginMode = false;
let updateAuthUIFn = () => {};
const DOT_SPACING_BY_MODE = {
  year: 9,
  month: 11
};
const DOT_BOUNDS = {
  minLeft: 6,
  maxLeft: 94,
  minTop: 12,
  maxTop: 88
};
const DOT_CANDIDATE_OFFSETS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
  [2, 1],
  [-2, 1],
  [2, -1],
  [-2, -1],
  [1, 2],
  [-1, 2],
  [1, -2],
  [-1, -2]
];

export function registerAuthUpdater(fn) {
  updateAuthUIFn = fn;
}

export function getHasEnteredApp() {
  return hasEnteredApp;
}

export function setHasEnteredApp(value) {
  hasEnteredApp = value;
}

export function setLoginMode(value) {
  loginMode = value;
}

export function showLogin() {
  loginMode = true;
  marketingHero?.classList.add("hidden");
  marketingLogin?.classList.remove("hidden");
}

export function showMarketingHero() {
  loginMode = false;
  marketingLogin?.classList.add("hidden");
  marketingHero?.classList.remove("hidden");
}

export function showMarketingPage() {
  try {
    localStorage.setItem(VIEW_MODE_KEY, "marketing");
  } catch {
    // ignore
  }
  marketingPage?.classList.remove("hidden");
  appShell?.classList.add("hidden");
}

export function resetToLoggedOut() {
  hasEnteredApp = false;
  loginMode = false;
  try {
    localStorage.removeItem(APP_ENTRY_KEY);
    localStorage.setItem(VIEW_MODE_KEY, "marketing");
  } catch {
    // ignore
  }
  marketingLogin?.classList.add("hidden");
  marketingHero?.classList.remove("hidden");
  marketingPage?.classList.remove("hidden");
  appShell?.classList.add("hidden");
}

export function render() {
  const active = document.activeElement;
  const editingNote = active instanceof HTMLElement && active.classList.contains("note-editor");
  if (editingNote) return;

  applyTheme();
  renderPeriodPicker();
  renderDiaryGrid();
  updateTodayButtonVisibility();
  renderDotTypeList();
  if (weekStartMondayInput) weekStartMondayInput.checked = Boolean(state.weekStartsMonday);
  if (hideSuggestionsInput) hideSuggestionsInput.checked = !state.hideSuggestions;
  if (suggestedDotContent) {
    suggestedDotContent.classList.toggle("hidden", Boolean(state.hideSuggestions));
  }
  const darkModeEnabled = isDarkModeEnabled();
  colorModeLightButton?.classList.toggle("active", !darkModeEnabled);
  colorModeDarkButton?.classList.toggle("active", darkModeEnabled);
  renderSuggestedDotTypes();
  renderOnboardingLists();
  updateAuthUIFn();
}

function isViewingTodayMonth() {
  const selectedMonth = startOfMonth(new Date(state.monthCursor));
  const currentMonth = startOfMonth(new Date());
  return (
    selectedMonth.getFullYear() === currentMonth.getFullYear() &&
    selectedMonth.getMonth() === currentMonth.getMonth()
  );
}

function updateTodayButtonVisibility() {
  if (!todayButton) return;
  const shouldShow = isMobileView() && !monthGrid.classList.contains("hidden") && !isViewingTodayMonth();
  todayButton.classList.toggle("hidden", !shouldShow);
}

export function renderPeriodPicker(preserveScroll = false, previousScrollTop = 0) {
  const currentYear = new Date().getFullYear();
  if (state.yearCursor > currentYear) {
    state.yearCursor = currentYear;
  }
  periodPickerMenu.innerHTML = "";
  if (isMobileView()) {
    const selectedMonthDate = new Date(state.monthCursor);
    const currentMonthDate = startOfMonth(new Date());
    if (selectedMonthDate > currentMonthDate) {
      state.monthCursor = currentMonthDate.toISOString();
      state.yearCursor = currentMonthDate.getFullYear();
    }
    const normalizedSelectedMonthDate = new Date(state.monthCursor);
    periodPickerLabel.textContent = normalizedSelectedMonthDate.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric"
    });
    const selectedMonthDiff = monthDiff(currentMonthDate, normalizedSelectedMonthDate);
    if (selectedMonthDiff >= loadedMobileMonthCount) {
      loadedMobileMonthCount = selectedMonthDiff + 1;
    }

    for (let i = 0; i < loadedMobileMonthCount; i += 1) {
      const optionDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - i, 1);
      const optionYear = optionDate.getFullYear();
      const optionMonth = optionDate.getMonth();

      const item = document.createElement("button");
      item.type = "button";
      item.className = "period-picker-item";
      if (
        optionYear === normalizedSelectedMonthDate.getFullYear() &&
        optionMonth === normalizedSelectedMonthDate.getMonth()
      ) {
        item.classList.add("active");
      }
      item.textContent = optionDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      item.addEventListener("click", () => {
        state.monthCursor = startOfMonth(optionDate).toISOString();
        state.yearCursor = optionYear;
        pendingMobileMonthAnchorIso = state.monthCursor;
        closePeriodMenu();
        saveAndRender();
      });
      periodPickerMenu.appendChild(item);
    }

    if (preserveScroll) {
      periodPickerMenu.scrollTop = previousScrollTop;
    }
    return;
  }

  periodPickerLabel.textContent = String(state.yearCursor);
  const minLoadedYear = currentYear - loadedYearBatchCount * YEAR_BATCH_SIZE + 1;
  if (state.yearCursor < minLoadedYear) {
    loadedYearBatchCount = Math.ceil((currentYear - state.yearCursor + 1) / YEAR_BATCH_SIZE);
  }

  const oldestLoadedYear = currentYear - loadedYearBatchCount * YEAR_BATCH_SIZE + 1;
  for (let year = currentYear; year >= oldestLoadedYear; year -= 1) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "period-picker-item";
    if (year === state.yearCursor) item.classList.add("active");
    item.textContent = String(year);
    item.addEventListener("click", () => {
      state.yearCursor = year;
      const monthDate = new Date(state.monthCursor);
      monthDate.setFullYear(year);
      state.monthCursor = startOfMonth(monthDate).toISOString();
      closePeriodMenu();
      saveAndRender();
    });
    periodPickerMenu.appendChild(item);
  }

  if (preserveScroll) {
    periodPickerMenu.scrollTop = previousScrollTop;
  }
}

export function renderDiaryGrid() {
  if (isMobileView()) {
    const wasHidden = monthGrid.classList.contains("hidden");
    yearGrid.classList.add("hidden");
    monthGrid.classList.remove("hidden");
    if (wasHidden) {
      pendingMobileMonthAnchorIso = startOfMonth(new Date(state.monthCursor)).toISOString();
    }
    renderMonthGrid();
  } else {
    monthGrid.classList.add("hidden");
    yearGrid.classList.remove("hidden");
    renderYearGrid();
  }
}

export function renderYearGrid() {
  const year = state.yearCursor;
  const todayIso = formatISODate(new Date());
  yearGrid.innerHTML = "";

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const column = document.createElement("section");
    column.className = "month-column";
    if (new Date(year, monthIndex + 1, 0).getDate() === 31) {
      column.classList.add("month-31");
    }

    const monthTitle = document.createElement("h3");
    monthTitle.className = "month-title";
    monthTitle.textContent = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long" });
    column.appendChild(monthTitle);

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let dayNum = 1; dayNum <= 31; dayNum += 1) {
      if (dayNum > daysInMonth) {
        const filler = document.createElement("div");
        filler.className = "year-day filler";
        column.appendChild(filler);
        continue;
      }

      const date = new Date(year, monthIndex, dayNum);
      const iso = formatISODate(date);
      const isEditingThisDay = activeNoteEdit === iso;
      const row = document.createElement(isEditingThisDay ? "div" : "button");
      if (!isEditingThisDay) row.type = "button";
      row.className = "year-day";
      if (iso === todayIso) row.classList.add("current-day");
      row.dataset.date = iso;

      const label = document.createElement("span");
      label.className = "day-label";
      label.textContent = `${String(dayNum).padStart(2, "0")} ${weekdayShort(date)}`;
      row.appendChild(label);

      const dotLayer = document.createElement("div");
      dotLayer.className = "dot-layer";
      const dayDotIds = getDayDotIds(iso);
      const resolvedPositions = resolveDotPositionsForDay({
        isoDate: iso,
        dotIds: dayDotIds,
        mode: "year",
        getBasePosition: (dotId) => getDotPosition(iso, dotId, "year"),
        isLocked: (dotId) => Boolean(state.dotPositions?.[iso]?.[dotId])
      });
      dayDotIds.forEach((dotId) => {
        const dotType = state.dotTypes.find((t) => t.id === dotId);
        if (!dotType) return;
        const sticker = document.createElement("span");
        sticker.className = "dot-sticker";
        sticker.style.background = dotType.color;
        const pos = resolvedPositions.get(dotId) || getDotPosition(iso, dotId, "year");
        sticker.style.left = `${pos.left}%`;
        sticker.style.top = `${pos.top}%`;
        sticker.style.transform = `translate(-50%, -50%) rotate(${pos.rotate}deg)`;
        sticker.title = `${dotType.name} (drag to move)`;
        sticker.addEventListener("pointerdown", (event) => {
          startDotDrag(event, { isoDate: iso, dotId, sticker, mode: "year" });
        });
        dotLayer.appendChild(sticker);
      });
      row.appendChild(dotLayer);

      const note = getDayNote(iso);
      if (activeNoteEdit === iso) {
        row.appendChild(buildNoteEditor(iso, "day-note", null));
      } else if (note) {
        const noteNode = document.createElement("span");
        noteNode.className = "day-note";
        noteNode.textContent = note;
        row.appendChild(noteNode);
      }

      if (!isEditingThisDay) {
        row.addEventListener("click", (event) => {
          if (Date.now() < suppressDayOpenUntil) return;
          if (activePopover && activePopover.isoDate !== iso) {
            closePopover();
            return;
          }
          openPopover(iso, event.clientX, event.clientY, null);
        });
      }
      column.appendChild(row);
    }

    yearGrid.appendChild(column);
  }
}

export function renderMonthGrid() {
  const selectedMonthDate = startOfMonth(new Date(state.monthCursor));
  const currentMonthDate = startOfMonth(new Date());
  const todayIso = formatISODate(new Date());
  const previousScrollTop = monthGrid.scrollTop;
  monthGrid.innerHTML = "";
  monthGrid.classList.add("month-scroll-list");

  const buildMonthCell = (day, monthIso) => {
    const isEditingThisDay =
      activeNoteEdit === day.iso &&
      (!activeNoteEditMonthIso || activeNoteEditMonthIso === monthIso);
    const cell = document.createElement(isEditingThisDay ? "div" : "button");
    if (!isEditingThisDay) cell.type = "button";
    cell.className = "month-day";
    if (day.iso === todayIso) cell.classList.add("current-day");
    if (!day.inCurrentMonth) cell.classList.add("muted-day");
    cell.dataset.date = day.iso;

    const dayLabel = document.createElement("div");
    dayLabel.className = "month-day-label";
    dayLabel.textContent = `${String(day.date.getDate()).padStart(2, "0")} ${weekdayShort(day.date)}`;
    cell.appendChild(dayLabel);

    const dotLayer = document.createElement("div");
    dotLayer.className = "dot-layer";
    const dayDotIds = getDayDotIds(day.iso);
    const resolvedPositions = resolveDotPositionsForDay({
      isoDate: day.iso,
      dotIds: dayDotIds,
      mode: "month",
      getBasePosition: (dotId) => getDotPosition(day.iso, dotId, "month"),
      isLocked: (dotId) => Boolean(state.dotPositions?.[day.iso]?.[dotId])
    });
    dayDotIds.forEach((dotId) => {
      const dotType = state.dotTypes.find((t) => t.id === dotId);
      if (!dotType) return;
      const sticker = document.createElement("span");
      sticker.className = "dot-sticker";
      sticker.style.background = dotType.color;
      const pos = resolvedPositions.get(dotId) || getDotPosition(day.iso, dotId, "month");
      sticker.style.left = `${pos.left}%`;
      sticker.style.top = `${pos.top}%`;
      sticker.style.transform = `translate(-50%, -50%) rotate(${pos.rotate}deg)`;
      sticker.title = `${dotType.name} (drag to move)`;
      sticker.addEventListener("pointerdown", (event) => {
        startDotDrag(event, { isoDate: day.iso, dotId, sticker, mode: "month" });
      });
      dotLayer.appendChild(sticker);
    });
    cell.appendChild(dotLayer);

    const note = getDayNote(day.iso);
    if (isEditingThisDay) {
      cell.appendChild(buildNoteEditor(day.iso, "month-note", monthIso));
    } else if (note) {
      const noteNode = document.createElement("span");
      noteNode.className = "month-note";
      noteNode.textContent = note;
      cell.appendChild(noteNode);
    }

    if (!isEditingThisDay) {
      cell.addEventListener("click", (event) => {
        if (Date.now() < suppressDayOpenUntil) return;
        if (activePopover && activePopover.isoDate !== day.iso) {
          closePopover();
          return;
        }
        openPopover(day.iso, event.clientX, event.clientY, monthIso);
      });
    }
    return cell;
  };

  const monthsToRender = Math.max(loadedMobileMonthCount, monthDiff(currentMonthDate, selectedMonthDate) + 1);

  const monthSections = [];
  for (let i = 0; i < monthsToRender; i += 1) {
    const monthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - i, 1);
    const monthIso = startOfMonth(monthDate).toISOString();

    const section = document.createElement("section");
    section.className = "month-scroll-section";
    section.dataset.monthIso = monthIso;

    const title = document.createElement("h3");
    title.className = "month-scroll-title";
    title.textContent = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    section.appendChild(title);

    const daysWrap = document.createElement("div");
    daysWrap.className = "month-scroll-days";
    const days = buildMonthCells(monthDate, state.weekStartsMonday);
    days.forEach((day) => {
      daysWrap.appendChild(buildMonthCell(day, monthIso));
    });
    section.appendChild(daysWrap);
    monthSections.push(section);
  }

  for (let i = monthSections.length - 1; i >= 0; i -= 1) {
    monthGrid.appendChild(monthSections[i]);
  }

  if (!monthGrid.dataset.scrollListenerAttached) {
    monthGrid.dataset.scrollListenerAttached = "1";
    monthGrid.addEventListener(
      "scroll",
      () => {
        if (!isMobileView()) return;
        const sections = monthGrid.querySelectorAll(".month-scroll-section");
        const containerRect = monthGrid.getBoundingClientRect();
        let nearest = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        sections.forEach((section) => {
          const rect = section.getBoundingClientRect();
          const distance = Math.abs(rect.top - containerRect.top);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = section;
          }
        });
        if (!nearest?.dataset.monthIso) return;
        const monthDate = new Date(nearest.dataset.monthIso);
        state.monthCursor = startOfMonth(monthDate).toISOString();
        state.yearCursor = monthDate.getFullYear();
        periodPickerLabel.textContent = monthDate.toLocaleDateString(undefined, {
          month: "short",
          year: "numeric"
        });
        updateTodayButtonVisibility();

        const nearTop = monthGrid.scrollTop <= 80;
        if (nearTop && !periodLoadInProgress) {
          periodLoadInProgress = true;
          const previousHeight = monthGrid.scrollHeight;
          const previousTop = monthGrid.scrollTop;
          loadedMobileMonthCount += MOBILE_MONTH_BATCH_SIZE;
          requestRender(() => {
            const addedHeight = monthGrid.scrollHeight - previousHeight;
            monthGrid.scrollTop = previousTop + Math.max(0, addedHeight);
            periodLoadInProgress = false;
          });
        }
      },
      { passive: true }
    );
  }

  const initialAnchorIso = !hasInitializedMobileMonthScroll ? selectedMonthDate.toISOString() : null;
  const targetAnchorIso = pendingMobileMonthAnchorIso || initialAnchorIso;
  if (targetAnchorIso) {
    requestAnimationFrame(() => {
      const target = monthGrid.querySelector(`[data-month-iso="${targetAnchorIso}"]`);
      if (target) {
        target.scrollIntoView({ block: "start" });
      } else {
        monthGrid.scrollTop = previousScrollTop;
      }
      hasInitializedMobileMonthScroll = true;
      pendingMobileMonthAnchorIso = null;
    });
  } else {
    monthGrid.scrollTop = previousScrollTop;
  }
}

export function scrollToToday() {
  const today = new Date();
  const todayMonth = startOfMonth(today);

  state.monthCursor = todayMonth.toISOString();
  state.yearCursor = todayMonth.getFullYear();
  closePeriodMenu();
  periodPickerLabel.textContent = todayMonth.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric"
  });

  if (isMobileView() && monthGrid?.classList.contains("month-scroll-list")) {
    pendingMobileMonthAnchorIso = null;
    const lastSection = monthGrid.querySelector(".month-scroll-section:last-of-type");
    if (lastSection) {
      lastSection.scrollIntoView({ block: "end", behavior: "smooth" });
    }
    requestAnimationFrame(() => {
      monthGrid.scrollTop = Math.max(0, monthGrid.scrollHeight - monthGrid.clientHeight);
      updateTodayButtonVisibility();
    });
    return;
  }

  saveAndRender();
}

function resolveDotPositionsForDay({ isoDate, dotIds, mode, getBasePosition, isLocked }) {
  const resolved = new Map();
  if (!Array.isArray(dotIds) || dotIds.length <= 1) return resolved;

  const spacing = DOT_SPACING_BY_MODE[mode] || DOT_SPACING_BY_MODE.year;
  const clamped = (left, top) => ({
    left: clamp(left, DOT_BOUNDS.minLeft, DOT_BOUNDS.maxLeft),
    top: clamp(top, DOT_BOUNDS.minTop, DOT_BOUNDS.maxTop)
  });
  const distanceToClosest = (candidate) => {
    const points = [...resolved.values()];
    if (points.length === 0) return Number.POSITIVE_INFINITY;
    return points.reduce((min, placed) => {
      const dx = placed.left - candidate.left;
      const dy = placed.top - candidate.top;
      return Math.min(min, Math.hypot(dx, dy));
    }, Number.POSITIVE_INFINITY);
  };

  const makeCandidates = (base) =>
    DOT_CANDIDATE_OFFSETS.map(([ox, oy]) => {
      const point = clamped(base.left + ox * spacing, base.top + oy * spacing);
      return { ...base, left: point.left, top: point.top };
    });

  dotIds.forEach((dotId) => {
    if (!isLocked(dotId)) return;
    resolved.set(dotId, getBasePosition(dotId));
  });

  dotIds.forEach((dotId) => {
    if (resolved.has(dotId)) return;
    const base = getBasePosition(dotId);
    const candidates = makeCandidates(base);
    let best = candidates[0];
    let bestClearance = distanceToClosest(best);

    candidates.forEach((candidate) => {
      const clearance = distanceToClosest(candidate);
      if (clearance >= spacing && bestClearance < spacing) {
        best = candidate;
        bestClearance = clearance;
        return;
      }
      if ((clearance >= spacing && bestClearance >= spacing) || (clearance < spacing && bestClearance < spacing)) {
        const bestDist = Math.hypot(best.left - base.left, best.top - base.top);
        const candidateDist = Math.hypot(candidate.left - base.left, candidate.top - base.top);
        if (
          clearance > bestClearance + 0.01 ||
          (Math.abs(clearance - bestClearance) < 0.01 && candidateDist < bestDist)
        ) {
          best = candidate;
          bestClearance = clearance;
        }
      }
    });

    resolved.set(dotId, best);
  });

  return resolved;
}

export function renderMarketingCalendar() {
  if (!marketingCalendar || !marketingYear || !marketingMonth) return;
  const demoState = createDemoState();
  const year = demoState.yearCursor;
  const todayIso = formatISODate(new Date());
  marketingYear.innerHTML = "";
  marketingMonth.innerHTML = "";

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const column = document.createElement("section");
    column.className = "month-column";
    if (new Date(year, monthIndex + 1, 0).getDate() === 31) {
      column.classList.add("month-31");
    }

    const monthTitle = document.createElement("h3");
    monthTitle.className = "month-title";
    monthTitle.textContent = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long" });
    column.appendChild(monthTitle);

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let dayNum = 1; dayNum <= 31; dayNum += 1) {
      if (dayNum > daysInMonth) {
        const filler = document.createElement("div");
        filler.className = "year-day filler";
        column.appendChild(filler);
        continue;
      }

      const date = new Date(year, monthIndex, dayNum);
      const iso = formatISODate(date);
      const row = document.createElement("div");
      row.className = "year-day";
      if (iso === todayIso) row.classList.add("current-day");

      const label = document.createElement("span");
      label.className = "day-label";
      label.textContent = `${String(dayNum).padStart(2, "0")} ${weekdayShort(date)}`;
      row.appendChild(label);

      const dotLayer = document.createElement("div");
      dotLayer.className = "dot-layer";
      (demoState.dayDots[iso] || []).forEach((dotId) => {
        const dotType = demoState.dotTypes.find((t) => t.id === dotId);
        if (!dotType) return;
        const sticker = document.createElement("span");
        sticker.className = "dot-sticker";
        sticker.style.background = dotType.color;
        const pos = getDemoDotPosition(demoState, iso, dotId);
        sticker.style.left = `${pos.left}%`;
        sticker.style.top = `${pos.top}%`;
        sticker.style.transform = `translate(-50%, -50%) rotate(${pos.rotate}deg)`;
        dotLayer.appendChild(sticker);
      });
      row.appendChild(dotLayer);

      const note = demoState.dayNotes[iso];
      if (note) {
        const noteNode = document.createElement("span");
        noteNode.className = "day-note";
        noteNode.textContent = note;
        row.appendChild(noteNode);
      }

      column.appendChild(row);
    }

    marketingYear.appendChild(column);
  }

  renderMarketingMonth(demoState);
}

export function renderMarketingMonth(demoState) {
  const monthDate = startOfMonth(new Date());
  const days = buildMonthCells(monthDate, demoState.weekStartsMonday);
  const todayIso = formatISODate(new Date());
  marketingMonth.innerHTML = "";

  for (const day of days) {
    const cell = document.createElement("div");
    cell.className = "month-day";
    if (day.iso === todayIso) cell.classList.add("current-day");
    if (!day.inCurrentMonth) cell.classList.add("muted-day");

    const dayLabel = document.createElement("div");
    dayLabel.className = "month-day-label";
    dayLabel.textContent = `${String(day.date.getDate()).padStart(2, "0")} ${weekdayShort(day.date)}`;
    cell.appendChild(dayLabel);

    const dotLayer = document.createElement("div");
    dotLayer.className = "dot-layer";
    (demoState.dayDots[day.iso] || []).forEach((dotId) => {
      const dotType = demoState.dotTypes.find((t) => t.id === dotId);
      if (!dotType) return;
      const sticker = document.createElement("span");
      sticker.className = "dot-sticker";
      sticker.style.background = dotType.color;
      const pos = getDemoDotPosition(demoState, day.iso, dotId);
      sticker.style.left = `${pos.left}%`;
      sticker.style.top = `${pos.top}%`;
      sticker.style.transform = `translate(-50%, -50%) rotate(${pos.rotate}deg)`;
      dotLayer.appendChild(sticker);
    });
    cell.appendChild(dotLayer);

    const note = demoState.dayNotes[day.iso];
    if (note) {
      const noteNode = document.createElement("span");
      noteNode.className = "month-note";
      noteNode.textContent = note;
      cell.appendChild(noteNode);
    }

    marketingMonth.appendChild(cell);
  }
}

export function renderDotTypeList(targetList = dotTypeList) {
  if (!targetList) return;
  targetList.innerHTML = "";

  if (state.dotTypes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML = "You don’t have any dot types yet";
    targetList.appendChild(empty);
  }

  state.dotTypes.forEach((dotType) => {
    const item = document.createElement("li");
    item.className = "dot-type-row";

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = dotType.color;

    const inputWrap = document.createElement("div");
    inputWrap.className = "dot-input-wrap";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = dotType.name;
    nameInput.maxLength = DOT_NAME_MAX_LENGTH;
    nameInput.setAttribute("aria-label", "Dot meaning");
    nameInput.className = "dot-name-input";
    syncDotTypeInputSize(nameInput);
    nameInput.addEventListener("input", () => {
      syncDotTypeInputSize(nameInput);
    });
    nameInput.addEventListener("focus", () => {
      nameInput.select();
    });
    nameInput.addEventListener("click", () => {
      nameInput.select();
    });
    nameInput.addEventListener("change", () => {
      const nextName = normalizeDotTypeName(nameInput.value) || dotType.name;
      const changed = nextName !== dotType.name;
      dotType.name = nextName;
      nameInput.value = nextName;
      syncDotTypeInputSize(nameInput);
      saveAndRender();
      if (changed) {
        showToast(`Renamed dot to "${nextName}".`);
      }
    });
    if (pendingFocusDotId === dotType.id) {
      requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
      });
      pendingFocusDotId = null;
    }

    const colorPicker = buildColorPicker(dotType, swatch);
    swatch.addEventListener("click", (event) => {
      event.stopPropagation();
      openColorPicker(colorPicker);
    });

    const inUse = isDotTypeInUse(dotType.id);

    const actions = document.createElement("div");
    actions.className = "dot-actions";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "dot-actions-toggle";
    toggle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M5 8.5C5.82843 8.5 6.5 9.17157 6.5 10C6.5 10.8284 5.82843 11.5 5 11.5C4.17157 11.5 3.5 10.8284 3.5 10C3.5 9.17157 4.17157 8.5 5 8.5Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M10 8.5C10.8284 8.5 11.5 9.17157 11.5 10C11.5 10.8284 10.8284 11.5 10 11.5C9.17157 11.5 8.5 10.8284 8.5 10C8.5 9.17157 9.17157 8.5 10 8.5Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M15 8.5C15.8284 8.5 16.5 9.17157 16.5 10C16.5 10.8284 15.8284 11.5 15 11.5C14.1716 11.5 13.5 10.8284 13.5 10C13.5 9.17157 14.1716 8.5 15 8.5Z" fill="currentColor"/>
      </svg>
    `;
    toggle.setAttribute("aria-label", "More actions");

    const menu = document.createElement("div");
    menu.className = "dot-actions-menu hidden";
    menu.dataset.portal = "dot-actions";

    const renameItem = document.createElement("button");
    renameItem.type = "button";
    renameItem.className = "dot-actions-item";
    renameItem.textContent = "Rename";
    renameItem.addEventListener("click", () => {
      closeDotMenus();
      nameInput.focus();
      nameInput.select();
    });

    const deleteItem = document.createElement("button");
    deleteItem.type = "button";
    deleteItem.className = "dot-actions-item";
    deleteItem.textContent = "Delete";
    deleteItem.addEventListener("click", () => {
      promptDeleteDotType(dotType.id, dotType.name);
      closeDotMenus();
    });

    const colorItem = document.createElement("button");
    colorItem.type = "button";
    colorItem.className = "dot-actions-item";
    colorItem.textContent = "Change color";
    colorItem.addEventListener("click", () => {
      closeDotMenus();
      openColorPicker(colorPicker);
    });

    const permanentDeleteItem = document.createElement("button");
    permanentDeleteItem.type = "button";
    permanentDeleteItem.className = "dot-actions-item danger-solid";
    permanentDeleteItem.textContent = "Permanently Delete";
    permanentDeleteItem.addEventListener("click", () => {
      promptPermanentDeleteDotType(dotType.id, dotType.name);
      closeDotMenus();
    });

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = menu.classList.contains("hidden");
      closeDotMenus();
      item.classList.toggle("menu-open", opening);
      if (opening) {
        showAnimated(menu);
        requestAnimationFrame(() => {
          if (!window.matchMedia("(max-width: 480px)").matches) {
            positionDotActionsMenu(menu);
          } else {
            menu.style.removeProperty("--menu-offset-x");
            menu.style.removeProperty("--menu-offset-y");
            if (mobileMenuPortal && !menu.dataset.portalActive) {
              menu.dataset.portalActive = "true";
              menu._portalParent = actions;
              mobileMenuPortal.appendChild(menu);
            }
          }
          updateMenuScrim();
        });
      } else {
        menu.classList.add("hidden");
        updateMenuScrim();
      }
    });

    if (inUse) {
      menu.append(renameItem, colorItem, permanentDeleteItem);
    } else {
      menu.append(renameItem, colorItem, deleteItem);
    }
    actions.append(toggle, menu);
    inputWrap.append(nameInput, actions);
    item.append(swatch, inputWrap, colorPicker);
    targetList.appendChild(item);
  });

  if (targetList === dotTypeList && state.hideSuggestions) {
    const addItem = document.createElement("li");
    addItem.className = "dot-type-add-item";
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "suggestion-chip add-new";
    addButton.textContent = "Add New";
    addButton.addEventListener("click", addNewDotType);
    addItem.appendChild(addButton);
    targetList.appendChild(addItem);
  }
}

export function renderSuggestedDotTypes(targetList = suggestedDotList) {
  if (!targetList) return;
  targetList.innerHTML = "";

  shuffledSuggestions.forEach((suggestion) => {
    if (hasDotTypeName(suggestion.name)) return;

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.innerHTML = `<span class="swatch" style="background:${suggestion.color}"></span><span>${suggestion.name}</span>`;
    chip.addEventListener("click", () => addSuggestedDotType(suggestion));
    targetList.appendChild(chip);
  });

  const addNewChip = document.createElement("button");
  addNewChip.type = "button";
  addNewChip.className = "suggestion-chip add-new";
  addNewChip.textContent = "Add New";
  addNewChip.addEventListener("click", addNewDotType);
  targetList.appendChild(addNewChip);
}

export function openPopover(isoDate, x, y, contextMonthIso = null) {
  if (popoverHideTimer) {
    clearTimeout(popoverHideTimer);
    popoverHideTimer = null;
  }
  const shouldAnimateIn = popover.classList.contains("hidden");
  activePopover = { isoDate, contextMonthIso };
  activeNoteEdit = null;
  document.body.classList.add("popover-open");
  popover.innerHTML = "";

  const selectedIds = new Set(getDayDotIds(isoDate));

  if (window.matchMedia("(max-width: 480px)").matches) {
    const header = document.createElement("h1");
    header.className = "popover-date";
    const date = new Date(isoDate);
    const parts = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short"
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    header.textContent = `${byType.weekday} ${byType.day} ${byType.month}`;
    popover.appendChild(header);
  }

  if (state.dotTypes.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "Add a dot type first.";
    empty.className = "muted";
    empty.style.padding = "8px";
    popover.appendChild(empty);
  }

  state.dotTypes.forEach((dotType) => {
    const node = popoverItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".swatch").style.background = dotType.color;
    node.querySelector(".label").textContent = dotType.name;
    if (selectedIds.has(dotType.id)) {
      node.classList.add("selected");
    }

    node.addEventListener("click", () => {
      const wasSelected = selectedIds.has(dotType.id);
      toggleDot(isoDate, dotType.id);
      if (wasSelected) {
        openPopover(isoDate, x, y, contextMonthIso);
      } else {
        closePopover();
      }
    });

    popover.appendChild(node);
  });

  const noteWrap = document.createElement("div");
  noteWrap.className = "popover-note";
  const addDotTypeButton = document.createElement("button");
  addDotTypeButton.type = "button";
  addDotTypeButton.className = "note-edit-button";
  addDotTypeButton.textContent = "Add dot type";
  addDotTypeButton.addEventListener("click", () => {
    closePopover();
    addNewDotType();
    openSettingsModal();
  });
  const noteButton = document.createElement("button");
  noteButton.type = "button";
  noteButton.className = "note-edit-button";
  noteButton.textContent = getDayNote(isoDate) ? "Edit note" : "Add note";
  noteButton.addEventListener("click", () => {
    closePopover();
    startNoteEdit(isoDate, contextMonthIso);
  });
  noteWrap.append(addDotTypeButton, noteButton);
  popover.appendChild(noteWrap);

  popover.classList.remove("hidden");
  const isSmallScreen = window.matchMedia("(max-width: 480px)").matches;
  if (isSmallScreen) {
    popover.style.left = "";
    popover.style.top = "";
  } else {
    const maxX = window.innerWidth - popover.offsetWidth - 8;
    const maxY = window.innerHeight - popover.offsetHeight - 8;
    popover.style.left = `${clamp(x, 8, maxX)}px`;
    popover.style.top = `${clamp(y, 8, maxY)}px`;
  }
  if (shouldAnimateIn) {
    showAnimated(popover);
  } else {
    popover.classList.add("visible");
  }
  showPopoverScrim();
}

export function closePopover() {
  activePopover = null;
  document.body.classList.remove("popover-open");
  if (popoverHideTimer) {
    clearTimeout(popoverHideTimer);
    popoverHideTimer = null;
  }
  popover.classList.remove("visible");
  popoverHideTimer = window.setTimeout(() => {
    popover.classList.add("hidden");
    popoverHideTimer = null;
  }, POPOVER_ANIMATION_MS);
  hidePopoverScrim();
}

export function showPopoverScrim() {
  if (!popoverScrim) return;
  popoverScrim.classList.remove("hidden");
  requestAnimationFrame(() => {
    popoverScrim.classList.add("visible");
  });
}

export function hidePopoverScrim() {
  if (!popoverScrim) return;
  popoverScrim.classList.remove("visible");
  window.setTimeout(() => {
    popoverScrim.classList.add("hidden");
  }, POPOVER_ANIMATION_MS);
}

export function startNoteEdit(isoDate, contextMonthIso = null) {
  activeNoteEdit = isoDate;
  activeNoteEditMonthIso = contextMonthIso;
  requestRender(() => {
    requestAnimationFrame(() => {
      const scopedSelector = contextMonthIso
        ? `[data-note-editor="${isoDate}"][data-note-month="${contextMonthIso}"]`
        : null;
      const visibleContainer = isMobileView() ? monthGrid : yearGrid;
      const containerSelector = `[data-note-editor="${isoDate}"]`;
      const fallbackSelector = `[data-note-editor="${isoDate}"]`;
      const editor =
        (scopedSelector && document.querySelector(scopedSelector)) ||
        visibleContainer?.querySelector(containerSelector) ||
        document.querySelector(fallbackSelector);
      if (!editor) return;
      editor.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.addRange(range);
      }
    });
  });
}

export function finishNoteEdit(isoDate, editor) {
  activeNoteEdit = null;
  activeNoteEditMonthIso = null;
  setDayNote(isoDate, editor.textContent || "");
}

export function buildNoteEditor(isoDate, baseClass, monthIso = null) {
  const editor = document.createElement("div");
  editor.className = `${baseClass} note-editor`;
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.dataset.noteEditor = isoDate;
  if (monthIso) editor.dataset.noteMonth = monthIso;
  editor.textContent = getDayNote(isoDate);
  editor.addEventListener("input", (event) => {
    event.stopPropagation();
  });
  editor.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      finishNoteEdit(isoDate, editor);
      editor.blur();
    }
  });
  editor.addEventListener("blur", () => {
    finishNoteEdit(isoDate, editor);
  });
  editor.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  editor.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  return editor;
}

export function toggleDot(isoDate, dotId) {
  const ids = new Set(getDayDotIds(isoDate));
  if (ids.has(dotId)) {
    ids.delete(dotId);
    clearDotPosition(isoDate, dotId);
  } else ids.add(dotId);

  if (ids.size === 0) {
    delete state.dayDots[isoDate];
  } else {
    state.dayDots[isoDate] = [...ids];
  }

  saveAndRender();
}

export function deleteDotType(dotId) {
  if (isDotTypeInUse(dotId)) return;

  state.dotTypes = state.dotTypes.filter((d) => d.id !== dotId);

  for (const [iso, ids] of Object.entries(state.dayDots)) {
    const next = ids.filter((id) => id !== dotId);
    clearDotPosition(iso, dotId);
    if (next.length === 0) delete state.dayDots[iso];
    else state.dayDots[iso] = next;
  }

  saveAndRender();
}

export function promptDeleteDotType(dotId, dotName) {
  if (isDotTypeInUse(dotId)) return;
  pendingDeleteDotTypeId = dotId;
  pendingDeleteDotTypeName = dotName;
  pendingDeleteMode = "safe";
  deleteText.textContent = "You haven’t used this dot yet.";
  deleteModal.classList.remove("hidden");
}

export function promptPermanentDeleteDotType(dotId, dotName) {
  pendingDeleteDotTypeId = dotId;
  pendingDeleteDotTypeName = dotName;
  pendingDeleteMode = "force";
  deleteText.textContent = `This will remove “${dotName}” from all days it is already applied to and delete it from your dot types.`;
  deleteModal.classList.remove("hidden");
}

export function closeDeleteModal() {
  pendingDeleteDotTypeId = null;
  pendingDeleteDotTypeName = "";
  pendingDeleteMode = "safe";
  deleteModal.classList.add("hidden");
}

export function confirmDeleteDotType() {
  if (!pendingDeleteDotTypeId) return;
  if (pendingDeleteMode === "force") {
    forceDeleteDotType(pendingDeleteDotTypeId);
    showToast(`Permanently deleted "${pendingDeleteDotTypeName}".`);
  } else {
    deleteDotType(pendingDeleteDotTypeId);
    showToast(`Deleted "${pendingDeleteDotTypeName}".`);
  }
  closeDeleteModal();
}

export function forceDeleteDotType(dotId) {
  state.dotTypes = state.dotTypes.filter((d) => d.id !== dotId);

  for (const [iso, ids] of Object.entries(state.dayDots)) {
    const next = ids.filter((id) => id !== dotId);
    clearDotPosition(iso, dotId);
    if (next.length === 0) delete state.dayDots[iso];
    else state.dayDots[iso] = next;
  }

  saveAndRender();
}

export function closeSettingsModal() {
  if (settingsModalHideTimer) {
    clearTimeout(settingsModalHideTimer);
    settingsModalHideTimer = null;
  }
  settingsModal.classList.remove("visible");
  settingsModalHideTimer = window.setTimeout(() => {
    settingsModal.classList.add("hidden");
    settingsModalHideTimer = null;
  }, MODAL_ANIMATION_MS);
  closeDotMenus();
}

export function openSettingsModal() {
  if (settingsModalHideTimer) {
    clearTimeout(settingsModalHideTimer);
    settingsModalHideTimer = null;
  }
  showAnimated(settingsModal);
}

export function closePeriodMenu() {
  periodPickerMenu.classList.remove("visible");
  periodPickerMenu.classList.add("hidden");
  updateMenuScrim();
}

export function openPeriodMenu() {
  showAnimated(periodPickerMenu);
  updateMenuScrim();
}

export function addSuggestedDotType(suggestion) {
  if (hasDotTypeName(suggestion.name)) return;
  state.dotTypes.push({
    id: crypto.randomUUID(),
    name: suggestion.name,
    color: suggestion.color
  });
  saveAndRender();
  showToast(`Added "${suggestion.name}".`);
}

export function addNewDotType() {
  const dotId = crypto.randomUUID();
  const dotName = "New Dot";
  state.dotTypes.push({
    id: dotId,
    name: dotName,
    color: getNextSuggestedColor()
  });
  pendingFocusDotId = dotId;
  saveAndRender();
  showToast(`Added "${dotName}".`);
}

export function hasDotTypeName(name) {
  const target = normalizeDotTypeName(name).toLowerCase();
  return state.dotTypes.some((dot) => normalizeDotTypeName(dot.name).toLowerCase() === target);
}

function normalizeDotTypeName(name) {
  return String(name || "")
    .trim()
    .slice(0, DOT_NAME_MAX_LENGTH);
}

export function getNextSuggestedColor() {
  for (const suggestion of SUGGESTED_DOT_TYPES) {
    if (!state.dotTypes.some((dot) => dot.color.toLowerCase() === suggestion.color.toLowerCase())) {
      return suggestion.color;
    }
  }
  return "#000000";
}

export function isDotTypeInUse(dotId) {
  return Object.values(state.dayDots).some((ids) => ids.includes(dotId));
}

export function handlePeriodPickerScroll() {
  if (periodPickerMenu.classList.contains("hidden")) return;
  const threshold = 24;
  const nearBottom =
    periodPickerMenu.scrollTop + periodPickerMenu.clientHeight >= periodPickerMenu.scrollHeight - threshold;
  if (!nearBottom || periodLoadInProgress) return;

  periodLoadInProgress = true;
  const previousScrollTop = periodPickerMenu.scrollTop;
  if (isMobileView()) loadedMobileMonthCount += MOBILE_MONTH_BATCH_SIZE;
  else loadedYearBatchCount += 1;
  renderPeriodPicker(true, previousScrollTop);
  requestAnimationFrame(() => {
    periodLoadInProgress = false;
  });
}

export function setupMobileMonthScroll() {
  if (monthScrollAttached || !monthGrid) return;
  monthScrollAttached = true;
}

export function dismissPopoverFromScrim(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  closePopover();
  suppressDayOpenUntil = Date.now() + 250;
}

export function handleGlobalPointerDown(event) {
  if (!event.target.closest(".period-picker")) {
    closePeriodMenu();
  }
  if (!event.target.closest(".dot-actions, .dot-actions-menu")) {
    closeDotMenus();
  }
  if (!event.target.closest(".color-picker, .swatch")) {
    closeColorPickers();
  }
  if (!settingsModal.classList.contains("hidden") && event.target === settingsModal) {
    closeSettingsModal();
    return;
  }
  if (!deleteModal.classList.contains("hidden") && event.target === deleteModal) {
    closeDeleteModal();
    return;
  }
  if (!activePopover) return;
  const insidePopover = popover.contains(event.target);
  const clickedDay = event.target.closest(".year-day, .month-day");
  if (!insidePopover && clickedDay) {
    closePopover();
    suppressDayOpenUntil = Date.now() + 200;
    return;
  }
  if (!insidePopover && !clickedDay) {
    closePopover();
  }
}

export function handleGlobalKeyDown(event) {
  const target = event.target;
  const isEditableTarget =
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT");

  const isSettingsShortcut = (event.metaKey || event.ctrlKey) && event.key === ",";
  if (isSettingsShortcut && !isEditableTarget) {
    event.preventDefault();
    closePopover();
    openSettingsModal();
    return;
  }

  const isNoteShortcut =
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !isEditableTarget &&
    activePopover &&
    event.key.toLowerCase() === "n";
  if (isNoteShortcut) {
    event.preventDefault();
    const { isoDate, contextMonthIso } = activePopover;
    closePopover();
    startNoteEdit(isoDate, contextMonthIso || null);
    return;
  }

  if (event.key !== "Escape") return;
  closePopover();
  closePeriodMenu();
  closeSettingsModal();
  closeDeleteModal();
}

export function showOnboardingIfNeeded() {
  if (!hasEnteredApp) return;
  if (DEMO_MODE) return;
  try {
    if (localStorage.getItem(ONBOARDING_KEY) === "1") return;
    showOnboardingStep("intro");
    onboardingModal?.classList.remove("hidden");
  } catch {
    // Ignore storage access issues.
  }
}

export function showOnboardingStep(step) {
  onboardingModal?.querySelectorAll(".onboarding-step").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.step !== step);
  });
  onboardingModal?.querySelectorAll(".onboarding-dot").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.step === step);
  });
  if (step === "dots") {
    renderOnboardingLists();
  }
}

export function closeOnboardingModal() {
  onboardingModal?.classList.add("hidden");
}

export function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore
  }
  closeOnboardingModal();
}

export function renderOnboardingLists() {
  renderDotTypeList(onboardingDotTypeList);
  renderSuggestedDotTypes(onboardingSuggestedDotList);
}

export function enterApp({ skipOnboarding = false } = {}) {
  hasEnteredApp = true;
  loginMode = false;
  try {
    localStorage.setItem(APP_ENTRY_KEY, "1");
    localStorage.setItem(VIEW_MODE_KEY, "app");
  } catch {
    // ignore
  }
  marketingPage?.classList.add("hidden");
  appShell?.classList.remove("hidden");
  if (skipOnboarding) {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    closeOnboardingModal();
  } else {
    showOnboardingIfNeeded();
  }
}

export function startDotDrag(event, { isoDate, dotId, sticker, mode }) {
  event.preventDefault();
  event.stopPropagation();

  const parent = sticker.parentElement;
  if (!parent) return;
  const pointerId = event.pointerId;
  let moved = false;

  const updatePosition = (pointerEvent) => {
    const rect = parent.getBoundingClientRect();
    const nextLeft = clamp(((pointerEvent.clientX - rect.left) / rect.width) * 100, 6, 94);
    const nextTop = clamp(((pointerEvent.clientY - rect.top) / rect.height) * 100, 12, 88);
    const current = getDotPosition(isoDate, dotId, mode);
    sticker.style.left = `${nextLeft}%`;
    sticker.style.top = `${nextTop}%`;
    sticker.style.transform = `translate(-50%, -50%) rotate(${current.rotate}deg)`;
    moved = true;
    return { nextLeft, nextTop };
  };

  let last = null;
  const onMove = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    last = updatePosition(moveEvent);
  };

  const onUp = (upEvent) => {
    if (upEvent.pointerId !== pointerId) return;
    sticker.removeEventListener("pointermove", onMove);
    sticker.removeEventListener("pointerup", onUp);
    sticker.removeEventListener("pointercancel", onUp);
    if (moved && last) {
      saveDotPosition(isoDate, dotId, last.nextLeft, last.nextTop);
      saveAndRender();
      suppressDayOpenUntil = Date.now() + 250;
    }
  };

  sticker.setPointerCapture(pointerId);
  sticker.addEventListener("pointermove", onMove);
  sticker.addEventListener("pointerup", onUp);
  sticker.addEventListener("pointercancel", onUp);
}

export function closeDotMenus() {
  document.querySelectorAll(".dot-type-row.menu-open").forEach((row) => {
    row.classList.remove("menu-open");
  });
  document.querySelectorAll(".dot-actions-menu").forEach((menu) => {
    menu.classList.remove("visible");
    menu.classList.add("hidden");
    menu.style.removeProperty("--menu-offset-x");
    menu.style.removeProperty("--menu-offset-y");
    if (menu.dataset.portalActive === "true" && menu._portalParent) {
      menu._portalParent.appendChild(menu);
      menu.dataset.portalActive = "";
    }
  });
  updateMenuScrim();
}

export function closeColorPickers() {
  document.querySelectorAll(".color-picker").forEach((picker) => {
    picker.classList.remove("visible");
    picker.classList.add("hidden");
    if (picker._hostRow) {
      picker._hostRow.classList.remove("menu-open");
      picker._hostRow = null;
    }
    if (picker.dataset.portalActive === "true" && picker._portalParent) {
      picker._portalParent.appendChild(picker);
      picker.dataset.portalActive = "";
    }
  });
  updateMenuScrim();
}

export function openColorPicker(picker) {
  const opening = picker.classList.contains("hidden");
  closeColorPickers();
  if (!opening) return;
  const hostRow = picker.closest(".dot-type-row");
  if (hostRow) {
    hostRow.classList.add("menu-open");
    picker._hostRow = hostRow;
  }
  if (picker._hexInput && picker._currentColor) {
    picker._hexInput.value = picker._currentColor();
  }
  const isMobile = window.matchMedia("(max-width: 480px)").matches;
  if (isMobile && mobileMenuPortal && !picker.dataset.portalActive) {
    picker.dataset.portalActive = "true";
    picker._portalParent = picker.parentElement;
    mobileMenuPortal.appendChild(picker);
  }
  showAnimated(picker);
  updateMenuScrim();
}

export function buildColorPicker(dotType, swatch) {
  const picker = document.createElement("div");
  picker.className = "color-picker hidden";
  picker.dataset.portal = "color-picker";
  picker._currentColor = () => dotType.color;

  const grid = document.createElement("div");
  grid.className = "color-grid";
  const palette = COLOR_PALETTE.filter((color, index, arr) => arr.indexOf(color) === index);
  palette.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-swatch";
    btn.style.background = color;
    btn.setAttribute("aria-label", `Use ${color}`);
    btn.addEventListener("click", () => {
      const changed = dotType.color !== color;
      dotType.color = color;
      saveAndRender();
      if (changed) {
        showToast(`Changed color for "${dotType.name}".`);
      }
      closeColorPickers();
    });
    grid.appendChild(btn);
  });

  const customRow = document.createElement("div");
  customRow.className = "color-custom";

  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.value = dotType.color;
  hexInput.placeholder = "#RRGGBB";
  hexInput.className = "color-hex-input";
  picker._hexInput = hexInput;

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = "Apply";
  applyButton.className = "color-apply";
  applyButton.addEventListener("click", () => {
    const raw = hexInput.value.trim();
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    if (!/^#([0-9a-fA-F]{6})$/.test(normalized)) {
      showToast("Enter a valid hex color.");
      return;
    }
    const changed = dotType.color.toLowerCase() !== normalized.toLowerCase();
    dotType.color = normalized;
    swatch.style.background = normalized;
    saveAndRender();
    if (changed) {
      showToast(`Changed color for "${dotType.name}".`);
    }
    closeColorPickers();
  });

  customRow.append(hexInput, applyButton);
  picker.append(grid, customRow);
  return picker;
}

export function positionDotActionsMenu(menu) {
  const boundaryRect = menu.closest(".settings-card, .modal-card")?.getBoundingClientRect() || {
    left: 8,
    top: 8,
    right: window.innerWidth - 8,
    bottom: window.innerHeight - 8
  };
  const padding = 8;
  const rect = menu.getBoundingClientRect();
  let offsetX = 0;
  let offsetY = 0;

  if (rect.left < boundaryRect.left + padding) {
    offsetX = boundaryRect.left + padding - rect.left;
  } else if (rect.right > boundaryRect.right - padding) {
    offsetX = boundaryRect.right - padding - rect.right;
  }

  if (rect.bottom > boundaryRect.bottom - padding) {
    offsetY = boundaryRect.bottom - padding - rect.bottom;
  }

  menu.style.setProperty("--menu-offset-x", `${offsetX}px`);
  menu.style.setProperty("--menu-offset-y", `${offsetY}px`);
}

export function updateMenuScrim() {
  if (!menuScrim) return;
  const isMobileSheet = window.matchMedia("(max-width: 480px)").matches;
  const hasDotMenu = Boolean(document.querySelector(".dot-actions-menu:not(.hidden)"));
  const hasColorPicker = Boolean(document.querySelector(".color-picker:not(.hidden)"));
  const hasPeriodMenu = !periodPickerMenu.classList.contains("hidden");
  const shouldShow = isMobileSheet && (hasDotMenu || hasPeriodMenu || hasColorPicker);
  if (menuScrimHideTimer) {
    clearTimeout(menuScrimHideTimer);
    menuScrimHideTimer = null;
  }
  if (shouldShow) {
    menuScrim.classList.remove("hidden");
    requestAnimationFrame(() => {
      menuScrim.classList.add("visible");
    });
    return;
  }
  menuScrim.classList.remove("visible");
  menuScrimHideTimer = window.setTimeout(() => {
    menuScrim.classList.add("hidden");
    menuScrimHideTimer = null;
  }, 180);
}

export function showAnimated(element) {
  element.classList.remove("hidden");
  element.classList.remove("visible");
  void element.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add("visible");
    });
  });
}

export function syncDotTypeInputSize(input) {
  const value = input.value || " ";
  const style = window.getComputedStyle(input);
  const sizer = syncDotTypeInputSize._sizer || document.createElement("span");
  if (!syncDotTypeInputSize._sizer) {
    sizer.style.position = "absolute";
    sizer.style.visibility = "hidden";
    sizer.style.whiteSpace = "pre";
    sizer.style.pointerEvents = "none";
    sizer.style.left = "-9999px";
    sizer.style.top = "0";
    document.body.appendChild(sizer);
    syncDotTypeInputSize._sizer = sizer;
  }
  sizer.style.font = style.font;
  sizer.style.letterSpacing = style.letterSpacing;
  sizer.textContent = value;

  const measured = Math.ceil(sizer.getBoundingClientRect().width) + 3;
  input.style.width = `${measured}px`;
}

export function applyTheme() {
  document.documentElement.dataset.theme = isDarkModeEnabled() ? "dark" : "light";
}

export function downloadDataExport() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dot-diary-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Downloaded your data.");
}

export async function handleDataImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const next = normalizeImportedState(parsed?.data ?? parsed);
    setState(next);
    loadedYearBatchCount = 1;
    loadedMobileMonthCount = 24;
    closePeriodMenu();
    closeDotMenus();
    saveAndRender();
    showToast("Imported your data.");
  } catch {
    showToast("Could not import that file.");
  } finally {
    event.target.value = "";
  }
}

export function isDarkModeEnabled() {
  if (typeof state.darkMode === "boolean") {
    return state.darkMode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function handleResetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(AUTH_STATE_KEY);
  } catch {
    // ignore
  }
  closeSettingsModal();
  setState(structuredClone(defaultState));
  saveAndRender();
  resetToLoggedOut();
  showOnboardingIfNeeded();
}

export function setupDevAutoReload() {
  const devHosts = new Set(["localhost", "127.0.0.1"]);
  if (!devHosts.has(window.location.hostname)) return;
  const files = [
    "index.html",
    "styles.css",
    "src/app.js",
    "src/constants.js",
    "src/dom.js",
    "src/utils.js",
    "src/state.js",
    "src/ui.js",
    "src/auth.js",
    "src/toast.js"
  ];
  let lastHash = "";
  const poll = async () => {
    try {
      const contents = await Promise.all(
        files.map((file) =>
          fetch(`${file}?t=${Date.now()}`, { cache: "no-store" })
            .then((response) => (response.ok ? response.text() : ""))
            .catch(() => "")
        )
      );
      const combined = contents.join("||");
      if (!combined) return;
      const nextHash = String(hash32(combined));
      if (lastHash && nextHash !== lastHash) {
        window.location.reload();
        return;
      }
      lastHash = nextHash;
    } catch {
      // ignore polling errors
    }
  };
  poll();
  window.setInterval(poll, 1000);
}
