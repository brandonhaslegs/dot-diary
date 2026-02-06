const STORAGE_KEY = "dot-diary-v1";
const ONBOARDING_KEY = "dot-diary-onboarding-v1";
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
const SUPABASE_URL = "https://onmrtxwqwyqyiicweffy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_E9ZgVOUfB3EWjP1Njm5PJQ_c-maFufE";
const SUGGESTED_DOT_TYPES = [
  { name: "Smoking", color: "#875436" },
  { name: "Drugs", color: "#FF0000" },
  { name: "Alcohol", color: "#FFC700" },
  { name: "Exercise", color: "#15C771" },
  { name: "Went Outside", color: "#B632CC" },
  { name: "Sex", color: "#2F8CFA" },
  { name: "Reading", color: "#FF7A59" },
  { name: "Meditation", color: "#6A4C93" },
  { name: "Cooking", color: "#00A676" },
  { name: "Restful Sleep", color: "#3A86FF" },
  { name: "Journaling", color: "#FB5607" },
  { name: "Sugar", color: "#8338EC" },
  { name: "Watered Plants", color: "#2A9D8F" },
  { name: "Shopping", color: "#E63946" },
  { name: "Studied", color: "#264653" },
  { name: "Therapy", color: "#8D99AE" },
  { name: "Family Time", color: "#F4A261" },
  { name: "Cleaned", color: "#118AB2" },
  { name: "Screentime", color: "#EF476F" },
  { name: "Creative Work", color: "#4CC9F0" },
  { name: "Caffeine", color: "#5C3A21" },
  { name: "Social Media", color: "#0A66C2" },
  { name: "Drawing", color: "#D97706" },
  { name: "Art", color: "#7C3AED" },
  { name: "Music", color: "#0F766E" },
  { name: "Movie", color: "#1D3557" },
  { name: "Exploring", color: "#2F8CFA" },
  { name: "Doomscrolling", color: "#8E9AAF" },
  { name: "Partying", color: "#FF6B6B" },
  { name: "Ate Meat", color: "#8D5524" },
  { name: "Travel", color: "#3D5A80" },
  { name: "Swimming", color: "#48CAE4" }
];

const defaultState = {
  monthCursor: startOfMonth(new Date()).toISOString(),
  yearCursor: new Date().getFullYear(),
  weekStartsMonday: false,
  darkMode: null,
  lastModified: new Date().toISOString(),
  dotTypes: [],
  dayDots: {},
  dotPositions: {},
  dayNotes: {}
};

let state = DEMO_MODE ? createDemoState() : loadState();
let activePopover = null;
let activeNoteEdit = null;
let pendingFocusDotId = null;
let pendingDeleteDotTypeId = null;
let pendingDeleteMode = "safe";
let pendingDeleteDotTypeName = "";
let loadedYearBatchCount = 1;
let loadedMobileMonthCount = 12;
let periodLoadInProgress = false;
let toastTimer = null;
let toastHideTimer = null;
let suppressDayOpenUntil = 0;
let settingsModalHideTimer = null;
let popoverHideTimer = null;
let menuScrimHideTimer = null;
const shuffledSuggestions = shuffleArray(SUGGESTED_DOT_TYPES);
const YEAR_BATCH_SIZE = 10;
const MOBILE_MONTH_BATCH_SIZE = 12;
const MODAL_ANIMATION_MS = 280;
const POPOVER_ANIMATION_MS = 180;
const AUTH_HASH = window.location.hash || "";
const AUTH_STATE_KEY = "dot-diary-authenticated";
const COLOR_PALETTE = [
  "#FF0000",
  "#FFC700",
  "#15C771",
  "#2F8CFA",
  "#B632CC",
  "#875436",
  "#FF7A59",
  "#00A676",
  "#0A66C2",
  "#8338EC",
  "#1D3557",
  "#0F766E"
];

