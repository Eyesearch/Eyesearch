/**
 * Single source of truth for everything that talks to the EyeSearch gateway.
 *
 * The gateway (github.com/Eyesearch/Eyesearch-Backend) exposes two contracts:
 *   GET  /v1/search?q=&limit=&page=   structured cards for this UI
 *   POST /v1/retrieve {query, format} token-optimised context for AI clients
 *
 * Nothing else in the app knows the backend URL, the limits or the error codes.
 */

/**
 * Same origin by default. The static host proxies /v1/* and /health to the VM
 * (see netlify.toml and vercel.json), so the browser only ever talks HTTPS to
 * the host it loaded the page from and the plain-HTTP hop to the VM happens
 * server-side. Pointing this at http://<vm-ip>:8000 directly would be blocked
 * as mixed content on any HTTPS page.
 *
 * Set window.EYESEARCH_API_BASE before this module loads to override it — that
 * is what a GitHub Pages deployment needs, because Pages cannot proxy.
 */
const DEFAULT_BASE = "";
const LOCAL_DEV_BASE = "http://127.0.0.1:8000";

/**
 * Resolution order: an explicit runtime override, then the configured default.
 * The override is authoritative even when it is the empty string, which means
 * "same origin as this page" — that is how local development and the automated
 * UI test point the app at a stub without touching this file.
 */
function resolveBaseUrl() {
  const hasOverride =
    typeof window !== "undefined" && typeof window.EYESEARCH_API_BASE === "string";
  if (hasOverride) return String(window.EYESEARCH_API_BASE).replace(/\/+$/, "");

  // Served from a file or a dev server: the API is on this machine.
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (host === "localhost" || host === "127.0.0.1") return LOCAL_DEV_BASE;

  return DEFAULT_BASE.replace(/\/+$/, "");
}

export const API_CONFIG = Object.freeze({
  baseUrl: resolveBaseUrl(),
  searchPath: "/v1/search",
  retrievePath: "/v1/retrieve",
  suggestPath: "/v1/suggest",
  // Autocomplete is cheap but not free: a short debounce and a floor of two
  // characters keep the address bar quiet while typing.
  suggestDebounceMs: 250,
  suggestMinChars: 2,
  suggestLimit: 6,
  defaultLimit: 10,
  maxLimit: 50,
  requestTimeoutMs: 14000,
});

export class ApiError extends Error {
  /**
   * @param {string} message human readable message
   * @param {{code?: string, status?: number, retryable?: boolean}} meta
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = "ApiError";
    this.code = meta.code || "internal";
    this.status = meta.status || 0;
    this.retryable = meta.retryable !== false;
  }
}

const ERROR_TEXT = {
  bad_request: "That query could not be understood.",
  not_found: "Nothing was found for that query.",
  rate_limited: "Too many searches right now.",
  provider_unavailable: "The search providers are not responding.",
  database_error: "The search index is unavailable.",
  internal: "Something went wrong on the gateway.",
};

export function errorTextFor(code) {
  return ERROR_TEXT[code] || "The search could not be completed.";
}

export function buildSearchUrl(query, limit = API_CONFIG.defaultLimit) {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(Math.max(1, limit), API_CONFIG.maxLimit)),
  });
  return `${API_CONFIG.baseUrl}${API_CONFIG.searchPath}?${params.toString()}`;
}

export function buildSuggestUrl(query, limit = API_CONFIG.suggestLimit) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return `${API_CONFIG.baseUrl}${API_CONFIG.suggestPath}?${params.toString()}`;
}

export function buildRetrieveUrl() {
  return `${API_CONFIG.baseUrl}${API_CONFIG.retrievePath}`;
}

/** Combine a caller signal with an internal timeout signal. */
function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  const cleanup = () => clearTimeout(timer);

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return { signal: controller.signal, cleanup };
}

