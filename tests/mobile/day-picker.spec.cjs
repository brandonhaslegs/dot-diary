const { test, expect } = require('playwright/test');

for (const desktop of [false, true]) {
  test.describe(desktop ? 'desktop day picker' : 'touch day picker', () => {
    if (desktop) test.use({ viewport: { width: 1280, height: 900 }, isMobile: false });
    test('opening gesture keeps picker open; outside gesture only dismisses', async ({ page }) => {
      await page.route('https://**/*', route => route.abort());
      await page.addInitScript(() => {
        localStorage.setItem('dot-diary-v1', JSON.stringify({
          dotTypes: [{ id: 'a', name: 'Exercise', color: '#ff0000' }], dayDots: {}, dayNotes: {}
        }));
        localStorage.setItem('dot-diary-onboarding-v1', '1');
        localStorage.setItem('dot-diary-entered-app', '1');
        localStorage.setItem('dot-diary-authenticated', '1');
      });
      await page.goto('/');
      const day = page.locator('.month-day.current-day, .year-day.current-day').filter({ visible: true }).first();
      const picker = page.locator('#day-popover');
      const activate = locator => desktop ? locator.click() : locator.tap();
      await activate(day);
      await expect(picker).toHaveClass(/visible/);
      // Wait beyond the hide animation so a brief flash cannot pass this check.
      await page.waitForTimeout(500);
      await expect(picker).toBeVisible();
      await expect(picker).not.toHaveClass(/hidden/);
      await activate(picker.getByText('Exercise', { exact: true }));
      await expect(picker).toHaveClass(/hidden/);
      await expect(day.locator('.dot-sticker')).toHaveCount(1);
      await activate(day.locator('.dot-sticker'));
      await expect(picker).toHaveClass(/visible/);
      if (desktop) await page.mouse.click(5, 5);
      else await page.touchscreen.tap(5, 5);
      await expect(picker).toHaveClass(/hidden/);
      await activate(day);
      await expect(picker).toHaveClass(/visible/);
    });
  });
}
