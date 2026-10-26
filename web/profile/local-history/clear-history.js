/**
 * profile/local-history — the history panel and its destructive action.
 *
 * Renders recent searches with individual remove buttons plus a "clear all"
 * button that asks for confirmation first, because clearing is irreversible.
 */

import { getHistory, removeHistoryItem, clearHistory, onHistoryChange } from "./history-manager.js";
import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

/**
 * @param {HTMLElement} container
 * @param {{onCleared?: () => void, onPick?: (query: string) => void}} handlers
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
  header.append(heading, clearButton);

  const list = document.createElement("ul");
  list.className = "history-list";

  const status = document.createElement("p");
  status.className = "feed-muted";
  status.hidden = true;

  section.append(header, list, status);
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
    entries.forEach((entry) => {
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
      remove.textContent = "×";
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
      ? window.confirm(`${t("clearHistory")} — ${entries.length} ${entries.length === 1 ? t("result") : t("results")}?`)
      : true;
    if (!confirmed) return;
    clearHistory();
    render();
    status.hidden = false;
    status.textContent = t("historyCleared");
    if (typeof handlers.onCleared === "function") handlers.onCleared();
  });

  onHistoryChange(render);
  onLangChange(render);
  render();

  return { element: section, refresh: render };
}
