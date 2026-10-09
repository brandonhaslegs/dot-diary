const { test, expect } = require('playwright/test');
const { expectInViewport, expectReachable } = require('./helpers/layout.cjs');

for (const colorScheme of ['light', 'dark']) {
  test.describe(`${colorScheme} mobile navigation`, () => {
    test.use({ colorScheme });
    test.beforeEach(async ({ page }) => {
      await page.route('https://**/*', route => route.abort());
      await page.addInitScript(() => {
        localStorage.setItem('dot-diary-v1', JSON.stringify({ dotTypes: [], dayDots: {}, dayNotes: {} }));
        for (const key of ['dot-diary-onboarding-v1', 'dot-diary-entered-app', 'dot-diary-authenticated']) localStorage.setItem(key, '1');
      });
      await page.goto('/');
    });

    test('overflow stays on screen and every action remains reachable after resizing', async ({ page }) => {
      const toggle = page.locator('#mobile-overflow-toggle');
      const menu = page.locator('#mobile-overflow-menu');
      const original = page.viewportSize();
      // Exercise both CSS sheet breakpoints and short landscape screens in one session.
      for (const viewport of [original, { width: 480, height: 640 }, { width: 481, height: 640 }, { width: 844, height: 390 }, original]) {
        await page.setViewportSize(viewport);
        await toggle.tap();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expectInViewport(page, menu);
        const buttonBox = await toggle.boundingBox();
        const menuBox = await menu.boundingBox();
        expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(buttonBox.y + 1);
        for (const action of await menu.getByRole('menuitem').all()) await expectReachable(page, action);
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
    });

    test('outside tap dismisses overflow without opening the day behind it', async ({ page }) => {
      const toggle = page.locator('#mobile-overflow-toggle');
      const menu = page.locator('#mobile-overflow-menu');
      await toggle.tap();
      await expectInViewport(page, menu);
      const menuBox = await menu.boundingBox();
      const point = await page.locator('.month-day').evaluateAll((days, menuTop) => {
        for (const day of days) {
          const b = day.getBoundingClientRect();
          const x = b.x + b.width / 2;
          const y = b.y + b.height / 2;
          if (y > 0 && y < menuTop && x > 0 && x < innerWidth &&
              day.contains(document.elementFromPoint(x, y))) return { x, y };
        }
        return null;
      }, menuBox.y);
      expect(point, 'A visible calendar day above the menu is required').toBeTruthy();
      await page.touchscreen.tap(point.x, point.y);
      await expect(menu).toBeHidden();
      await expect(page.locator('#day-popover')).toBeHidden();
      // The next deliberate tap must still work.
      await page.touchscreen.tap(point.x, point.y);
      await expect(page.locator('#day-popover')).toBeVisible();
    });

    test('calendar caret hover and focus cannot paint over the round logo', async ({ page }) => {
      const caret = page.locator('#calendar-toggle');
      // Exercise the enabled control's appearance without relying on live billing.
      await caret.evaluate(button => { button.disabled = false; });
      await caret.hover();
      await expect(caret).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await caret.focus();
      await expect(caret).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expectReachable(page, page.locator('#brand-home .brand-mark'));
    });
  });
}