const yearGrid = document.querySelector("#year-grid");
const monthGrid = document.querySelector("#month-grid");
const dotTypeList = document.querySelector("#dot-type-list");
const popover = document.querySelector("#day-popover");
const popoverItemTemplate = document.querySelector("#popover-item-template");
const openSettings = document.querySelector("#open-settings");
const settingsModal = document.querySelector("#settings-modal");
const periodPickerToggle = document.querySelector("#period-picker-toggle");
const periodPickerLabel = document.querySelector("#period-picker-label");
const periodPickerMenu = document.querySelector("#period-picker-menu");
const weekStartMondayInput = document.querySelector("#week-start-monday");
const colorModeLightButton = document.querySelector("#color-mode-light");
const colorModeDarkButton = document.querySelector("#color-mode-dark");
const downloadDataButton = document.querySelector("#download-data");
const uploadDataButton = document.querySelector("#upload-data");
const uploadDataInput = document.querySelector("#upload-data-input");
const suggestedDotList = document.querySelector("#suggested-dot-list");
const deleteModal = document.querySelector("#delete-modal");
const onboardingModal = document.querySelector("#onboarding-modal");
const onboardingNextButton = document.querySelector("#onboarding-next");
const onboardingBackButton = document.querySelector("#onboarding-back");
const onboardingNextDotsButton = document.querySelector("#onboarding-next-dots");
const onboardingBackSyncButton = document.querySelector("#onboarding-back-sync");
const onboardingDoneButton = document.querySelector("#onboarding-done");
const onboardingSkipIntroButton = document.querySelector("#onboarding-skip-intro");
const onboardingSkipButton = document.querySelector("#onboarding-skip");
const onboardingUpgradeButton = document.querySelector("#onboarding-upgrade");
const onboardingEmailInput = document.querySelector("#onboarding-email");
const onboardingSendButton = document.querySelector("#onboarding-send");
const onboardingDotTypeList = document.querySelector("#onboarding-dot-type-list");
const onboardingSuggestedDotList = document.querySelector("#onboarding-suggested-dot-list");
const deleteText = document.querySelector("#delete-text");
const deleteCancel = document.querySelector("#delete-cancel");
const deleteConfirm = document.querySelector("#delete-confirm");
const toast = document.querySelector("#toast");
const appShell = document.querySelector(".app-shell");
const marketingPage = document.querySelector("#marketing-page");
const marketingHero = document.querySelector("#marketing-hero");
const marketingLogin = document.querySelector("#marketing-login");
const marketingCalendar = document.querySelector("#marketing-calendar");
const marketingYear = document.querySelector("#marketing-year");
const marketingMonth = document.querySelector("#marketing-month");
const menuScrim = document.querySelector("#menu-scrim");
const popoverScrim = document.querySelector("#popover-scrim");
const mobileMenuPortal = document.querySelector("#mobile-menu-portal");
const enterAppButton = document.querySelector("#enter-app");
const openLoginButton = document.querySelector("#open-login");
const loginEmailInput = document.querySelector("#login-email");
const loginSendButton = document.querySelector("#login-send");
const loginBackButton = document.querySelector("#login-back");
const brandHomeButton = document.querySelector("#brand-home");
const authEmailInput = document.querySelector("#auth-email");
const authSendButton = document.querySelector("#auth-send");
const authStatus = document.querySelector("#auth-status");
const syncStatus = document.querySelector("#sync-status");
const authSignOutButton = document.querySelector("#auth-signout");
const authRow = document.querySelector("#auth-row");
const settingsBackButton = document.querySelector("#settings-back");
const resetOnboardingButton = document.querySelector("#reset-onboarding");
let hasEnteredApp = false;
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let syncUser = null;
let syncTimer = null;
let pendingSyncToast = false;
let lastSyncedAt = null;
let loginMode = false;

