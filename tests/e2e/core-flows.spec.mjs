import { test, expect } from "@playwright/test";

const STORAGE_KEY = "dot-diary-v1";
const STORAGE_SESSION_FALLBACK_KEY = "dot-diary-v1-session";
const VIEW_MODE_KEY = "dot-diary-view-mode";
const APP_ENTRY_KEY = "dot-diary-entered-app";
const ONBOARDING_KEY = "dot-diary-onboarding-v1";

function seededState() {
  const now = new Date();
  return {
    data: {
      monthCursor: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      yearCursor: now.getFullYear(),
      weekStartsMonday: false,
      hideSuggestions: false,
      showKeyboardHints: true,
      darkMode: null,
      lastModified: now.toISOString(),
      dotTypes: [{ id: "reading", name: "Reading", color: "#2F8CFA" }],
      dayDots: {},
      dotPositions: {},
      dayNotes: {}
    }
  };
}

async function seedAndOpenDiary(page, state = seededState()) {
  await page.goto("/?local=1");
  await page.evaluate(
    ({ storageKey, sessionKey, viewModeKey, appEntryKey, onboardingKey, rawState }) => {
      localStorage.setItem(storageKey, rawState);
      sessionStorage.setItem(sessionKey, rawState);
      localStorage.setItem(viewModeKey, "app");
      localStorage.setItem(appEntryKey, "1");
      localStorage.setItem(onboardingKey, "1");
    },
    {
      storageKey: STORAGE_KEY,
      sessionKey: STORAGE_SESSION_FALLBACK_KEY,
      viewModeKey: VIEW_MODE_KEY,
      appEntryKey: APP_ENTRY_KEY,
      onboardingKey: ONBOARDING_KEY,
      rawState: JSON.stringify(state)
    }
  );
  await page.reload();
}

test("preferences persist after refresh", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop-focused settings interaction");
  await seedAndOpenDiary(page);

  await page.keyboard.press("?");
  await expect(page.locator("#settings-modal")).toBeVisible();

  await page.locator("#week-start-monday").scrollIntoViewIfNeeded();
  await page.locator("#week-start-monday").check();
  await page.locator("#show-keyboard-hints").scrollIntoViewIfNeeded();
  await page.locator("#show-keyboard-hints").uncheck();
  await page.click("#color-mode-dark");
  await page.keyboard.press("Escape");

  await page.reload();
  await page.keyboard.press("?");

  await expect(page.locator("#week-start-monday")).toBeChecked();
  await expect(page.locator("#show-keyboard-hints")).not.toBeChecked();
  await expect(page.locator("#color-mode-dark")).toHaveClass(/active/);

  const persisted = await page.evaluate((key) => {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed?.data ?? parsed;
  }, STORAGE_KEY);

  expect(persisted.weekStartsMonday).toBe(true);
  expect(persisted.showKeyboardHints).toBe(false);
  expect(persisted.darkMode).toBe(true);
});

test("desktop period picker navigates years", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop-only test");
  await seedAndOpenDiary(page);

  await expect(page.locator("#year-grid")).toBeVisible();
  await expect(page.locator("#month-grid")).toHaveClass(/hidden/);

  const labelBefore = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  await page.click("#period-picker-toggle");
  await expect(page.locator("#period-picker-menu")).toBeVisible();
  await page.locator("#period-picker-menu .period-picker-item").nth(1).click();
  const labelAfter = (await page.locator("#period-picker-label").textContent())?.trim() || "";

  expect(labelAfter).not.toBe(labelBefore);
});

test("mobile period picker navigates months", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "Mobile-only test");
  await seedAndOpenDiary(page);

  await expect(page.locator("#month-grid")).toBeVisible();
  await expect(page.locator("#year-grid")).toHaveClass(/hidden/);

  const labelBefore = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  await page.click("#period-picker-toggle");
  const targetLabel = await page.evaluate((currentLabel) => {
    const items = Array.from(document.querySelectorAll("#period-picker-menu .period-picker-item"));
    const candidate = items.find((item) => (item.textContent || "").trim() !== currentLabel);
    if (!candidate) return null;
    candidate.click();
    return (candidate.textContent || "").trim();
  }, labelBefore);
  if (!targetLabel) throw new Error("Could not find alternate month in picker");
  const labelAfter = (await page.locator("#period-picker-label").textContent())?.trim() || "";

  expect(labelAfter).not.toBe(labelBefore);
  expect(Boolean(targetLabel)).toBe(true);

  // Guard against "snaps back to current month" after async updates/polling.
  await page.waitForTimeout(1200);
  const labelLater = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  expect(labelLater).toBe(targetLabel);
});

test("mobile scroll to older months does not snap back to current", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "Mobile-only test");
  await seedAndOpenDiary(page);

  const labelBefore = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  await expect(page.locator("#month-grid")).toBeVisible();

  await page.evaluate(() => {
    const grid = document.querySelector("#month-grid");
    if (!grid) return;
    const jump = Math.max(grid.clientHeight * 3, 600);
    grid.scrollTop = Math.max(0, grid.scrollTop - jump);
    grid.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await page.waitForTimeout(600);
  const labelAfterScroll = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  expect(labelAfterScroll).not.toBe(labelBefore);

  await page.waitForTimeout(1500);
  const labelLater = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  expect(labelLater).toBe(labelAfterScroll);
});

test("local mode bypasses login gate", async ({ page }) => {
  await page.goto("/?local=1");
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator("#marketing-page")).toHaveClass(/hidden/);

  await page.click("#open-settings");
  await expect(page.locator("#auth-status")).toContainText("Local dev mode");
});
