/**
 * profile/local-history — the dedicated, full-screen history screen.
 *
 * Shows every stored search with its relative time ("2 hours ago") and a delete
 * button per row, plus the time-range clear actions: last 24 hours, last week,
 * last month, last year, and everything.
 *
 * Every destructive action asks first, because there is no undo and no server
 * copy to restore from.
 */

import {
  RANGES,
  clearRange,
  getHistory,
  onHistoryChange,
  relativeTime,
  removeHistoryItem,
} from "./history-manager.js";

/**
 * @param {HTMLElement} container
 * @param {{onPick?: (query: string) => void, onCleared?: () => void}} handlers
 */
export function mountHistoryView(container, handlers = {}) {
  if (!container) throw new Error("mountHistoryView: container is required");

  const section = document.createElement("div");
  section.className = "history-screen";

  const ranges = document.createElement("div");
  ranges.className = "history-ranges";
  ranges.setAttribute("role", "group");
  ranges.setAttribute("aria-label", "Clear history by time range");

  const list = document.createElement("ul");
  list.className = "history-full-list";

  const status = document.createElement("p");
  status.className = "feed-muted";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;

  section.append(ranges, status, list);
  container.appendChild(section);

  const rangeButtons = Object.entries(RANGES).map(([key, config]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "range-chip";
    button.dataset.range = key;
    button.textContent = config.label;
    button.addEventListener("click", () => {
      const entries = getHistory();
      const cutoff = config.ms === null ? 0 : Date.now() - config.ms;
      const affected = config.ms === null ? entries.length : entries.filter((entry) => entry.at < cutoff).length;
      if (affected === 0) {
        announce(`Nothing older than ${config.label.replace(/^Last /, "").toLowerCase()} to clear.`);
        return;
      }
      const noun = affected === 1 ? "search" : "searches";
      const confirmed = window.confirm(
        config.ms === null
          ? `Clear all ${affected} ${noun}? This cannot be undone.`
          : `Clear ${affected} ${noun} older than ${config.label.replace(/^Last /, "").toLowerCase()}?`,
      );
      if (!confirmed) return;
      const result = clearRange(key);
      announce(`Cleared ${result.removed} ${result.removed === 1 ? "search" : "searches"}.`);
      render();
      if (typeof handlers.onCleared === "function") handlers.onCleared();
    });
    ranges.appendChild(button);
    return button;
  });

  function announce(message) {
    status.hidden = false;
    status.textContent = message;
  }

  function render() {
    const entries = getHistory();
    rangeButtons.forEach((button) => {
      button.disabled = entries.length === 0;
    });

    list.textContent = "";
    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "feed-muted";
      empty.textContent = "No searches yet on this device.";
      list.appendChild(empty);
      return;
    }

    const now = Date.now();
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "history-full-item";

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "history-full-query";
      pick.textContent = entry.query;
      pick.addEventListener("click", () => {
        if (typeof handlers.onPick === "function") handlers.onPick(entry.query);
      });

      const time = document.createElement("span");
      time.className = "history-time";
      time.textContent = relativeTime(entry.at, now);
      time.title = new Date(entry.at).toLocaleString();

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "history-delete";
      remove.setAttribute("aria-label", `Delete ${entry.query}`);
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        removeHistoryItem(entry.query);
        announce(`Deleted “${entry.query}”.`);
        render();
      });

      item.append(pick, time, remove);
      list.appendChild(item);
    });
  }

  onHistoryChange(render);
  render();

  return { element: section, refresh: render };
}