window.addEventListener("resize", render);
enterAppButton?.addEventListener("click", enterApp);
openLoginButton?.addEventListener("click", () => {
  loginMode = true;
  marketingHero?.classList.add("hidden");
  marketingLogin?.classList.remove("hidden");
});
loginBackButton?.addEventListener("click", () => {
  loginMode = false;
  marketingLogin?.classList.add("hidden");
  marketingHero?.classList.remove("hidden");
});
loginSendButton?.addEventListener("click", () => handleMagicLink(loginEmailInput?.value));
brandHomeButton?.addEventListener("click", () => {
  loginMode = false;
  marketingLogin?.classList.add("hidden");
  marketingHero?.classList.remove("hidden");
  marketingPage?.classList.remove("hidden");
  appShell?.classList.add("hidden");
});
authSendButton?.addEventListener("click", handleMagicLink);
authSignOutButton?.addEventListener("click", signOutSupabase);
settingsBackButton?.addEventListener("click", closeSettingsModal);
resetOnboardingButton?.addEventListener("click", () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(AUTH_STATE_KEY);
  } catch {
    // ignore
  }
  closeSettingsModal();
  state = structuredClone(defaultState);
  saveAndRender();
  hasEnteredApp = false;
  loginMode = false;
  marketingLogin?.classList.add("hidden");
  marketingHero?.classList.remove("hidden");
  marketingPage?.classList.remove("hidden");
  appShell?.classList.add("hidden");
  showOnboardingIfNeeded();
});
onboardingNextButton?.addEventListener("click", () => showOnboardingStep("dots"));
onboardingBackButton?.addEventListener("click", () => showOnboardingStep("intro"));
onboardingNextDotsButton?.addEventListener("click", () => showOnboardingStep("sync"));
onboardingBackSyncButton?.addEventListener("click", () => showOnboardingStep("dots"));
onboardingDoneButton?.addEventListener("click", completeOnboarding);
onboardingSkipIntroButton?.addEventListener("click", completeOnboarding);
onboardingSkipButton?.addEventListener("click", completeOnboarding);
onboardingUpgradeButton?.addEventListener("click", () => {
  window.open("mailto:hello@dot-diary.com?subject=Dot%20Diary%20Upgrade", "_blank");
});
onboardingSendButton?.addEventListener("click", () => handleMagicLink(onboardingEmailInput?.value));
openSettings.addEventListener("click", () => {
  closePopover();
  openSettingsModal();
});
periodPickerToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  if (periodPickerMenu.classList.contains("hidden")) {
    openPeriodMenu();
  } else {
    closePeriodMenu();
  }
});
menuScrim?.addEventListener("click", () => {
  closePeriodMenu();
  closeDotMenus();
});
popoverScrim?.addEventListener("click", () => {
  closePopover();
});
periodPickerMenu.addEventListener("scroll", () => {
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
});
deleteCancel.addEventListener("click", closeDeleteModal);
deleteConfirm.addEventListener("click", () => {
  if (!pendingDeleteDotTypeId) return;
  if (pendingDeleteMode === "force") {
    forceDeleteDotType(pendingDeleteDotTypeId);
    showToast(`Permanently deleted "${pendingDeleteDotTypeName}".`);
  } else {
    deleteDotType(pendingDeleteDotTypeId);
    showToast(`Deleted "${pendingDeleteDotTypeName}".`);
  }
  closeDeleteModal();
});
weekStartMondayInput.addEventListener("change", () => {
  state.weekStartsMonday = weekStartMondayInput.checked;
  saveAndRender();
  showToast(state.weekStartsMonday ? "Weeks now start on Monday." : "Weeks now start on Sunday.");
});
colorModeLightButton.addEventListener("click", () => {
  state.darkMode = false;
  saveAndRender();
  showToast("Light mode on.");
});
colorModeDarkButton.addEventListener("click", () => {
  state.darkMode = true;
  saveAndRender();
  showToast("Dark mode on.");
});
downloadDataButton.addEventListener("click", downloadDataExport);
uploadDataButton.addEventListener("click", () => {
  uploadDataInput.click();
});
uploadDataInput.addEventListener("change", handleDataImport);

document.addEventListener("pointerdown", (event) => {
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
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closePopover();
  closePeriodMenu();
  closeSettingsModal();
  closeDeleteModal();
});

