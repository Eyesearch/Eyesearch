/**
 * menu/language-selector — Kannada / English.
 *
 * Owns the string table and the `lang` attribute. Modules call `t(key)` and
 * subscribe with `onLangChange`; nothing else hard-codes UI copy. The choice is
 * persisted in localStorage and mirrored onto <html lang> so screen readers and
 * the font stack follow it.
 */

const STORAGE_KEY = "eyesearch:lang";
const LANGS = [
  { code: "en", label: "English" },
  { code: "kn", label: "ಕನ್ನಡ" },
];

const STRINGS = {
  en: {
    tagline: "One query. The whole web. Clean results for people and agents.",
    footer: "EyeSearch gateway · results are fetched live from the open web.",
    searchLabel: "Search",
    searchPlaceholder: "Search the web…",
    searchHint: "Results appear as you type. Press / to focus, Esc to clear.",
    clear: "Clear search",
    mic: "Voice",
    micListening: "Listening…",
    micUnsupported: "Voice search needs Chrome or Edge.",
    micDenied: "Microphone permission was denied.",
    micFailed: "Voice search did not work.",
    lens: "Camera",
    lensNotImage: "That file is not an image.",
    lensNotice:
      "“{name}” is ready, but visual search is not available on the gateway yet — image queries need a vision endpoint the backend does not have. Type a description instead.",
    quickLinks: "Quick links",
    weather: "Weather",
    weatherLoading: "Loading weather…",
    weatherUnavailable: "Weather is unavailable right now.",
    news: "Live headlines",
    newsUnavailable: "Headlines are unavailable right now.",
    seeMore: "See more headlines",
    accountTitle: "Account",
    accountBody: "Sign-in is not wired up yet. Everything here works without an account.",
    signIn: "Sign in (coming soon)",
    historyTitle: "Recent searches",
    historyEmpty: "No searches yet on this device.",
    clearHistory: "Clear history",
    historyCleared: "Search history cleared.",
    remove: "Remove",
    tabAll: "All",
    tabAI: "AI",
    tabAIHint: "Compact context for AI clients",
    resultsFor: "Results for",
    foundIn: "found in",
    result: "result",
    results: "results",
    cached: "Cached",
    partial: "Partial results",
    providers: "Sources",
    noResultsTitle: "No results",
    noResultsBody: "Try different words, a shorter query, or check the spelling.",
    degradedNotice: "Some providers did not respond, so these results may be incomplete.",
    errorTitle: "Search failed",
    errorBody: "The search could not be completed.",
    retry: "Try again",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
  },
  kn: {
    tagline: "ಒಂದೇ ಹುಡುಕಾಟ. ಇಡೀ ಜಾಲ. ಮನುಷ್ಯರು ಮತ್ತು AI ಗಾಗಿ ಸ್ವಚ್ಛ ಫಲಿತಾಂಶ.",
    footer: "EyeSearch ಗೇಟ್‌ವೇ · ಫಲಿತಾಂಶಗಳು ನೇರ ಜಾಲದಿಂದ ಬರುತ್ತವೆ.",
    searchLabel: "ಹುಡುಕಿ",
    searchPlaceholder: "ಜಾಲದಲ್ಲಿ ಹುಡುಕಿ…",
    searchHint: "ಟೈಪ್ ಮಾಡಿದಂತೆ ಫಲಿತಾಂಶ ಬರುತ್ತದೆ. / ಒತ್ತಿ, Esc ಒತ್ತಿ ಅಳಿಸಿ.",
    clear: "ಹುಡುಕಾಟ ಅಳಿಸಿ",
    mic: "ಧ್ವನಿ",
    micListening: "ಕೇಳುತ್ತಿದೆ…",
    micUnsupported: "ಧ್ವನಿ ಹುಡುಕಾಟಕ್ಕೆ Chrome ಅಥವಾ Edge ಬೇಕು.",
    micDenied: "ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ.",
    micFailed: "ಧ್ವನಿ ಹುಡುಕಾಟ ಕೆಲಸ ಮಾಡಲಿಲ್ಲ.",
    lens: "ಕ್ಯಾಮೆರಾ",
    lensNotImage: "ಇದು ಚಿತ್ರ ಫೈಲ್ ಅಲ್ಲ.",
    lensNotice:
      "“{name}” ಸಿದ್ಧವಾಗಿದೆ, ಆದರೆ ಚಿತ್ರದ ಮೂಲಕ ಹುಡುಕಾಟ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ — ಬ್ಯಾಕೆಂಡ್‌ನಲ್ಲಿ ವಿಷನ್ ಎಂಡ್‌ಪಾಯಿಂಟ್ ಇಲ್ಲ. ಬದಲಾಗಿ ವಿವರಣೆ ಟೈಪ್ ಮಾಡಿ.",
    quickLinks: "ತ್ವರಿತ ಲಿಂಕ್‌ಗಳು",
    weather: "ಹವಾಮಾನ",
    weatherLoading: "ಹವಾಮಾನ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
    weatherUnavailable: "ಹವಾಮಾನ ಈಗ ಲಭ್ಯವಿಲ್ಲ.",
    news: "ತಾಜಾ ಸುದ್ದಿ",
    newsUnavailable: "ಸುದ್ದಿ ಈಗ ಲಭ್ಯವಿಲ್ಲ.",
    seeMore: "ಇನ್ನಷ್ಟು ಸುದ್ದಿ",
    accountTitle: "ಖಾತೆ",
    accountBody: "ಸೈನ್-ಇನ್ ಇನ್ನೂ ಸಿದ್ಧವಿಲ್ಲ. ಖಾತೆ ಇಲ್ಲದೆಯೂ ಎಲ್ಲವೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.",
    signIn: "ಸೈನ್ ಇನ್ (ಶೀಘ್ರದಲ್ಲಿ)",
    historyTitle: "ಇತ್ತೀಚಿನ ಹುಡುಕಾಟಗಳು",
    historyEmpty: "ಈ ಸಾಧನದಲ್ಲಿ ಇನ್ನೂ ಹುಡುಕಾಟಗಳಿಲ್ಲ.",
    clearHistory: "ಇತಿಹಾಸ ಅಳಿಸಿ",
    historyCleared: "ಹುಡುಕಾಟ ಇತಿಹಾಸ ಅಳಿಸಲಾಗಿದೆ.",
    remove: "ತೆಗೆದುಹಾಕಿ",
    tabAll: "ಎಲ್ಲಾ",
    tabAI: "AI",
    tabAIHint: "AI ಕ್ಲೈಂಟ್‌ಗಳಿಗೆ ಸಂಕ್ಷಿಪ್ತ ಸಂದರ್ಭ",
    resultsFor: "ಫಲಿತಾಂಶಗಳು",
    foundIn: "ಸಮಯ",
    result: "ಫಲಿತಾಂಶ",
    results: "ಫಲಿತಾಂಶಗಳು",
    cached: "ಸಂಗ್ರಹಿತ",
    partial: "ಭಾಗಶಃ ಫಲಿತಾಂಶ",
    providers: "ಮೂಲಗಳು",
    noResultsTitle: "ಫಲಿತಾಂಶಗಳಿಲ್ಲ",
    noResultsBody: "ಬೇರೆ ಪದಗಳನ್ನು ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಕಡಿಮೆ ಪದಗಳಲ್ಲಿ ಹುಡುಕಿ.",
    degradedNotice: "ಕೆಲವು ಮೂಲಗಳು ಪ್ರತಿಕ್ರಿಯಿಸಲಿಲ್ಲ, ಹಾಗಾಗಿ ಫಲಿತಾಂಶಗಳು ಅಪೂರ್ಣವಾಗಿರಬಹುದು.",
    errorTitle: "ಹುಡುಕಾಟ ವಿಫಲವಾಯಿತು",
    errorBody: "ಹುಡುಕಾಟ ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ.",
    retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
    theme: "ಥೀಮ್",
    themeSystem: "ಸಿಸ್ಟಂ",
    themeLight: "ಲೈಟ್",
    themeDark: "ಡಾರ್ಕ್",
    language: "ಭಾಷೆ",
  },
};