async function request(url, options = {}) {
  const { signal, cleanup } = withTimeout(options.signal, API_CONFIG.requestTimeoutMs);
  let response;
  try {
    response = await fetch(url, { ...options, signal, headers: { Accept: "application/json", ...(options.headers || {}) } });
  } catch (error) {
    cleanup();
    if (error && (error.name === "AbortError" || error.name === "TimeoutError")) throw error;
    throw new ApiError("Can't reach the search gateway.", { code: "provider_unavailable", retryable: true });
  }
  cleanup();

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body && body.error ? body.error : {};
    throw new ApiError(detail.message || `HTTP ${response.status} from the gateway.`, {
      code: detail.code || "internal",
      status: response.status,
      retryable: detail.retryable !== false,
    });
  }
  if (body && body.error) {
    throw new ApiError(body.error.message || errorTextFor(body.error.code), {
      code: body.error.code,
      status: response.status,
      retryable: body.error.retryable !== false,
    });
  }
  return body;
}

/**
 * Autocomplete completions for the search bar.
 *
 * The gateway answers in the OpenSearch suggestions shape — `[query, [items]]` —
 * so this parses that and tolerates anything else by returning no suggestions.
 *
 * @param {string} query
 * @param {{limit?: number, signal?: AbortSignal}} options
 * @returns {Promise<string[]>}
 */
export async function fetchSuggestions(query, options = {}) {
  const trimmed = String(query || "").trim();
  if (trimmed.length < API_CONFIG.suggestMinChars) return [];

  const { signal, cleanup } = withTimeout(options.signal, API_CONFIG.requestTimeoutMs);
  let response;
  try {
    response = await fetch(buildSuggestUrl(trimmed, options.limit), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    cleanup();
    return []; // suggestions are a convenience: never surface an error for them
  }
  cleanup();

  if (!response.ok) return [];
  const payload = await response.json().catch(() => null);
  const items = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
  return items
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, options.limit || API_CONFIG.suggestLimit);
}

/**
 * Structured results for the UI.
 * @param {string} query
 * @param {{limit?: number, signal?: AbortSignal}} options
 * @returns {Promise<{query: string, results: Array<object>, took_ms?: number, degraded?: boolean,
 *   cache_hit?: boolean, providers?: Record<string, number>, failed_providers?: string[],
 *   total_estimate?: number}>}
 */
export async function searchWeb(query, options = {}) {
  const payload = await request(buildSearchUrl(query, options.limit), { method: "GET", signal: options.signal });
  return {
    query: typeof payload.query === "string" ? payload.query : query,
    results: Array.isArray(payload.results) ? payload.results : [],
    took_ms: typeof payload.took_ms === "number" ? payload.took_ms : undefined,
    degraded: payload.degraded === true,
    cache_hit: payload.cache_hit === true,
    providers: payload.providers && typeof payload.providers === "object" ? payload.providers : {},
    failed_providers: Array.isArray(payload.failed_providers) ? payload.failed_providers : [],
    total_estimate: typeof payload.total_estimate === "number" ? payload.total_estimate : undefined,
  };
}

/**
 * Token-optimised context for the AI tab: the same results without the
 * presentation fields, which is exactly what an LLM client needs.
 * @param {string} query
 * @param {{limit?: number, signal?: AbortSignal}} options
 */
export async function retrieveContext(query, options = {}) {
  const limit = Math.min(Math.max(1, options.limit || API_CONFIG.defaultLimit), API_CONFIG.maxLimit);
  const payload = await request(buildRetrieveUrl(), {
    method: "POST",
    signal: options.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, format: "json", limit }),
  });
  return {
    query: typeof payload.query === "string" ? payload.query : query,
    results: Array.isArray(payload.results) ? payload.results : [],
    degraded: payload.degraded === true,
    providers: payload.providers && typeof payload.providers === "object" ? payload.providers : {},
    failed_providers: Array.isArray(payload.failed_providers) ? payload.failed_providers : [],
  };
}