render();
showOnboardingIfNeeded();
try {
  if (!DEMO_MODE && localStorage.getItem(AUTH_STATE_KEY) === "1") {
    enterApp({ skipOnboarding: true });
  }
} catch {
  // ignore storage access
}

initSupabaseAuth();
renderMarketingCalendar();

const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
if (colorSchemeMedia && typeof colorSchemeMedia.addEventListener === "function") {
  colorSchemeMedia.addEventListener("change", () => {
    if (state.darkMode === null) render();
  });
} else if (colorSchemeMedia && typeof colorSchemeMedia.addListener === "function") {
  colorSchemeMedia.addListener(() => {
    if (state.darkMode === null) render();
  });
}

function render() {
  applyTheme();
  renderPeriodPicker();
  renderDiaryGrid();
  renderDotTypeList();
  weekStartMondayInput.checked = Boolean(state.weekStartsMonday);
  const darkModeEnabled = isDarkModeEnabled();
  colorModeLightButton.classList.toggle("active", !darkModeEnabled);
  colorModeDarkButton.classList.toggle("active", darkModeEnabled);
  renderSuggestedDotTypes();
  renderOnboardingLists();
  updateAuthUI();
}

function renderPeriodPicker(preserveScroll = false, previousScrollTop = 0) {
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

function renderDiaryGrid() {
  if (isMobileView()) {
    yearGrid.classList.add("hidden");
    monthGrid.classList.remove("hidden");
    renderMonthGrid();
  } else {
    monthGrid.classList.add("hidden");
    yearGrid.classList.remove("hidden");
    renderYearGrid();
  }
}

function renderYearGrid() {
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
      const row = document.createElement("button");
      row.type = "button";
      row.className = "year-day";
      if (iso === todayIso) row.classList.add("current-day");
      row.dataset.date = iso;

      const label = document.createElement("span");
      label.className = "day-label";
      label.textContent = `${String(dayNum).padStart(2, "0")} ${weekdayShort(date)}`;
      row.appendChild(label);

      const dotLayer = document.createElement("div");
      dotLayer.className = "dot-layer";
      getDayDotIds(iso).forEach((dotId) => {
        const dotType = state.dotTypes.find((t) => t.id === dotId);
        if (!dotType) return;
        const sticker = document.createElement("span");
        sticker.className = "dot-sticker";
        sticker.style.background = dotType.color;
        const pos = getDotPosition(iso, dotId, "year");
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
        row.appendChild(buildNoteEditor(iso, "day-note"));
      } else if (note) {
        const noteNode = document.createElement("span");
        noteNode.className = "day-note";
        noteNode.textContent = note;
        row.appendChild(noteNode);
      }

      row.addEventListener("click", (event) => {
        if (Date.now() < suppressDayOpenUntil) return;
        if (activeNoteEdit === iso) return;
        if (activePopover && activePopover.isoDate !== iso) {
          closePopover();
          return;
        }
        openPopover(iso, event.clientX, event.clientY);
      });
      column.appendChild(row);
    }

    yearGrid.appendChild(column);
  }
}

