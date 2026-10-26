/**
 * menu/language-selector — English copy.
 *
 * The UI is English-only, so this module is now just the string table every
 * other module reads through `t(key)`. The folder and file name are kept so the
 * module layout stays stable; there is no switcher UI and nothing to persist.
 *
 * `onLangChange` and `getLang` remain as inert shims because modules subscribe
 * at mount time; they never fire and always report "en".
 */

export function t(key) {
  return Object.prototype.hasOwnProperty.call(STRINGS, key) ? STRINGS[key] : key;
}

export function getLang() {
  return "en";
}

/** @returns {() => void} unsubscribe (a no-op: the language never changes) */
export function onLangChange() {
  return () => {};
}

const STRINGS = {
  tagline: "One query. The whole web. Clean results for people and agents.",
  footer: "eyesearch gateway · results are fetched live from the open web.",
  searchLabel: "Search",
  searchPlaceholder: "Search the web…",
  searchHint: "Press Enter or the search button to run a search. / focuses the field, Esc clears it.",
  clear: "Clear search",
  mic: "Voice search",
  micListening: "Listening…",
  micUnsupported: "Voice search needs Chrome or Edge.",
  micDenied: "Microphone permission was denied.",
  micFailed: "Voice search did not work.",
  lens: "Search by image",
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
};
