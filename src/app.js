import { AUTH_STATE_KEY, DEMO_MODE, VIEW_MODE_KEY } from "./constants.js";
import { formatISODate } from "./utils.js";
import {
  authEmailInput,
  authSendButton,
  authSignOutButton,
  billingManage,
  billingUpgrade,
  brandHomeButton,
  colorModeDarkButton,
  colorModeLightButton,
  deleteCancel,
  deleteConfirm,
  downloadDataButton,
  enterAppButton,
  filterDotTypeList,
  filterMenu,
  hideSuggestionsInput,
  loginBackButton,
  loginCodeInput,
  loginCodeRow,
  loginEmailInput,
  loginSendButton,
  loginVerifyButton,
  menuScrim,
  mobileMenuPortal,
  onboardingEmailInput,
  onboardingBackButton,
  onboardingBackSyncButton,
  onboardingDoneButton,
  onboardingNextButton,
  onboardingNextDotsButton,
  onboardingSendButton,
  onboardingSkipButton,
  onboardingSkipIntroButton,
  openFilters,
  openLoginButton,
  openSettings,
  periodPickerMenu,
  periodPickerToggle,
  popoverScrim,
  resetOnboardingButton,
  settingsCloseButton,
  settingsTabButtons,
  settingsTabPanels,
  showCalendarNotesInput,
  showKeyboardHintsInput,
  todayButton,
  uploadDataButton,
  uploadDataInput,
  weekStartMondayInput,
  yearNextButton,
  yearPrevButton
} from "./dom.js?v=otp-20260817";
import { registerRender, registerScheduleSync, requestRender, saveAndRender, state } from "./state.js";
import {
  closeColorPickers,
  closeDeleteModal,
  closeDotMenus,
  closeFiltersMenu,
  closePeriodMenu,
  closePopover,
  closeSettingsModal,
  completeOnboarding,
  confirmDeleteDotType,
  enterApp,
  handleDataImport,
  handleGlobalKeyDown,
  handleGlobalPointerDown,
  interceptMobileMenuBackdropTap,
  handlePeriodPickerScroll,
  handleResetOnboarding,
  openPeriodMenu,
  openFiltersMenu,
  openSettingsModal,
  registerAuthUpdater,
  render,
  renderFilterMenu,
  renderMarketingCalendar,
  scrollToToday,
  downloadDataExport,
  dismissPopoverFromScrim,
  setupDevAutoReload,
  showLogin,
  showMarketingHero,
  showMarketingPage,
  showOnboardingIfNeeded,
  showOnboardingStep,
  shiftYearBy
} from "./ui.js";
import {
  getAccessToken,
  requestEmailCode,
  initSupabaseAuth,
  refreshAuthSession,
  scheduleSync,
  signOutSupabase,
  updateAuthUI,
  verifyEmailCode
} from "./auth.js?v=empty-sync-guard-20260817";
import { openBillingPortal, startCheckout } from "./billing.js";
import { showToast } from "./toast.js";
import { initPwaInstallPrompt } from "./pwa-install.js";

// Wire cross-module callbacks so `state` can request UI work and cloud sync.
registerRender(render);
registerScheduleSync(scheduleSync);
registerAuthUpdater(updateAuthUI);

// Re-render when the date changes (e.g. app left open overnight).
let lastRenderedDate = formatISODate(new Date());

function scheduleMidnightRender() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilMidnight = tomorrow - now + 500; // small buffer past midnight
  setTimeout(() => {
    lastRenderedDate = formatISODate(new Date());
    render();
    scheduleMidnightRender();
  }, msUntilMidnight);
}
scheduleMidnightRender();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  const today = formatISODate(new Date());
  if (today !== lastRenderedDate) {
    lastRenderedDate = today;
    render();
  }
});

// Prevent pinch-to-zoom on iOS.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// Re-render on window resize unless the user is actively typing in a note editor.
window.addEventListener("resize", () => {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.classList.contains("note-editor")) {
    return;
  }
  render();
});

// Marketing/login navigation.
function submitOnEnter(input, submit) {
  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    submit();
  });
}

enterAppButton?.addEventListener("click", () => enterApp());
openLoginButton?.addEventListener("click", showLogin);
loginBackButton?.addEventListener("click", showMarketingHero);
async function requestLoginCode() {
  const sent = await requestEmailCode(loginEmailInput?.value, loginSendButton);
  if (!sent) return;
  loginCodeRow?.classList.remove("hidden");
  loginCodeInput?.focus();
}

