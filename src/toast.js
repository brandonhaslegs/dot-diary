import { toast } from "./dom.js";

let toastTimer = null;
let toastHideTimer = null;

// showToast: Shows a transient toast message with enter/exit animation timing.
export function showToast(message) {
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