const listeners = new Set();

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "kn" || value === "en" ? value : null;
  } catch (error) {
    return null;
  }
}

function persist(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (error) {
    /* private mode: the choice simply does not persist */
  }
}

let current = readStored() || (typeof navigator !== "undefined" && /^kn/i.test(navigator.language || "") ? "kn" : "en");

export function getLang() {
  return current;
}

export function t(key) {
  const table = STRINGS[current] || STRINGS.en;
  if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  return STRINGS.en[key] || key;
}

export function onLangChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function setLang(lang) {
  const next = lang === "kn" ? "kn" : "en";
  if (next === current) return current;
  current = next;
  persist(next);
  document.documentElement.lang = next;
  listeners.forEach((handler) => {
    try {
      handler(next);
    } catch (error) {
      console.error("lang listener failed", error);
    }
  });
  document.dispatchEvent(new CustomEvent("eyesearch:lang", { detail: { lang: next } }));
  return current;
}

export { LANGS, STRINGS };

/**
 * @param {HTMLElement} container
 * @param {{onChange?: (lang: string) => void}} options
 */
export function mountLangSwitcher(container, options = {}) {
  if (!container) throw new Error("mountLangSwitcher: container is required");

  const wrap = document.createElement("div");
  wrap.className = "segmented lang-switcher";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", STRINGS.en.language);

  const buttons = LANGS.map((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment";
    button.dataset.lang = entry.code;
    button.textContent = entry.label;
    button.setAttribute("aria-pressed", String(entry.code === current));
    if (entry.code === "kn") button.setAttribute("lang", "kn");
    button.addEventListener("click", () => {
      const next = setLang(entry.code);
      sync();
      if (typeof options.onChange === "function") options.onChange(next);
    });
    wrap.appendChild(button);
    return button;
  });

  container.appendChild(wrap);

  function sync() {
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === current));
    });
  }

  document.documentElement.lang = current;
  sync();

  return { element: wrap, setLang: (lang) => { setLang(lang); sync(); } };
}
