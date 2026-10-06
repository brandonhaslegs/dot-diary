// Capture the entire dismissal gesture before background controls receive it.
export function installOverlayDismissGuard(root, getOverlay) {
  let dismissedPointer = null;
  const consume = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  root.addEventListener("pointerdown", (event) => {
    dismissedPointer = null;
    const overlay = getOverlay();
    if (!overlay || overlay.contains(event.target)) return;
    dismissedPointer = event.pointerId;
    consume(event);
    overlay.close();
  }, true);
  root.addEventListener("pointerup", (event) => {
    if (dismissedPointer === event.pointerId) consume(event);
  }, true);
  root.addEventListener("pointercancel", () => {
    dismissedPointer = null;
  }, true);
  root.addEventListener("click", (event) => {
    if (dismissedPointer !== null && event.detail !== 0) {
      dismissedPointer = null;
      consume(event);
      return;
    }
    const overlay = getOverlay();
    if (!overlay || overlay.contains(event.target)) return;
    consume(event);
    overlay.close();
  }, true);
}
