const { test, expect } = require('playwright/test');

for (const desktop of [false, true]) {
  test.describe(desktop ? 'desktop calendar settings' : 'touch calendar settings', () => {
    if (desktop) test.use({ viewport: { width: 1280, height: 900 }, isMobile: false });

    test('calendar names retain app styling in both themes', async ({ page }, info) => {
      await page.route('https://**/*', route => route.abort());
      await page.addInitScript(() => {
        localStorage.setItem('dot-diary-v1', JSON.stringify({ dotTypes: [], dayDots: {}, dayNotes: {} }));
        for (const key of ['dot-diary-onboarding-v1', 'dot-diary-entered-app', 'dot-diary-authenticated']) localStorage.setItem(key, '1');
      });
      await page.route('**/api/billing/status', route => route.fulfill({ json: { isUnlimited: true } }));
      await page.goto('/');
      await page.evaluate(async () => {
        await (await import('/src/billing.js')).fetchBillingStatus('test-token', 'test-account');
      });
      const activate = locator => desktop ? locator.click() : locator.tap();
      if (desktop) await activate(page.locator('#open-settings'));
      else {
        await activate(page.locator('#mobile-overflow-toggle'));
        await activate(page.locator('#mobile-settings'));
      }
      await activate(page.locator('#settings-tab-calendars'));
      await activate(page.locator('#calendar-add'));
      await expect(page.locator('.calendar-row')).toHaveCount(2);

      for (const theme of ['dark', 'light']) {
        await activate(page.locator('#settings-tab-preferences'));
        await activate(page.locator(`#color-mode-${theme}`));
        await activate(page.locator('#settings-tab-calendars'));
        const background = theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
        const foreground = theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
        for (const input of await page.locator('.calendar-row input').all()) {
          // Computed styles catch native browser inputs even though their
          // default DOM type property is already "text" without the attribute.
          await expect(input).toHaveCSS('background-color', background);
          await expect(input).toHaveCSS('color', foreground);
          await expect(input).toHaveCSS('border-radius', '12px');
          await expect(input).toHaveCSS('font-family', await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily));
          expect((await input.boundingBox()).height).toBeGreaterThanOrEqual(44);
        }
        // The entire outer focus ring must fit inside every clipping ancestor.
        for (const control of await page.locator('.calendar-row input, #calendar-add').all()) {
          await control.focus();
          await expect(control).toBeFocused();
          const clippedBy = await control.evaluate(el => {
            const style = getComputedStyle(el);
            const outset = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
            const rect = el.getBoundingClientRect();
            const clipped = [];
            for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
              const css = getComputedStyle(ancestor);
              const bounds = ancestor.getBoundingClientRect();
              if (css.overflowX !== 'visible' && (rect.left - outset < bounds.left || rect.right + outset > bounds.right)) {
                clipped.push(ancestor.id || ancestor.className);
              }
            }
            return clipped;
          });
          expect(clippedBy, 'focus ring should not be horizontally clipped').toEqual([]);
        }
        const panel = page.locator('#settings-panel-calendars');
        expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`calendars-${theme}.png`) });
      }
      await expect(page.locator('.calendar-current')).toHaveText('Current');
      await page.locator('.calendar-row input').last().fill('Personal');
      await page.locator('.calendar-row input').last().press('Tab');
      await activate(page.locator('.calendar-open'));
      await expect(page.locator('.calendar-row').filter({ has: page.locator('.calendar-current') }).locator('input')).toHaveValue('My diary');
    });
  });
}
