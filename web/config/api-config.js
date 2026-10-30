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
 * The API's own HTTPS origin. The frontend is served from GitHub Pages, which
 * cannot proxy /v1/* to the VM, so the app calls the domain directly — and it
 * has to be https://, because an HTTP request from an HTTPS page is blocked as
 * mixed content.
 *
 * Set window.EYESEARCH_API_BASE before this module loads to point a build at a
 * different gateway (a staging API, or a local stub).
 */
const DEFAULT_BASE = "https://eyesearch.duckdns.org";
const LOCAL_DEV_BASE = "http://127.0.0.1:8000";

/**
 * The VM's address, for pages that are themselves served over plain HTTP.
 *
 * It is NOT a fallback for the HTTPS site. A browser blocks an http:// request
 * from an https:// page as mixed content — Chrome refuses it outright, before
 * the request leaves the machine — so pointing this at the IP from
 * eyesearch.github.io would break search rather than fix it. The same VM is
 * already reachable over TLS at DEFAULT_BASE above, which is why that stays the
 * default.
 *
 * It is used only when the page is served over http:// from somewhere that is
 * not localhost: opening the app directly from the VM, or on a machine on the
 * same network.
 */
const PLAIN_HTTP_BASE = "http://35.255.20.40:8000";

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

  // A page served over http:// can reach an http:// API; one served over
  // https:// cannot. The protocol of the page decides, not a preference.
  const protocol = typeof location !== "undefined" ? location.protocol : "";
  if (protocol === "http:") return PLAIN_HTTP_BASE;

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
  requestTimeoutMs: 6000,
  //: One silent retry after this pause, then the error card.
  retryBackoffMs: 1000,
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
  timeout: "Search is taking longer than usual. Please retry.",
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

/**
 * One attempt. A search that fails on the gateway is retried once by `request`
 * below, so the retry lives there and this stays a single round trip.
 */
async function attemptRequest(url, options = {}) {
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
 * GET with a single silent retry.
 *
 * A gateway that is briefly saturated — the crawler holding connections, a
 * cold worker, a dropped keep-alive — usually answers on the second try. One
 * retry after a second turns that into a slightly slower search instead of an
 * error card. It never retries when the caller aborted, because that means the
 * user has moved on and the answer is no longer wanted.
 */
async function request(url, options = {}) {
  const callerAborted = () => Boolean(options.signal && options.signal.aborted);
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await attemptRequest(url, options);
    } catch (error) {
      lastError = error;
      const timedOut = Boolean(
        error && (error.name === "AbortError" || error.name === "TimeoutError"),
      );
      const retryable = error instanceof ApiError ? error.retryable : true;
      if (attempt === 1 || callerAborted() || (!timedOut && !retryable)) break;
      await new Promise((resolve) => setTimeout(resolve, API_CONFIG.retryBackoffMs));
    }
  }
  throw lastError;
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
