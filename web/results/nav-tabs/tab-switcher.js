/**
 * results/nav-tabs — ALL vs AI.
 *
 * "All" renders the gateway's structured cards. "AI" renders the same query
 * through /v1/retrieve, which returns the token-optimised payload an LLM client
 * would receive. The component only reports the active tab.
 */

import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

export const TABS = ["all", "ai"];

/**
 * @param {HTMLElement} container
 * @param {{onChange: (tab: "all"|"ai") => void, initial?: "all"|"ai"}} options
 */
export function mountTabSwitcher(container, options = {}) {
  if (!container) throw new Error("mountTabSwitcher: container is required");

  let active = options.initial === "ai" ? "ai" : "all";

  const wrap = document.createElement("div");
  wrap.className = "tabs";
  wrap.setAttribute("role", "tablist");
  wrap.setAttribute("aria-label", "Result views");

  const buttons = TABS.map((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.dataset.tab = tab;
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => setActive(tab));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const index = TABS.indexOf(active);
      const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      setActive(next);
      const target = buttons.find((entry) => entry.dataset.tab === next);
      if (target) target.focus();
    });
    wrap.appendChild(button);
    return button;
  });

  container.appendChild(wrap);

  function sync() {
    const labels = { all: t("tabAll"), ai: t("tabAI") };
    buttons.forEach((button) => {
      const tab = button.dataset.tab;
      button.textContent = labels[tab];
      button.setAttribute("aria-selected", String(tab === active));
      button.tabIndex = tab === active ? 0 : -1;
      button.title = tab === "ai" ? t("tabAIHint") : "";
    });
  }

  function setActive(tab) {
    const next = TABS.includes(tab) ? tab : "all";
    if (next === active) {
      sync();
      return;
    }
    active = next;
    sync();
    if (typeof options.onChange === "function") options.onChange(active);
  }

  sync();
  onLangChange(sync);

  return { element: wrap, setActive, getActive: () => active };
}