loginSendButton?.addEventListener("click", requestLoginCode);
submitOnEnter(loginEmailInput, requestLoginCode);
async function verifyLoginCode() {
  const signedIn = await verifyEmailCode(loginEmailInput?.value, loginCodeInput?.value, loginVerifyButton);
  if (!signedIn) return;
  if (loginEmailInput) loginEmailInput.value = "";
  if (loginCodeInput) loginCodeInput.value = "";
  loginCodeRow?.classList.add("hidden");
  // A successful OTP verification is the user's explicit request to enter
  // the diary. Do not rely solely on the auth-state listener to navigate:
  // it may already consider this screen entered on a restored session.
  enterApp({ skipOnboarding: true });
}

loginVerifyButton?.addEventListener("click", verifyLoginCode);
submitOnEnter(loginCodeInput, verifyLoginCode);
brandHomeButton?.addEventListener("click", () => {
  showMarketingHero();
  showMarketingPage();
});
authSendButton?.addEventListener("click", () => requestEmailCode(undefined, authSendButton));
submitOnEnter(authEmailInput, () => requestEmailCode(authEmailInput?.value, authSendButton));
authSignOutButton?.addEventListener("click", signOutSupabase);
settingsCloseButton?.addEventListener("click", closeSettingsModal);

function activateSettingsTab(tabId) {
  settingsTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  settingsTabPanels.forEach((panel) => {
    const isActive = panel.dataset.tab === tabId;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

settingsTabButtons.forEach((button) => {
  button.addEventListener("click", () => activateSettingsTab(button.dataset.tab));
});
openFilters?.addEventListener("click", (event) => {
  event.stopPropagation();
  closePopover();
  if (filterMenu.classList.contains("hidden")) openFiltersMenu();
  else closeFiltersMenu();
});
openSettings?.addEventListener("click", async () => {
  closeFiltersMenu();
  closePopover();
  try {
    await refreshAuthSession({ loadCloud: false });
  } catch {
    // Don't let a failed auth check block opening settings.
  }
  openSettingsModal();
});
todayButton?.addEventListener("click", scrollToToday);
yearPrevButton?.addEventListener("click", () => shiftYearBy(-1));
yearNextButton?.addEventListener("click", () => shiftYearBy(1));
resetOnboardingButton?.addEventListener("click", handleResetOnboarding);

// Onboarding step controls.
onboardingNextButton?.addEventListener("click", () => showOnboardingStep("dots"));
onboardingBackButton?.addEventListener("click", () => showOnboardingStep("intro"));
onboardingNextDotsButton?.addEventListener("click", () => showOnboardingStep("sync"));
onboardingBackSyncButton?.addEventListener("click", () => showOnboardingStep("dots"));
onboardingDoneButton?.addEventListener("click", completeOnboarding);
onboardingSkipIntroButton?.addEventListener("click", completeOnboarding);
onboardingSkipButton?.addEventListener("click", completeOnboarding);
onboardingSendButton?.addEventListener("click", () => requestEmailCode(onboardingEmailInput?.value, onboardingSendButton));
submitOnEnter(onboardingEmailInput, () => requestEmailCode(onboardingEmailInput?.value, onboardingSendButton));

// Period picker open/close and related dismiss behavior.
periodPickerToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (periodPickerMenu.classList.contains("hidden")) {
    openPeriodMenu();
  } else {
    closePeriodMenu();
  }
});
menuScrim?.addEventListener("pointerdown", (event) => {
  // Dismiss on pointerdown so the same tap cannot be interpreted as a click
  // on a calendar day behind the mobile menu scrim.
  event.preventDefault();
  event.stopPropagation();
  closePeriodMenu();
  closeFiltersMenu();
  closeDotMenus();
  closeColorPickers();
});
popoverScrim?.addEventListener("pointerdown", dismissPopoverFromScrim);
mobileMenuPortal?.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".period-picker-menu")) return;
  event.preventDefault();
  event.stopPropagation();
  closePeriodMenu();
});
periodPickerMenu?.addEventListener("scroll", handlePeriodPickerScroll);

deleteCancel?.addEventListener("click", closeDeleteModal);
deleteConfirm?.addEventListener("click", confirmDeleteDotType);

