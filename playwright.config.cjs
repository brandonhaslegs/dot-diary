const { defineConfig } = require('playwright/test');
module.exports = defineConfig({
  testDir: './tests/mobile',
  timeout: 30000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:8788', hasTouch: true, isMobile: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'webkit-small', use: { browserName: 'webkit', viewport: { width: 320, height: 568 } } },
    { name: 'webkit-iphone', use: { browserName: 'webkit', viewport: { width: 390, height: 844 } } },
    { name: 'chromium-android', use: { browserName: 'chromium', viewport: { width: 412, height: 915 } } },
    { name: 'webkit-landscape', use: { browserName: 'webkit', viewport: { width: 844, height: 390 } } }
  ],
  webServer: { command: 'python3 -m http.server 8788', url: 'http://127.0.0.1:8788', reuseExistingServer: !process.env.CI }
});
