import { toast } from "./dom.js";
import { TOAST_DISPLAY_MS, TOAST_HIDE_MS } from "./constants.js";

let toastTimer = null;
let toastHideTimer = null;

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
    }, TOAST_HIDE_MS);
    toastTimer = null;
  }, TOAST_DISPLAY_MS);
}
