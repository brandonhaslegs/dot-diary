import { test, expect } from "@playwright/test";

const STORAGE_KEY = "dot-diary-v1";
const STORAGE_SESSION_FALLBACK_KEY = "dot-diary-v1-session";
const VIEW_MODE_KEY = "dot-diary-view-mode";
const APP_ENTRY_KEY = "dot-diary-entered-app";
const ONBOARDING_KEY = "dot-diary-onboarding-v1";

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function testISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-15`;
}

function seededState() {
  const now = new Date();
  const monthCursor = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return {
    data: {
      monthCursor,
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

test("dot remains after page refresh", async ({ page }) => {
  await seedAndOpenDiary(page);
  const iso = testISO();
  const day = dayLocator(page, iso);
  await expect(day).toBeVisible();

  await day.click();
  const firstDotOption = page.locator("#day-popover .popover-item").first();
  await expect(firstDotOption).toBeVisible();
  await firstDotOption.click();

  await expect(day.locator(".dot-sticker")).toHaveCount(1);

  await page.reload();
  const dayAfterReload = dayLocator(page, iso);
  await expect(dayAfterReload.locator(".dot-sticker")).toHaveCount(1);
});

test("note remains after page refresh", async ({ page }) => {
  await seedAndOpenDiary(page);
  const iso = testISO();
  const day = dayLocator(page, iso);
  await expect(day).toBeVisible();

  await day.click();
  const addNoteButton = page.getByRole("button", { name: /add note/i });
  await expect(addNoteButton).toBeVisible();
  await addNoteButton.click();

  const editor = day.locator(".note-editor").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type("Persistence smoke note");

  await page.locator("header.topbar").click({ force: true });
  await expect(day.locator(".day-note, .month-note")).toContainText("Persistence smoke note");

  await page.reload();
  await expect(dayLocator(page, iso).locator(".day-note, .month-note")).toContainText("Persistence smoke note");
});

test("falls back to sessionStorage when localStorage write fails", async ({ context, page }) => {
  await seedAndOpenDiary(page);
  await context.addInitScript(({ storageKey }) => {
    const nativeSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === storageKey) throw new Error("blocked localStorage write");
      return nativeSetItem(key, value);
    };
  }, { storageKey: STORAGE_KEY });

  const iso = testISO();
  const day = dayLocator(page, iso);
  await day.click();
  await page.locator("#day-popover .popover-item").first().click();
  await expect(day.locator(".dot-sticker")).toHaveCount(1);

  await page.reload();
  const dayAfterReload = dayLocator(page, iso);
  await expect(dayAfterReload.locator(".dot-sticker")).toHaveCount(1);
});

test("loads newest snapshot between localStorage and sessionStorage", async ({ page }) => {
  const base = seededState();
  const stale = structuredClone(base);
  stale.data.lastModified = "2026-01-01T00:00:00.000Z";
  stale.data.dayNotes[testISO()] = "old";
  const fresh = structuredClone(base);
  fresh.data.lastModified = "2026-01-02T00:00:00.000Z";
  fresh.data.dayNotes[testISO()] = "new";

  await page.goto("/?local=1");
  await page.evaluate(
    ({ storageKey, sessionKey, staleRaw, freshRaw, viewModeKey, appEntryKey, onboardingKey }) => {
      localStorage.setItem(storageKey, staleRaw);
      sessionStorage.setItem(sessionKey, freshRaw);
      localStorage.setItem(viewModeKey, "app");
      localStorage.setItem(appEntryKey, "1");
      localStorage.setItem(onboardingKey, "1");
    },
    {
      storageKey: STORAGE_KEY,
      sessionKey: STORAGE_SESSION_FALLBACK_KEY,
      staleRaw: JSON.stringify(stale),
      freshRaw: JSON.stringify(fresh),
      viewModeKey: VIEW_MODE_KEY,
      appEntryKey: APP_ENTRY_KEY,
      onboardingKey: ONBOARDING_KEY
    }
  );

  await page.reload();
  await expect(dayLocator(page, testISO()).locator(".day-note, .month-note").first()).toContainText("new");
});
