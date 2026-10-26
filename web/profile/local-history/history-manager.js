/**
 * profile/local-history — search history, device-local only.
 *
 * Stored in localStorage under one key, newest first, de-duplicated
 * case-insensitively and capped. Nothing is sent anywhere: this is the browser's
 * own storage, so clearing it is genuinely a delete.
 */

import { t } from "../../menu/language-selector/lang-switcher.js";

const STORAGE_KEY = "eyesearch:history";
export const HISTORY_LIMIT = 40;

const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.query === "string").slice(0, HISTORY_LIMIT);
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

/** @returns {Array<{query: string, at: number}>} */
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

export function clearHistory() {
  write([]);
  return [];
}

export function onHistoryChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function historyLabel() {
  return t("historyTitle");
}
