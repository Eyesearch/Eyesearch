/**
 * results/nav-tabs — ALL vs AI.
 *
 * "All" renders the gateway's structured cards. "AI" renders the same query
 * through /v1/retrieve, which returns the token-optimised payload an LLM client
 * would receive. The component only reports the active tab.
 */

import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

// AI Mode leads the bar; "All" stays the default the user lands on.
export const TABS = ["ai", "all"];
export const DEFAULT_TAB = "all";

/**
 * @param {HTMLElement} container
 * @param {{onChange: (tab: "all"|"ai") => void, initial?: "all"|"ai"}} options
 */
export function mountTabSwitcher(container, options = {}) {
  if (!container) throw new Error("mountTabSwitcher: container is required");

  let active = options.initial === "ai" ? "ai" : DEFAULT_TAB;

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

  // A robot glyph rather than a text label: the pill is icon-only, and the
  // accessible name and tooltip carry "AI Mode".
  const robotIcon = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("tab-icon", "tab-icon-bot");
    const strokes = [
      // antenna
      "M12 3v3",
      "M9 6h6",
      // head
      "M6 9h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z",
      // eyes
      "M9.5 12.5h.01",
      "M14.5 12.5h.01",
      // mouth
      "M9.5 15.5h5",
    ];
    strokes.forEach((d) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.7");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    });
    return svg;
  };

  function sync() {
    const labels = { all: t("tabAll"), ai: t("tabAI") };
    buttons.forEach((button) => {
      const tab = button.dataset.tab;
      button.textContent = "";
      if (tab === "ai") {
        button.appendChild(robotIcon());
        // icon-only pill: the name lives in the tooltip and the accessible label
        button.classList.add("tab-icon-only");
        button.title = t("tabAI");
        button.setAttribute("aria-label", t("tabAI"));
      } else {
        button.appendChild(document.createTextNode(labels[tab]));
        button.classList.remove("tab-icon-only");
        button.title = "";
        button.setAttribute("aria-label", labels[tab]);
      }
      button.setAttribute("aria-selected", String(tab === active));
      button.tabIndex = tab === active ? 0 : -1;
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