// Persist settings toggles and give user feedback.
weekStartMondayInput?.addEventListener("change", () => {
  state.weekStartsMonday = weekStartMondayInput.checked;
  saveAndRender();
  showToast(state.weekStartsMonday ? "Weeks now start on Monday." : "Weeks now start on Sunday.");
});

hideSuggestionsInput?.addEventListener("change", () => {
  state.hideSuggestions = !hideSuggestionsInput.checked;
  saveAndRender();
  showToast(state.hideSuggestions ? "Suggestions hidden." : "Suggestions shown.");
});

showKeyboardHintsInput?.addEventListener("change", () => {
  state.showKeyboardHints = Boolean(showKeyboardHintsInput.checked);
  saveAndRender();
  showToast(state.showKeyboardHints ? "Keyboard hints shown." : "Keyboard hints hidden.");
});

showCalendarNotesInput?.addEventListener("change", () => {
  state.showCalendarNotes = Boolean(showCalendarNotesInput.checked);
  saveAndRender();
  showToast(state.showCalendarNotes ? "Notes shown in the calendar." : "Notes hidden in the calendar.");
});

filterDotTypeList?.addEventListener("click", (event) => {
  const target = event.target;
  // The clear button contains an SVG, whose paths are SVGElement instances
  // rather than HTMLElements. Let clicks on the icon resolve to its button.
  if (!(target instanceof Element)) return;
  const button = target.closest("button[data-filter-dot-id], button[data-clear-dot-filters]");
  if (!(button instanceof HTMLButtonElement)) return;

  if (button.dataset.clearDotFilters === "true") {
    state.filterDotTypeIds = [];
    saveAndRender();
    renderFilterMenu();
    showToast("Calendar filters cleared.");
    return;
  }

  const dotId = button.dataset.filterDotId;
  if (!dotId) return;

  const selected = new Set(state.filterDotTypeIds);
  if (selected.has(dotId)) selected.delete(dotId);
  else selected.add(dotId);
  state.filterDotTypeIds = [...selected];
  saveAndRender();
  renderFilterMenu();
});

colorModeLightButton?.addEventListener("click", () => {
  state.darkMode = false;
  saveAndRender();
  showToast("Light mode on.");
});
colorModeDarkButton?.addEventListener("click", () => {
  state.darkMode = true;
  saveAndRender();
  showToast("Dark mode on.");
});

// Billing controls.
billingUpgrade?.addEventListener("click", async () => {
  const token = await getAccessToken();
  startCheckout(token, "monthly");
});
billingManage?.addEventListener("click", async () => {
  const token = await getAccessToken();
  openBillingPortal(token);
});

// Export/import controls.
downloadDataButton?.addEventListener("click", () => {
  downloadDataExport();
});
uploadDataButton?.addEventListener("click", () => {
  uploadDataInput?.click();
});
uploadDataInput?.addEventListener("change", handleDataImport);

document.addEventListener("pointerdown", interceptMobileMenuBackdropTap, true);
document.addEventListener("pointerdown", handleGlobalPointerDown);
document.addEventListener("keydown", handleGlobalKeyDown);

// Initial render and first-view routing.
render();
try {
  if (DEMO_MODE) {
    enterApp({ skipOnboarding: true });
  } else {
    const lastView = localStorage.getItem(VIEW_MODE_KEY);
    const hasAuthState = localStorage.getItem(AUTH_STATE_KEY) === "1";
    if (lastView === "marketing") {
      showMarketingPage();
    } else if (hasAuthState) {
      enterApp({ skipOnboarding: true });
    } else {
      showMarketingPage();
    }
  }
} catch {
  // ignore storage access
}
showOnboardingIfNeeded();

// Startup services and background listeners.
initPwaInstallPrompt();
initSupabaseAuth();
renderMarketingCalendar();
setupDevAutoReload();

const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
if (colorSchemeMedia && typeof colorSchemeMedia.addEventListener === "function") {
  colorSchemeMedia.addEventListener("change", () => {
    if (state.darkMode === null) requestRender();
  });
} else if (colorSchemeMedia && typeof colorSchemeMedia.addListener === "function") {
  colorSchemeMedia.addListener(() => {
    if (state.darkMode === null) requestRender();
  });
}

updateAuthUI();
