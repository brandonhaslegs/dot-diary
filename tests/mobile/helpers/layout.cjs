const { expect } = require('playwright/test');

async function expectInViewport(page, locator) {
  await expect(locator).toBeVisible();
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    const viewport = page.viewportSize();
    return Boolean(box && box.x >= -1 && box.y >= -1 &&
      box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
  }, { message: 'The entire overlay must fit inside the viewport' }).toBe(true);
}

async function expectReachable(page, locator) {
  await expectInViewport(page, locator);
  await expect.poll(() => locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit === element || element.contains(hit);
  }), { message: 'The control must not be covered by another layer' }).toBe(true);
}
module.exports = { expectInViewport, expectReachable };
