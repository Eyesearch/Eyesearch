/**
 * menu/theme-selector — System / Light / Dark.
 *
 * The choice lives in localStorage; "system" follows the OS through a media
 * query listener. The resolved theme is written to <html data-theme> so all CSS
 * variables switch in one place.
 */

import { t, onLangChange } from "../language-selector/lang-switcher.js";

const STORAGE_KEY = "eyesearch:theme";
const MODES = ["system", "light", "dark"];
const listeners = new Set();

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(value) ? value : "system";
  } catch (error) {
    return "system";
  }
}

let mode = readStored();

const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function resolvedTheme() {
  if (mode === "system") return media && media.matches ? "dark" : "light";
  return mode;
}

export function getTheme() {
  return mode;
}

function apply() {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = resolvedTheme();
  listeners.forEach((handler) => handler({ mode, resolved: resolvedTheme() }));
  document.dispatchEvent(new CustomEvent("eyesearch:theme", { detail: { mode, resolved: resolvedTheme() } }));
}

export function setTheme(next) {
  mode = MODES.includes(next) ? next : "system";
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    /* private mode */
  }
  apply();
  return mode;
}

export function onThemeChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

if (media) {
  const onSystemChange = () => {
    if (mode === "system") apply();
  };
  if (typeof media.addEventListener === "function") media.addEventListener("change", onSystemChange);
  else if (typeof media.addListener === "function") media.addListener(onSystemChange);
}

/**
 * @param {HTMLElement} container
 */
export function mountThemeToggle(container) {
  if (!container) throw new Error("mountThemeToggle: container is required");

  const wrap = document.createElement("div");
  wrap.className = "segmented theme-toggle";
  wrap.setAttribute("role", "group");

  const buttons = MODES.map((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment";
    button.dataset.themeMode = entry;
    button.addEventListener("click", () => {
      setTheme(entry);
      sync();
    });
    wrap.appendChild(button);
    return button;
  });

  container.appendChild(wrap);

  function sync() {
    const labels = { system: t("themeSystem"), light: t("themeLight"), dark: t("themeDark") };
    wrap.setAttribute("aria-label", t("theme"));
    buttons.forEach((button) => {
      const entry = button.dataset.themeMode;
      button.textContent = labels[entry];
      button.setAttribute("aria-pressed", String(entry === mode));
    });
  }

  apply();
  sync();
  onLangChange(sync);

  return { element: wrap };
}
