import { test, expect } from "@playwright/test";

const STORAGE_KEY = "dot-diary-v1";
const STORAGE_SESSION_FALLBACK_KEY = "dot-diary-v1-session";
const VIEW_MODE_KEY = "dot-diary-view-mode";
const APP_ENTRY_KEY = "dot-diary-entered-app";
const ONBOARDING_KEY = "dot-diary-onboarding-v1";

function testISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-15`;
}

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

function dayLocator(page, iso) {
  return page.locator(`.year-day[data-date='${iso}'], .month-day[data-date='${iso}']`).first();
}

test("dot type add + rename + recolor persists", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop-focused dot-type management");
  await seedAndOpenDiary(page);
  await page.keyboard.press("?");
  await expect(page.locator("#settings-modal")).toBeVisible();

  const before = await page.locator("#dot-type-list .dot-type-row").count();
  await page.locator("#suggested-dot-list .suggestion-chip.add-new").click();
  await expect(page.locator("#dot-type-list .dot-type-row")).toHaveCount(before + 1);

  const row = page.locator("#dot-type-list .dot-type-row").last();
  const input = row.locator("input.dot-name-input");
  await input.fill("Hydration");
  await input.evaluate((el) => el.blur());

  await row.locator(".swatch").first().click();
  const swatches = row.locator(".color-picker .color-swatch");
  await swatches.nth(1).click();

  await page.reload();
  await page.click("#open-settings");

  const names = await page.locator("#dot-type-list input.dot-name-input").evaluateAll((nodes) =>
    nodes.map((node) => node.value)
  );
  expect(names).toContain("Hydration");

  const persisted = await page.evaluate((key) => {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    const data = parsed?.data ?? parsed;
    return data?.dotTypes || [];
  }, STORAGE_KEY);

  const hydration = persisted.find((dot) => dot.name === "Hydration");
  expect(Boolean(hydration)).toBe(true);
  expect(hydration.color).not.toBe("#2F8CFA");
});

test("dot type delete persists", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop-focused dot-type management");
  await seedAndOpenDiary(page);
  await page.keyboard.press("?");
  await expect(page.locator("#settings-modal")).toBeVisible();
  await page.locator("#suggested-dot-list .suggestion-chip.add-new").click();

  const row = page.locator("#dot-type-list .dot-type-row").last();
  await row.locator("input.dot-name-input").fill("DeleteMe");
  await row.locator("input.dot-name-input").evaluate((el) => el.blur());

  await row.locator(".dot-actions-toggle").click();
  await row.locator(".dot-actions-menu .dot-actions-item", { hasText: "Delete" }).click();
  await page.click("#delete-confirm");

  await page.reload();
  await page.click("#open-settings");
  const names = await page.locator("#dot-type-list input.dot-name-input").evaluateAll((nodes) =>
    nodes.map((node) => node.value)
  );
  expect(names).not.toContain("DeleteMe");
});

test("dragging a dot saves position", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop-only for stable drag assertions");

  const state = seededState();
  state.data.dayDots[testISO()] = ["reading"];
  await seedAndOpenDiary(page, state);

  const sticker = dayLocator(page, testISO()).locator(".dot-sticker").first();
  await expect(sticker).toBeVisible();
  const box = await sticker.boundingBox();
  if (!box) throw new Error("dot sticker has no bounding box");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 26, box.y + box.height / 2 + 18, { steps: 6 });
  await page.mouse.up();

  const persisted = await page.evaluate(
    ({ key, iso }) => {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      const data = parsed?.data ?? parsed;
      return data?.dotPositions?.[iso]?.reading || null;
    },
    { key: STORAGE_KEY, iso: testISO() }
  );

  expect(persisted).toBeTruthy();
  expect(typeof persisted.left).toBe("number");
  expect(typeof persisted.top).toBe("number");
});

test("import data applies and persists", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop-focused import interaction");
  await seedAndOpenDiary(page);

  const imported = seededState();
  imported.data.dotTypes.push({ id: "imported", name: "Imported Dot", color: "#FF0000" });
  imported.data.dayNotes[testISO()] = "Imported note";

  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      data: imported.data
    })
  );

  await page.setInputFiles("#upload-data-input", {
    name: "import.json",
    mimeType: "application/json",
    buffer: payload
  });

  await page.reload();
  await page.keyboard.press("?");
  const names = await page.locator("#dot-type-list input.dot-name-input").evaluateAll((nodes) =>
    nodes.map((node) => node.value)
  );
  expect(names).toContain("Imported Dot");
  await expect(dayLocator(page, testISO()).locator(".day-note, .month-note")).toContainText("Imported note");
});

test("keyboard shortcuts work for core navigation", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop-only keyboard nav assertion");
  await seedAndOpenDiary(page);

  await page.keyboard.press("?");
  await expect(page.locator("#settings-modal")).toBeVisible();
  await page.keyboard.press("Escape");

  const yearBefore = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  await page.keyboard.press("KeyY");
  await expect(page.locator("#period-picker-menu")).toBeVisible();
  await page.keyboard.press("KeyY");
  await expect(page.locator("#period-picker-menu")).toHaveClass(/hidden/);
  const yearAfter = (await page.locator("#period-picker-label").textContent())?.trim() || "";
  expect(yearAfter).toBe(yearBefore);
});

test("mobile month scroll loads more sections", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "Mobile-only scroll behavior");
  await seedAndOpenDiary(page);

  const monthGrid = page.locator("#month-grid");
  await expect(monthGrid).toBeVisible();
  const before = await page.locator("#month-grid .month-scroll-section").count();

  await page.evaluate(() => {
    const grid = document.querySelector("#month-grid");
    if (!grid) return;
    grid.scrollTop = 0;
    grid.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect(page.locator("#month-grid .month-scroll-section")).toHaveCount(before + 12);
});
