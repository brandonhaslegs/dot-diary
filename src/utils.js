// formatISODate: Formats a Date as YYYY-MM-DD for storage and lookups.
export function formatISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// buildMonthCells: Builds the 6x7 month grid model used by the calendar views.
export function buildMonthCells(monthDate, weekStartsMonday = false) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const first = new Date(year, month, 1);
  const startOffset = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const start = new Date(year, month, 1 - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      date,
      iso: formatISODate(date),
      inCurrentMonth: date.getMonth() === month
    });
  }

  return cells;
}

// startOfMonth: Returns a Date pinned to the first day of the given month.
export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// hash32: Builds a deterministic 32-bit hash used for stable pseudo-random placement.
export function hash32(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// shuffleArray: Returns a shuffled copy of an array.
export function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// clamp: Constrains a numeric value between the provided min and max.
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// normalizeNote: Trims and normalizes note text to the app's short-note format.
export function normalizeNote(value) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
}

// weekdayShort: Returns a short weekday label for a Date.
export function weekdayShort(date) {
  return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][date.getDay()];
}

// isMobileView: Returns whether the current viewport matches the mobile layout breakpoint.
export function isMobileView() {
  return window.matchMedia("(max-width: 920px)").matches;
}

// monthDiff: Returns the month distance between two dates.
export function monthDiff(laterDate, earlierDate) {
  return (
    (laterDate.getFullYear() - earlierDate.getFullYear()) * 12 +
    (laterDate.getMonth() - earlierDate.getMonth())
  );
}
