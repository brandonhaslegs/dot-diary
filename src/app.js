import { APP_ENTRY_KEY, AUTH_STATE_KEY, DEMO_MODE, VIEW_MODE_KEY } from "./constants.js";
import {
  authSendButton,
  authSignOutButton,
  brandHomeButton,
  colorModeDarkButton,
  colorModeLightButton,
  deleteCancel,
  deleteConfirm,
  downloadDataButton,
  enterAppButton,
  hideSuggestionsInput,
  loginBackButton,
  loginEmailInput,
  loginSendButton,
  menuScrim,
  onboardingEmailInput,
  onboardingBackButton,
  onboardingBackSyncButton,
  onboardingDoneButton,
  onboardingNextButton,
  onboardingNextDotsButton,
  onboardingSendButton,
  onboardingSkipButton,
  onboardingSkipIntroButton,
  openLoginButton,
  openSettings,
  periodPickerMenu,
  periodPickerToggle,
  popoverScrim,
  resetOnboardingButton,
  settingsBackButton,
  todayButton,
  uploadDataButton,
  uploadDataInput,
  weekStartMondayInput
} from "./dom.js";
import { registerRender, registerScheduleSync, requestRender, saveAndRender, state } from "./state.js";
import {
  closeColorPickers,
  closeDeleteModal,
  closeDotMenus,
  closePeriodMenu,
  closePopover,
  closeSettingsModal,
  completeOnboarding,
  confirmDeleteDotType,
  enterApp,
  handleDataImport,
  handleGlobalKeyDown,
  handleGlobalPointerDown,
  handlePeriodPickerScroll,
  handleResetOnboarding,
  openPeriodMenu,
  openSettingsModal,
  registerAuthUpdater,
  render,
  renderMarketingCalendar,
  scrollToToday,
  downloadDataExport,
  dismissPopoverFromScrim,
  setupDevAutoReload,
  setupMobileMonthScroll,
  showLogin,
  showMarketingHero,
  showMarketingPage,
  showOnboardingIfNeeded,
  showOnboardingStep
} from "./ui.js";
import {
  handleMagicLink,
  initSupabaseAuth,
  scheduleSync,
  signOutSupabase,
  updateAuthUI
} from "./auth.js";
import { showToast } from "./toast.js";

registerRender(render);
registerScheduleSync(scheduleSync);
registerAuthUpdater(updateAuthUI);

window.addEventListener("resize", () => {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.classList.contains("note-editor")) {
    return;
  }
  render();
});

enterAppButton?.addEventListener("click", () => enterApp());
openLoginButton?.addEventListener("click", showLogin);
loginBackButton?.addEventListener("click", showMarketingHero);
loginSendButton?.addEventListener("click", () => handleMagicLink(loginEmailInput?.value, loginSendButton));
brandHomeButton?.addEventListener("click", () => {
  showMarketingHero();
  showMarketingPage();
});
authSendButton?.addEventListener("click", () => handleMagicLink(undefined, authSendButton));
authSignOutButton?.addEventListener("click", signOutSupabase);
settingsBackButton?.addEventListener("click", closeSettingsModal);
openSettings?.addEventListener("click", () => {
  closePopover();
  openSettingsModal();
});
todayButton?.addEventListener("click", scrollToToday);
resetOnboardingButton?.addEventListener("click", handleResetOnboarding);

onboardingNextButton?.addEventListener("click", () => showOnboardingStep("dots"));
onboardingBackButton?.addEventListener("click", () => showOnboardingStep("intro"));
onboardingNextDotsButton?.addEventListener("click", () => showOnboardingStep("sync"));
onboardingBackSyncButton?.addEventListener("click", () => showOnboardingStep("dots"));
onboardingDoneButton?.addEventListener("click", completeOnboarding);
onboardingSkipIntroButton?.addEventListener("click", completeOnboarding);
onboardingSkipButton?.addEventListener("click", completeOnboarding);
onboardingSendButton?.addEventListener("click", () => handleMagicLink(onboardingEmailInput?.value));

periodPickerToggle?.addEventListener("click", (event) => {
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
  closeColorPickers();
});
popoverScrim?.addEventListener("pointerdown", dismissPopoverFromScrim);
periodPickerMenu?.addEventListener("scroll", handlePeriodPickerScroll);

deleteCancel?.addEventListener("click", closeDeleteModal);
deleteConfirm?.addEventListener("click", confirmDeleteDotType);

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

downloadDataButton?.addEventListener("click", () => {
  downloadDataExport();
});
uploadDataButton?.addEventListener("click", () => {
  uploadDataInput?.click();
});
uploadDataInput?.addEventListener("change", handleDataImport);

document.addEventListener("pointerdown", handleGlobalPointerDown);
document.addEventListener("keydown", handleGlobalKeyDown);

render();
try {
  if (!DEMO_MODE) {
    const lastView = localStorage.getItem(VIEW_MODE_KEY);
    const hasAuthState = localStorage.getItem(AUTH_STATE_KEY) === "1";
    const hasEnteredBefore = localStorage.getItem(APP_ENTRY_KEY) === "1";
    if (lastView === "marketing") {
      showMarketingPage();
    } else if (hasAuthState) {
      enterApp({ skipOnboarding: true });
    } else if (hasEnteredBefore) {
      enterApp();
    }
  }
} catch {
  // ignore storage access
}
showOnboardingIfNeeded();

initSupabaseAuth();
renderMarketingCalendar();
setupDevAutoReload();
setupMobileMonthScroll();

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
