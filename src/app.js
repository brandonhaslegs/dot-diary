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
  settingsCloseButton,
  settingsTabButtons,
  settingsTabPanels,
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
  showLogin,
  showMarketingHero,
  showMarketingPage,
  showOnboardingIfNeeded,
  showOnboardingStep,
  shiftYearBy
} from "./ui.js";
import {
  getAccessToken,
  handleMagicLink,
  initSupabaseAuth,
  refreshAuthSession,
  scheduleSync,
  signOutSupabase,
  updateAuthUI
} from "./auth.js";
import { openBillingPortal, startCheckout } from "./billing.js";
import { showToast } from "./toast.js";

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
function submitMagicLinkOnEnter(input, submit) {
  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    submit();
  });
}

enterAppButton?.addEventListener("click", () => enterApp());
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
openSettings?.addEventListener("click", async () => {
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

document.addEventListener("pointerdown", handleGlobalPointerDown);
document.addEventListener("keydown", handleGlobalKeyDown);

// Initial render and first-view routing.
render();
try {
  if (!DEMO_MODE) {
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
