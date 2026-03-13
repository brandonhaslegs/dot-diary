import { DEMO_MODE, LOCAL_DEV_MODE } from "./constants.js";
import {
  authEmailInput,
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
  showKeyboardHintsInput,
  todayButton,
  uploadDataButton,
  uploadDataInput,
  weekStartMondayInput,
  yearNextButton,
  yearPrevButton
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
  showOnboardingStep,
  shiftYearBy
} from "./ui.js";
import {
  handleMagicLink,
  initSupabaseAuth,
  refreshAuthSession,
  scheduleSync,
  signOutSupabase,
  updateAuthUI
} from "./auth.js";
import { showToast } from "./toast.js";

// Wire cross-module callbacks so `state` can request UI work and cloud sync.
registerRender(render);
registerScheduleSync(scheduleSync);
registerAuthUpdater(updateAuthUI);

// Re-render on window resize unless the user is actively typing in a note editor.
window.addEventListener("resize", () => {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.classList.contains("note-editor")) {
    return;
  }
  render();
});

// Marketing/login navigation.
function submitMagicLinkOnEnter(input, submit) {
  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    submit();
  });
}

enterAppButton?.addEventListener("click", () => {
  if (LOCAL_DEV_MODE) {
    enterApp({ skipOnboarding: true });
    return;
  }
  showLogin();
});
openLoginButton?.addEventListener("click", showLogin);
loginBackButton?.addEventListener("click", showMarketingHero);
loginSendButton?.addEventListener("click", () => handleMagicLink(loginEmailInput?.value, loginSendButton));
submitMagicLinkOnEnter(loginEmailInput, () => handleMagicLink(loginEmailInput?.value, loginSendButton));
brandHomeButton?.addEventListener("click", () => {
  showMarketingHero();
  showMarketingPage();
});
authSendButton?.addEventListener("click", () => handleMagicLink(undefined, authSendButton));
submitMagicLinkOnEnter(authEmailInput, () => handleMagicLink(authEmailInput?.value, authSendButton));
authSignOutButton?.addEventListener("click", signOutSupabase);
settingsBackButton?.addEventListener("click", closeSettingsModal);
openSettings?.addEventListener("click", async () => {
  closePopover();
  await refreshAuthSession({ loadCloud: false });
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
onboardingSendButton?.addEventListener("click", () => handleMagicLink(onboardingEmailInput?.value));
submitMagicLinkOnEnter(onboardingEmailInput, () => handleMagicLink(onboardingEmailInput?.value));

// Period picker open/close and related dismiss behavior.
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

// Export/import controls.
downloadDataButton?.addEventListener("click", () => {
  downloadDataExport();
});
uploadDataButton?.addEventListener("click", () => {
  uploadDataInput?.click();
});
uploadDataInput?.addEventListener("change", handleDataImport);

document.addEventListener("pointerdown", handleGlobalPointerDown);
document.addEventListener("keydown", handleGlobalKeyDown);

// Initial render and first-view routing.
render();
if (LOCAL_DEV_MODE) {
  enterApp({ skipOnboarding: true });
} else if (!DEMO_MODE) {
  showMarketingPage();
}

// Startup services and background listeners.
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

if (LOCAL_DEV_MODE) {
  showToast("Local dev mode: login and cloud sync are disabled.");
}
