/**
 * menu/theme-selector — one button, two states.
 *
 * Starts on the system theme (`prefers-color-scheme`), and a single click
 * flips to the opposite of what is currently rendered, persisting that explicit
 * choice in localStorage. The icon shows what a click will give you: 🌙 to go
 * dark, ☀️ to go light.
 */

const STORAGE_KEY = "eyesearch:theme";
const MOON = "\u{1F319}";
const SUN = "\u2600\uFE0F";

const media =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch (error) {
    return null;
  }
}

/** "system" until the user makes an explicit choice. */
let mode = readStored() || "system";
const listeners = new Set();

export function resolvedTheme() {
  if (mode === "system") return media && media.matches ? "dark" : "light";
  return mode;
}

export function getTheme() {
  return mode;
}

function apply() {
  const resolved = resolvedTheme();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  listeners.forEach((handler) => handler({ mode, resolved }));
  document.dispatchEvent(new CustomEvent("eyesearch:theme", { detail: { mode, resolved } }));
}

export function setTheme(next) {
  mode = next === "light" || next === "dark" ? next : "system";
  try {
    if (mode === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    /* private mode: the choice simply does not persist */
  }
  apply();
  return mode;
}

export function toggleTheme() {
  return setTheme(resolvedTheme() === "dark" ? "light" : "dark");
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

  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button theme-toggle";
  button.dataset.action = "toggle-theme";

  const sync = () => {
    const resolved = resolvedTheme();
    const next = resolved === "dark" ? "light" : "dark";
    button.textContent = next === "dark" ? MOON : SUN;
    button.setAttribute("aria-label", next === "dark" ? "Switch to dark theme" : "Switch to light theme");
    button.setAttribute("title", next === "dark" ? "Dark theme" : "Light theme");
    button.setAttribute("aria-pressed", String(resolved === "dark"));
    button.dataset.resolved = resolved;
  };

  button.addEventListener("click", () => {
    toggleTheme();
    sync();
  });

  apply();
  sync();
  onThemeChange(sync);
  container.appendChild(button);

  return { element: button, getTheme, setTheme, toggle: toggleTheme };
}
