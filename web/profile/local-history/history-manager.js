/**
 * profile/local-history — search history, device-local only.
 *
 * Stored in localStorage under one key as `{ query, at }` records, where `at` is
 * a Unix timestamp in milliseconds. Newest first, de-duplicated
 * case-insensitively, capped at [HISTORY_LIMIT]. Nothing is sent anywhere: this
 * is the browser's own storage, so deleting is a real delete.
 */

const STORAGE_KEY = "eyesearch:history";
export const HISTORY_LIMIT = 200;

/** Time ranges offered by the history screen, in milliseconds. */
export const RANGES = {
  "24h": { label: "Last 24 Hours", ms: 24 * 60 * 60 * 1000 },
  "1w": { label: "Last 1 Week", ms: 7 * 24 * 60 * 60 * 1000 },
  "1m": { label: "Last 1 Month", ms: 30 * 24 * 60 * 60 * 1000 },
  "1y": { label: "Last 1 Year", ms: 365 * 24 * 60 * 60 * 1000 },
  all: { label: "All Time (Clear All)", ms: null },
};

const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.query === "string")
      .map((entry) => ({
        query: entry.query,
        at: typeof entry.at === "number" ? entry.at : Date.parse(entry.at) || Date.now(),
      }))
      .sort((a, b) => b.at - a.at)
      .slice(0, HISTORY_LIMIT);
  } catch (error) {
    return [];
  }
}

function write(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    /* quota or private mode: history is a convenience, never a requirement */
  }
  listeners.forEach((handler) => handler(getHistory()));
  document.dispatchEvent(new CustomEvent("eyesearch:history", { detail: { entries } }));
}

/** @returns {Array<{query: string, at: number}>} newest first */
export function getHistory() {
  return read();
}

export function addHistory(query) {
  const cleaned = String(query || "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return getHistory();
  const existing = read();
  const withoutDuplicate = existing.filter((entry) => entry.query.toLowerCase() !== cleaned.toLowerCase());
  const next = [{ query: cleaned, at: Date.now() }, ...withoutDuplicate].slice(0, HISTORY_LIMIT);
  write(next);
  return next;
}

export function removeHistoryItem(query) {
  const target = String(query || "").toLowerCase();
  const next = read().filter((entry) => entry.query.toLowerCase() !== target);
  write(next);
  return next;
}

/** Delete every entry older than `ms` milliseconds. `null` clears everything. */
export function clearRange(range) {
  const key = RANGES[range] ? range : "all";
  if (RANGES[key].ms === null) return clearHistory();
  const cutoff = Date.now() - RANGES[key].ms;
  const before = read();
  const next = before.filter((entry) => entry.at >= cutoff);
  write(next);
  return { removed: before.length - next.length, remaining: next };
}

export function clearHistory() {
  const before = read().length;
  write([]);
  return { removed: before, remaining: [] };
}

export function onHistoryChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago", "2 months ago"… */
export function relativeTime(at, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - Number(at)) / 1000));
  if (seconds < 45) return "just now";
  const units = [
    { limit: 90, divisor: 60, one: "a minute", other: "minutes" },
    { limit: 3600, divisor: 60, one: "a minute", other: "minutes" },
    { limit: 5400, divisor: 3600, one: "an hour", other: "hours" },
    { limit: 86400, divisor: 3600, one: "an hour", other: "hours" },
    { limit: 172800, divisor: 86400, one: "a day", other: "days" },
    { limit: 604800, divisor: 86400, one: "a day", other: "days" },
    { limit: 1209600, divisor: 604800, one: "a week", other: "weeks" },
    { limit: 2592000, divisor: 604800, one: "a week", other: "weeks" },
    { limit: 5184000, divisor: 2592000, one: "a month", other: "months" },
    { limit: 31536000, divisor: 2592000, one: "a month", other: "months" },
    { limit: 63072000, divisor: 31536000, one: "a year", other: "years" },
  ];
  for (const unit of units) {
    if (seconds < unit.limit) {
      const value = Math.max(1, Math.round(seconds / unit.divisor));
      const phrase = value === 1 ? unit.one : `${value} ${unit.other}`;
      return `${phrase} ago`;
    }
  }
  const years = Math.max(1, Math.round(seconds / 31536000));
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}