function renderMonthGrid() {
  const monthDate = new Date(state.monthCursor);
  const todayIso = formatISODate(new Date());
  monthGrid.innerHTML = "";
  const days = buildMonthCells(monthDate, state.weekStartsMonday);

  for (const day of days) {
    const cell = document.createElement("button");
    cell.type = "button";
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
    getDayDotIds(day.iso).forEach((dotId) => {
      const dotType = state.dotTypes.find((t) => t.id === dotId);
      if (!dotType) return;
      const sticker = document.createElement("span");
      sticker.className = "dot-sticker";
      sticker.style.background = dotType.color;
      const pos = getDotPosition(day.iso, dotId, "month");
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
    if (activeNoteEdit === day.iso) {
      cell.appendChild(buildNoteEditor(day.iso, "month-note"));
    } else if (note) {
      const noteNode = document.createElement("span");
      noteNode.className = "month-note";
      noteNode.textContent = note;
      cell.appendChild(noteNode);
    }

    cell.addEventListener("click", (event) => {
      if (Date.now() < suppressDayOpenUntil) return;
      if (activeNoteEdit === day.iso) return;
      if (activePopover && activePopover.isoDate !== day.iso) {
        closePopover();
        return;
      }
      openPopover(day.iso, event.clientX, event.clientY);
    });
    monthGrid.appendChild(cell);
  }
}

function renderMarketingCalendar() {
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

function renderMarketingMonth(demoState) {
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

function renderDotTypeList(targetList = dotTypeList) {
  if (!targetList) return;
  targetList.innerHTML = "";

  if (state.dotTypes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML =
      'You don’t have any dot types yet';
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
      const nextName = nameInput.value.trim() || dotType.name;
      const changed = nextName !== dotType.name;
      dotType.name = nextName;
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
}

function renderSuggestedDotTypes(targetList = suggestedDotList) {
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

function openPopover(isoDate, x, y) {
  if (popoverHideTimer) {
    clearTimeout(popoverHideTimer);
    popoverHideTimer = null;
  }
  const shouldAnimateIn = popover.classList.contains("hidden");
  activePopover = { isoDate };
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
        openPopover(isoDate, x, y);
      } else {
        closePopover();
      }
    });

    popover.appendChild(node);
  });

  const noteWrap = document.createElement("div");
  noteWrap.className = "popover-note";
  const noteButton = document.createElement("button");
  noteButton.type = "button";
  noteButton.className = "note-edit-button";
  noteButton.textContent = getDayNote(isoDate) ? "Edit note" : "Add note";
  noteButton.addEventListener("click", () => {
    closePopover();
    startNoteEdit(isoDate);
  });
  noteWrap.append(noteButton);
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

function closePopover() {
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

function showPopoverScrim() {
  if (!popoverScrim) return;
  popoverScrim.classList.remove("hidden");
  requestAnimationFrame(() => {
    popoverScrim.classList.add("visible");
  });
}

function hidePopoverScrim() {
  if (!popoverScrim) return;
  popoverScrim.classList.remove("visible");
  window.setTimeout(() => {
    popoverScrim.classList.add("hidden");
  }, POPOVER_ANIMATION_MS);
}

function startNoteEdit(isoDate) {
  activeNoteEdit = isoDate;
  render();
  requestAnimationFrame(() => {
    const editor = document.querySelector(`[data-note-editor="${isoDate}"]`);
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
}

function finishNoteEdit(isoDate, editor) {
  activeNoteEdit = null;
  setDayNote(isoDate, editor.textContent || "");
}

function buildNoteEditor(isoDate, baseClass) {
  const editor = document.createElement("div");
  editor.className = `${baseClass} note-editor`;
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.dataset.noteEditor = isoDate;
  editor.textContent = getDayNote(isoDate);
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishNoteEdit(isoDate, editor);
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

function toggleDot(isoDate, dotId) {
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

function deleteDotType(dotId) {
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

function promptDeleteDotType(dotId, dotName) {
  if (isDotTypeInUse(dotId)) return;
  pendingDeleteDotTypeId = dotId;
  pendingDeleteDotTypeName = dotName;
  pendingDeleteMode = "safe";
  deleteText.textContent = "You haven’t used this dot yet.";
  deleteModal.classList.remove("hidden");
}

function promptPermanentDeleteDotType(dotId, dotName) {
  pendingDeleteDotTypeId = dotId;
  pendingDeleteDotTypeName = dotName;
  pendingDeleteMode = "force";
  deleteText.textContent = `This will remove “${dotName}” from all days it is already applied to and delete it from your dot types.`;
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  pendingDeleteDotTypeId = null;
  pendingDeleteDotTypeName = "";
  pendingDeleteMode = "safe";
  deleteModal.classList.add("hidden");
}

function forceDeleteDotType(dotId) {
  state.dotTypes = state.dotTypes.filter((d) => d.id !== dotId);

  for (const [iso, ids] of Object.entries(state.dayDots)) {
    const next = ids.filter((id) => id !== dotId);
    clearDotPosition(iso, dotId);
    if (next.length === 0) delete state.dayDots[iso];
    else state.dayDots[iso] = next;
  }

  saveAndRender();
}

function closeSettingsModal() {
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

function openSettingsModal() {
  if (settingsModalHideTimer) {
    clearTimeout(settingsModalHideTimer);
    settingsModalHideTimer = null;
  }
  showAnimated(settingsModal);
}

function closePeriodMenu() {
  periodPickerMenu.classList.remove("visible");
  periodPickerMenu.classList.add("hidden");
  updateMenuScrim();
}

function openPeriodMenu() {
  showAnimated(periodPickerMenu);
  updateMenuScrim();
}

function addSuggestedDotType(suggestion) {
  if (hasDotTypeName(suggestion.name)) return;
  state.dotTypes.push({
    id: crypto.randomUUID(),
    name: suggestion.name,
    color: suggestion.color
  });
  saveAndRender();
  showToast(`Added "${suggestion.name}".`);
}

function addNewDotType() {
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

function hasDotTypeName(name) {
  const target = name.trim().toLowerCase();
  return state.dotTypes.some((dot) => dot.name.trim().toLowerCase() === target);
}

function getNextSuggestedColor() {
  for (const suggestion of SUGGESTED_DOT_TYPES) {
    if (!state.dotTypes.some((dot) => dot.color.toLowerCase() === suggestion.color.toLowerCase())) {
      return suggestion.color;
    }
  }
  return "#000000";
}

function isDotTypeInUse(dotId) {
  return Object.values(state.dayDots).some((ids) => ids.includes(dotId));
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getDayDotIds(isoDate) {
  return state.dayDots[isoDate] || [];
}

function getDayNote(isoDate) {
  return state.dayNotes[isoDate] || "";
}

function setDayNote(isoDate, rawValue) {
  const note = normalizeNote(rawValue);
  if (!note) {
    delete state.dayNotes[isoDate];
  } else {
    state.dayNotes[isoDate] = note;
  }
  saveAndRender();
}

function saveAndRender() {
  if (DEMO_MODE) {
    render();
    return;
  }
  state.lastModified = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  scheduleSync();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const yearFromMonthCursor = parsed.monthCursor ? new Date(parsed.monthCursor).getFullYear() : null;
    return {
      monthCursor: parsed.monthCursor || defaultState.monthCursor,
      yearCursor: Number.isInteger(parsed.yearCursor) ? parsed.yearCursor : yearFromMonthCursor || defaultState.yearCursor,
      weekStartsMonday: Boolean(parsed.weekStartsMonday),
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

function showOnboardingIfNeeded() {
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

function showOnboardingStep(step) {
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

function closeOnboardingModal() {
  onboardingModal?.classList.add("hidden");
}

function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore
  }
  closeOnboardingModal();
}

function renderOnboardingLists() {
  renderDotTypeList(onboardingDotTypeList);
  renderSuggestedDotTypes(onboardingSuggestedDotList);
}

function enterApp({ skipOnboarding = false } = {}) {
  hasEnteredApp = true;
  loginMode = false;
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

function createDemoState() {
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
    darkMode: null,
    lastModified: new Date().toISOString(),
    dotTypes,
    dayDots,
    dotPositions,
    dayNotes
  };
}

function formatISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildMonthCells(monthDate, weekStartsMonday = false) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const first = new Date(year, month, 1);
  const startOffset = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const start = new Date(year, month, 1 - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      date,
      iso: formatISODate(date),
      inCurrentMonth: date.getMonth() === month
    });
  }

  return cells;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function hash32(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stickerPosition(isoDate, dotId) {
  const h1 = hash32(`${isoDate}|${dotId}|x`);
  const h2 = hash32(`${isoDate}|${dotId}|y`);
  const h3 = hash32(`${isoDate}|${dotId}|r`);

  return {
    left: 48 + (h1 % 46),
    top: 22 + (h2 % 58),
    rotate: -18 + (h3 % 37)
  };
}

function stickerPositionMonth(isoDate, dotId) {
  const h1 = hash32(`${isoDate}|${dotId}|x|m`);
  const h2 = hash32(`${isoDate}|${dotId}|y|m`);
  const h3 = hash32(`${isoDate}|${dotId}|r|m`);
  return {
    left: 12 + (h1 % 76),
    top: 24 + (h2 % 64),
    rotate: -18 + (h3 % 37)
  };
}

function getDemoDotPosition(demoState, isoDate, dotId) {
  const stored = demoState.dotPositions?.[isoDate]?.[dotId];
  const base = stickerPosition(isoDate, dotId);
  if (!stored) return base;
  return {
    left: stored.left,
    top: stored.top,
    rotate: base.rotate
  };
}

function getDotPosition(isoDate, dotId, mode) {
  const stored = state.dotPositions?.[isoDate]?.[dotId];
  const base = mode === "month" ? stickerPositionMonth(isoDate, dotId) : stickerPosition(isoDate, dotId);
  if (!stored) return base;
  return {
    left: stored.left,
    top: stored.top,
    rotate: base.rotate
  };
}

function saveDotPosition(isoDate, dotId, left, top) {
  if (!state.dotPositions[isoDate]) state.dotPositions[isoDate] = {};
  state.dotPositions[isoDate][dotId] = { left, top };
}

function clearDotPosition(isoDate, dotId) {
  const dayPositions = state.dotPositions[isoDate];
  if (!dayPositions) return;
  delete dayPositions[dotId];
  if (Object.keys(dayPositions).length === 0) {
    delete state.dotPositions[isoDate];
  }
}

function startDotDrag(event, { isoDate, dotId, sticker, mode }) {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      suppressDayOpenUntil = Date.now() + 250;
    }
  };

  sticker.setPointerCapture(pointerId);
  sticker.addEventListener("pointermove", onMove);
  sticker.addEventListener("pointerup", onUp);
  sticker.addEventListener("pointercancel", onUp);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNote(value) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
}

function weekdayShort(date) {
  return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][date.getDay()];
}

function isMobileView() {
  return window.matchMedia("(max-width: 920px)").matches;
}

function monthDiff(laterDate, earlierDate) {
  return (
    (laterDate.getFullYear() - earlierDate.getFullYear()) * 12 +
    (laterDate.getMonth() - earlierDate.getMonth())
  );
}

function closeDotMenus() {
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

function closeColorPickers() {
  document.querySelectorAll(".color-picker").forEach((picker) => {
    picker.classList.remove("visible");
    picker.classList.add("hidden");
    if (picker.dataset.portalActive === "true" && picker._portalParent) {
      picker._portalParent.appendChild(picker);
      picker.dataset.portalActive = "";
    }
  });
  updateMenuScrim();
}

function openColorPicker(picker) {
  const opening = picker.classList.contains("hidden");
  closeColorPickers();
  if (!opening) return;
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

function buildColorPicker(dotType, swatch) {
  const picker = document.createElement("div");
  picker.className = "color-picker hidden";
  picker.dataset.portal = "color-picker";
  picker._currentColor = () => dotType.color;

  const grid = document.createElement("div");
  grid.className = "color-grid";
  const palette = COLOR_PALETTE.filter(
    (color, index, arr) => arr.indexOf(color) === index
  );
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

function positionDotActionsMenu(menu) {
  const boundaryRect = menu.closest(".settings-card")?.getBoundingClientRect() || {
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

function updateMenuScrim() {
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

function showAnimated(element) {
  element.classList.remove("hidden");
  element.classList.remove("visible");
  void element.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add("visible");
    });
  });
}

function syncDotTypeInputSize(input) {
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

function applyTheme() {
  document.documentElement.dataset.theme = isDarkModeEnabled() ? "dark" : "light";
}

function downloadDataExport() {
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

async function handleDataImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const next = normalizeImportedState(parsed?.data ?? parsed);
    state = next;
    loadedYearBatchCount = 1;
    loadedMobileMonthCount = 12;
    closePeriodMenu();
    closeDotMenus();
    saveAndRender();
    showToast("Imported your data.");
  } catch {
    showToast("Could not import that file.");
  } finally {
    uploadDataInput.value = "";
  }
}

function normalizeImportedState(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return structuredClone(defaultState);
  }
  const yearFromMonthCursor = parsed.monthCursor ? new Date(parsed.monthCursor).getFullYear() : null;
  return {
    monthCursor: typeof parsed.monthCursor === "string" ? parsed.monthCursor : defaultState.monthCursor,
    yearCursor: Number.isInteger(parsed.yearCursor) ? parsed.yearCursor : yearFromMonthCursor || defaultState.yearCursor,
    weekStartsMonday: Boolean(parsed.weekStartsMonday),
    darkMode: typeof parsed.darkMode === "boolean" ? parsed.darkMode : null,
    lastModified: typeof parsed.lastModified === "string" ? parsed.lastModified : new Date().toISOString(),
    dotTypes: Array.isArray(parsed.dotTypes) ? parsed.dotTypes : [],
    dayDots: parsed.dayDots && typeof parsed.dayDots === "object" ? parsed.dayDots : {},
    dotPositions: parsed.dotPositions && typeof parsed.dotPositions === "object" ? parsed.dotPositions : {},
    dayNotes: parsed.dayNotes && typeof parsed.dayNotes === "object" ? parsed.dayNotes : {}
  };
}

async function initSupabaseAuth() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  syncUser = data?.session?.user || null;
  if (!hasEnteredApp && syncUser && !marketingPage?.classList.contains("hidden")) {
    enterApp({ skipOnboarding: true });
  }
  updateAuthUI();
  if (syncUser) {
    await loadFromCloud();
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    syncUser = session?.user || null;
    if (!hasEnteredApp && syncUser && !marketingPage?.classList.contains("hidden")) {
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

async function handleMagicLink(overrideEmail) {
  if (!supabase) return;
  const email = overrideEmail?.trim() || authEmailInput?.value?.trim();
  if (!email) {
    showToast("Enter an email first.");
    return;
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
  }
}

async function signOutSupabase() {
  if (!supabase) return;
  await supabase.auth.signOut();
  syncUser = null;
  lastSyncedAt = null;
  hasEnteredApp = false;
  loginMode = false;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(AUTH_STATE_KEY);
  } catch {
    // ignore
  }
  state = structuredClone(defaultState);
  closePopover();
  closeSettingsModal();
  closeDeleteModal();
  marketingLogin?.classList.add("hidden");
  marketingHero?.classList.remove("hidden");
  marketingPage?.classList.remove("hidden");
  appShell?.classList.add("hidden");
  render();
  updateAuthUI();
  showToast("Signed out.");
}

function updateAuthUI() {
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

function getStateTimestamp() {
  return new Date(state.lastModified || 0).getTime();
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
    lastModified: new Date(Math.max(getStateTimestamp(), new Date(remoteState.lastModified || 0).getTime())).toISOString()
  };
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
  state = mergeStates(state, remoteState, preferRemote);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  lastSyncedAt = new Date().toISOString();
  updateAuthUI();
  await syncToCloud();
}

function scheduleSync() {
  if (!supabase || !syncUser) return;
  if (syncTimer) clearTimeout(syncTimer);
  pendingSyncToast = true;
  syncTimer = setTimeout(() => {
    syncToCloud();
  }, 800);
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

function isDarkModeEnabled() {
  if (typeof state.darkMode === "boolean") {
    return state.darkMode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function showToast(message) {
  if (!toast) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (toastHideTimer) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  toast.textContent = message;
  toast.classList.remove("visible");
  toast.classList.remove("hidden");
  // Force a style flush so the transition runs reliably from hidden -> visible.
  void toast.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });
  });
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    toastHideTimer = setTimeout(() => {
      toast.classList.add("hidden");
      toastHideTimer = null;
    }, 280);
    toastTimer = null;
  }, 1800);
}
