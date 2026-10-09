const { test, expect } = require('playwright/test');

for (const desktop of [false, true]) {
  test.describe(desktop ? 'desktop calendar switching' : 'touch calendar switching', () => {
    if (desktop) test.use({ viewport: { width: 1280, height: 900 }, isMobile: false });
    test('header calendar selection survives the click and background cloud updates', async ({ page }) => {
      await page.route('https://**/*', route => route.abort());
      await page.route('**/api/billing/status', route => route.fulfill({ json: {
        isUnlimited: true, features: { unlimitedCalendars: true, unlimitedDotTypes: true }
      } }));
      await page.addInitScript(() => {
        localStorage.setItem('dot-diary-v1', JSON.stringify({
          dotTypes: [{ id: 'reading', name: 'Reading', color: '#ff0000' }], dayDots: {}, dayNotes: {}
        }));
        for (const key of ['dot-diary-onboarding-v1', 'dot-diary-entered-app', 'dot-diary-authenticated']) {
          localStorage.setItem(key, '1');
        }
      });
      await page.goto('/');
      await page.evaluate(async () => {
        await (await import('/src/billing.js')).fetchBillingStatus('test-token', 'test-user');
        (await import('/src/ui.js')).openSettingsModal('calendars');
      });
      const activate = locator => desktop ? locator.click() : locator.tap();
      await activate(page.locator('#calendar-add'));
      await expect(page.locator('.calendar-row').filter({ hasText: 'Current' }).locator('input')).toHaveValue('New calendar');
      await activate(page.getByRole('button', { name: 'Open My diary', exact: true }));
      await activate(page.getByRole('button', { name: 'Open New calendar', exact: true }));
      await activate(page.locator('#settings-close'));
      await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);
      for (const name of ['My diary', 'New calendar']) {
        await activate(page.locator('#calendar-toggle'));
        await activate(page.getByRole('menuitemradio', { name, exact: true }));
        await expect(page.locator('#calendar-menu')).toHaveClass(/hidden/);
        // Reopen after the gesture completes to catch an immediate switch-back.
        await page.waitForTimeout(500);
        await activate(page.locator('#calendar-toggle'));
        await expect(page.getByRole('menuitemradio', { name, exact: true })).toHaveAttribute('aria-checked', 'true');
        await activate(page.locator('#calendar-toggle'));
      }
      // Apply a cloud response using the same merge policy as loadFromCloud.
      // The server still has the previous selection, including when its content is newer.
      await page.evaluate(async () => {
        const store = await import('/src/state.js');
        const { mergeDiaryStates } = await import('/src/sync-core.mjs');
        const remote = structuredClone(store.state);
        remote.activeCalendarId = 'default';
        remote.lastModified = '2099-01-01T00:00:00.000Z';
        remote.calendars.find(c => c.id === 'default').dayNotes['2026-10-09'] = 'Cloud note';
        store.setState(mergeDiaryStates(store.state, remote, {
          preferLocalSettings: true, preferLocalConflicts: false
        }));
        store.requestRender();
      });
      await activate(page.locator('#calendar-toggle'));
      await expect(page.getByRole('menuitemradio', { name: 'New calendar', exact: true })).toHaveAttribute('aria-checked', 'true');
      await activate(page.locator('#calendar-toggle'));
      await page.evaluate(async () => (await import('/src/ui.js')).openSettingsModal('calendars'));
      await expect(page.locator('.calendar-row').filter({ hasText: 'Current' }).locator('input')).toHaveValue('New calendar');
      await expect.poll(() => page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        return state.dotTypes;
      })).toEqual([]);
      await activate(page.getByRole('button', { name: 'Open My diary', exact: true }));
      await expect.poll(() => page.evaluate(async () => (await import('/src/state.js')).state.dayNotes['2026-10-09'])).toBe('Cloud note');
    });
  });
}
