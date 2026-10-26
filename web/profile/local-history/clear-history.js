/**
 * profile/local-history — the profile popover's history summary.
 *
 * Shows the five most recent searches with per-item delete, a "Clear history"
 * action, and the entry point to the full-screen history (time-range deletion
 * lives there, not here).
 */

import { getHistory, removeHistoryItem, clearHistory, onHistoryChange } from "./history-manager.js";
import { t } from "../../menu/language-selector/lang-switcher.js";

/**
 * @param {HTMLElement} container
 * @param {{onOpenHistory?: () => void, onPick?: (query: string) => void, onCleared?: () => void}} handlers
 */
export function mountClearHistory(container, handlers = {}) {
  if (!container) throw new Error("mountClearHistory: container is required");

  const section = document.createElement("section");
  section.className = "history-panel";

  const header = document.createElement("div");
  header.className = "history-header";
  const heading = document.createElement("h2");
  heading.className = "section-title";
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "feed-action";
  clearButton.dataset.action = "clear-history";
  clearButton.textContent = t("clearHistory");
  header.append(heading, clearButton);

  const list = document.createElement("ul");
  list.className = "history-list";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "feed-action history-open";
  openButton.dataset.action = "open-history";
  openButton.textContent = t("openHistory");
  openButton.addEventListener("click", () => {
    if (typeof handlers.onOpenHistory === "function") handlers.onOpenHistory();
  });

  section.append(header, list, openButton);
  container.appendChild(section);

  const render = () => {
    heading.textContent = t("historyTitle");
    clearButton.textContent = t("clearHistory");
    const entries = getHistory();
    clearButton.disabled = entries.length === 0;

    list.textContent = "";
    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "feed-muted";
      empty.textContent = t("historyEmpty");
      list.appendChild(empty);
      return;
    }
    entries.slice(0, 5).forEach((entry) => {
      const item = document.createElement("li");
      item.className = "history-item";

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "history-query";
      pick.textContent = entry.query;
      pick.addEventListener("click", () => {
        if (typeof handlers.onPick === "function") handlers.onPick(entry.query);
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "history-remove";
      remove.setAttribute("aria-label", `${t("remove")}: ${entry.query}`);
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        removeHistoryItem(entry.query);
        render();
      });

      item.append(pick, remove);
      list.appendChild(item);
    });
  };

  clearButton.addEventListener("click", () => {
    const entries = getHistory();
    if (entries.length === 0) return;
    const confirmed = typeof window.confirm === "function"
      ? window.confirm(`Clear all ${entries.length} searches? This cannot be undone.`)
      : true;
    if (!confirmed) return;
    clearHistory();
    render();
    if (typeof handlers.onCleared === "function") handlers.onCleared();
  });

  onHistoryChange(render);
  render();

  return { element: section, refresh: render };
}
