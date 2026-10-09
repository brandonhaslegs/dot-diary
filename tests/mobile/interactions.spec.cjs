const { test, expect } = require('playwright/test');

const { expectInViewport: inViewport, expectReachable } = require('./helpers/layout.cjs');

async function settings(page) {
  await page.locator('#mobile-overflow-toggle').tap();
  await page.locator('#mobile-settings').tap();
  await expect(page.locator('#settings-modal')).toHaveClass(/visible/);
}
async function screenshot(page, info, name) {
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
  await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' });
}
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem('dot-diary-v1')) localStorage.setItem('dot-diary-v1', JSON.stringify({ dotTypes: [{id:'a',name:'Exercise',color:'#ff0000'},{id:'b',name:'Reading',color:'#0000ff'}], dayDots: {}, dayNotes: {} }));
    localStorage.setItem('dot-diary-onboarding-v1','1');
    localStorage.setItem('dot-diary-entered-app','1');
    localStorage.setItem('dot-diary-authenticated','1');
  });
  await page.goto('/');
});
test('one tap opens a day; adding, reopening a dot and notes persist', async ({ page }, info) => {
  const day = page.locator('.month-day.current-day, .year-day.current-day').filter({ visible: true }).first();
  await day.tap();
  const popover = page.locator('#day-popover');
  await expect(popover).toHaveClass(/visible/);
  await inViewport(page, popover);
  await screenshot(page, info, 'day-sheet');
  await popover.getByText('Exercise', {exact:true}).tap();
  await expect(popover).toHaveClass(/hidden/);
  await day.locator('.dot-sticker').tap();
  await expect(popover).toHaveClass(/visible/);
  await popover.getByText('Add note', {exact:false}).tap();
  await page.locator('.note-editor').fill('Mobile test note');
  await page.locator('.note-editor').press('Enter');
  await page.reload();
  await expect(page.locator('.month-note, .day-note').filter({hasText:'Mobile test note'}).first()).toBeVisible();
  await screenshot(page, info, 'saved-note');
});
test('period, overflow, filters and sharing stay reachable', async ({ page }, info) => {
  await page.locator('#period-picker-toggle').tap();
  await inViewport(page, page.locator('#period-picker-menu'));
  await screenshot(page, info, 'period-menu');
  await page.locator('#period-picker-menu button').first().tap();
  await expect(page.locator('#period-picker-menu')).toHaveClass(/hidden/);
  await page.locator('#mobile-overflow-toggle').tap();
  await inViewport(page, page.locator('#mobile-overflow-menu'));
  await page.locator('#mobile-filters').tap();
  await inViewport(page, page.locator('#filter-menu'));
  await expectReachable(page, page.locator('#show-calendar-notes'));
  await page.locator('#show-calendar-notes').uncheck();
  await expect(page.locator('#show-calendar-notes')).not.toBeChecked();
  await screenshot(page, info, 'filters');
  await page.keyboard.press('Escape');
  await expect(page.locator('#filter-menu')).toHaveClass(/hidden/);
  await page.locator('#mobile-overflow-toggle').tap();
  await page.locator('#mobile-share').tap();
  await expect(page.locator('#share-modal')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Sharing is available with Unlimited');
  // Grant the paid fixture through the real billing loader, with a mocked server response.
  await page.route('**/api/billing/status', route => route.fulfill({
    json: { isUnlimited: true, features: { unlimitedDotTypes: true, unlimitedCalendars: true, diarySharing: true, billingPortal: false } }
  }));
  await page.evaluate(async () => {
    const { fetchBillingStatus } = await import('/src/billing.js');
    await fetchBillingStatus('test-token', 'test-account');
  });
  await page.locator('#mobile-overflow-toggle').tap();
  await page.locator('#mobile-share').tap();
  await inViewport(page, page.locator('#share-modal .modal-card'));
  await page.locator('#share-close').tap();
});
test('settings tabs, dot actions, colors and delete dialog', async ({ page }, info) => {
  await settings(page);
  await page.locator('#dot-type-list .dot-actions-toggle').first().tap();
  await inViewport(page, page.locator('.dot-actions-menu.visible'));
  await screenshot(page, info, 'dot-actions');
  await page.locator('.dot-actions-menu.visible').getByText('Change color', {exact:true}).tap();
  await inViewport(page, page.locator('.color-picker.visible'));
  await screenshot(page, info, 'color-picker');
  await page.locator('.color-picker.visible .color-swatch').last().tap();
  await page.locator('#dot-type-list .dot-actions-toggle').first().tap();
  await page.locator('.dot-actions-menu.visible').getByText('Delete', {exact:true}).tap();
  await inViewport(page, page.locator('#delete-modal .modal-card'));
  await page.locator('#delete-cancel').tap();
  await expect(page.locator('#delete-modal')).toHaveClass(/hidden/);
  for (const tab of ['calendars','preferences','import-export','account','dot-types']) {
    await page.locator(`#settings-tab-${tab}`).tap();
    await expect(page.locator(`#settings-panel-${tab}`)).toBeVisible();
    await screenshot(page, info, `settings-${tab}`);
  }
  await page.locator('#settings-close').tap();
  await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);
});
