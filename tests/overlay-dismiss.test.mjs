import test from "node:test";
import assert from "node:assert/strict";
import { installOverlayDismissGuard } from "../src/overlay-dismiss.mjs";

function setup() {
  const root = new EventTarget();
  let open = true;
  let inside = false;
  const received = [];
  installOverlayDismissGuard(root, () => open ? {
    contains: () => inside,
    close: () => { open = false; }
  } : null);
  for (const type of ["pointerdown", "pointerup", "click"]) {
    root.addEventListener(type, () => received.push(type));
  }
  return {
    received,
    setInside: () => { inside = true; },
    isOpen: () => open,
    fire(type, detail = 1) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { pointerId: 1, detail });
      root.dispatchEvent(event);
      return event.defaultPrevented;
    }
  };
}

test("outside gesture closes overlay and never reaches background, even after dismissal", () => {
  const ui = setup();
  assert.equal(ui.fire("pointerdown"), true);
  assert.equal(ui.isOpen(), false);
  assert.equal(ui.fire("pointerup"), true);
  assert.equal(ui.fire("click"), true);
  assert.deepEqual(ui.received, []);
  ui.fire("pointerdown");
  ui.fire("pointerup");
  ui.fire("click");
  assert.deepEqual(ui.received, ["pointerdown", "pointerup", "click"]);
});

test("inside controls remain interactive", () => {
  const ui = setup();
  ui.setInside();
  ui.fire("pointerdown");
  ui.fire("pointerup");
  ui.fire("click");
  assert.equal(ui.isOpen(), true);
  assert.deepEqual(ui.received, ["pointerdown", "pointerup", "click"]);
});

test("keyboard activation outside only dismisses the overlay", () => {
  const ui = setup();
  assert.equal(ui.fire("click", 0), true);
  assert.equal(ui.isOpen(), false);
  assert.deepEqual(ui.received, []);
});

test("a new press works when the dismissal gesture produced no click", () => {
  const ui = setup();
  ui.fire("pointerdown");
  ui.fire("pointerup");
  ui.fire("pointerdown");
  ui.fire("pointerup");
  ui.fire("click");
  assert.deepEqual(ui.received, ["pointerdown", "pointerup", "click"]);
});
