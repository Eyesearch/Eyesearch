/*
 * Runtime configuration. Edit this file to point the UI at a different gateway;
 * no build step, no environment variables needed.
 *
 * apiBase   Absolute origin of the EyeSearch backend. Leave it as "" to call the
 *           same origin that serves this page (useful behind a proxy or when the
 *           UI is served by the API itself).
 * limit     Results requested per search (1-50; the server caps it).
 * debounce  Milliseconds to wait after the last keystroke before searching.
 * minChars  Shortest query that triggers search-as-you-type.
 */
window.EYESEARCH_CONFIG = {
  apiBase: "https://eyesearch-backend.onrender.com",
  limit: 10,
  debounce: 320,
  minChars: 2,
};
