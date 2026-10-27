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

  // A three-star sparkle: one prominent four-point star with two smaller
  // companions, in the amber accent. The pill is icon-only; the tooltip and
  // aria-label carry "AI Mode".
  const sparkleIcon = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("tab-icon", "tab-icon-sparkle");

    const star = (cx, cy, outer, inner, points = 4) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const step = Math.PI / points;
      const coords = [];
      for (let i = 0; i < points * 2; i += 1) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + i * step;
        coords.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
      }
      path.setAttribute("d", `M${coords.join("L")}Z`);
      path.setAttribute("fill", "currentColor");
      svg.appendChild(path);
      return path;
    };

    star(9.5, 10, 6.2, 1.9);   // the prominent star
    star(17.6, 6.4, 2.6, 0.8); // companion, upper right
    star(17.2, 16.4, 2.1, 0.7); // companion, lower right
    return svg;
  };

  function sync() {
    const labels = { all: t("tabAll"), ai: t("tabAI") };
    buttons.forEach((button) => {
      const tab = button.dataset.tab;
      button.textContent = "";
      if (tab === "ai") {
        button.appendChild(sparkleIcon());
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
