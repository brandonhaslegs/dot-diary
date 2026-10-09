const { test, expect } = require('playwright/test');

for (const desktop of [false, true]) {
  test.describe(desktop ? 'desktop day picker' : 'touch day picker', () => {
    if (desktop) test.use({ viewport: { width: 1280, height: 900 }, isMobile: false });
    test.beforeEach(async ({ page }) => {
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
    });
    test('opening gesture keeps picker open; outside gesture only dismisses', async ({ page }) => {
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
    for (const firstCharacter of ['D', 'd', 'N', 'Y', '?']) {
      test(`typing ${firstCharacter} starts a note instead of a shortcut`, async ({ page }) => {
        const day = page.locator('.month-day.current-day, .year-day.current-day').filter({ visible: true }).first();
        if (desktop) await day.click();
        else await day.tap();
        await expect(page.locator('#day-popover')).toHaveClass(/visible/);
        await page.keyboard.type(`${firstCharacter}aily note`);
        const editor = page.locator('.note-editor').filter({ visible: true });
        await expect(editor).toHaveText(`${firstCharacter}aily note`);
        await expect(editor).toBeFocused();
        await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('dot-diary-v1')).data.dayNotes))).toContain(`${firstCharacter}aily note`);
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dot-diary-v1')).data.dotTypes.length)).toBe(1);
      });
    }
  });
}
