import {
  pwaInstallConfirm,
  pwaInstallCopy,
  pwaInstallDismiss,
  pwaInstallModal
} from "./dom.js";

let deferredInstallPrompt = null;
let loginCompleted = false;
let shownThisSession = false;

function isMobileDevice() {
  const userAgent = navigator.userAgent || "";
  const isIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent) || isIPad;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function closeInstallModal() {
  pwaInstallModal?.classList.add("hidden");
}

function showInstallModal() {
  if (!loginCompleted || shownThisSession || !isMobileDevice() || isInstalled() || !pwaInstallModal) return;
  if (!deferredInstallPrompt && !isIos()) return;

  shownThisSession = true;
  const needsIosInstructions = !deferredInstallPrompt && isIos();
  if (pwaInstallCopy) {
    pwaInstallCopy.textContent = needsIosInstructions
      ? "Tap the Share button (the square with an upward arrow), then choose Add to Home Screen."
      : "Install the app for a faster, full-screen experience.";
  }
  if (pwaInstallConfirm) {
    pwaInstallConfirm.textContent = needsIosInstructions ? "Got it" : "Install app";
  }
  pwaInstallModal.classList.remove("hidden");
  pwaInstallConfirm?.focus();
}

export function initPwaInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallModal();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    closeInstallModal();
  });

  pwaInstallDismiss?.addEventListener("click", closeInstallModal);
  pwaInstallModal?.addEventListener("click", (event) => {
    if (event.target === pwaInstallModal) closeInstallModal();
  });
  pwaInstallConfirm?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      closeInstallModal();
      return;
    }
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } finally {
      deferredInstallPrompt = null;
      closeInstallModal();
    }
  });
}

// Called only after a real sign-in, rather than on every signed-in page load.
export function offerPwaInstallAfterLogin() {
  loginCompleted = true;
  showInstallModal();
}
