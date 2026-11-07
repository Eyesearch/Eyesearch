/**
 * results/client-federation — auxiliary results fetched by the reader's own
 * browser.
 *
 * Why the browser and not the gateway: the gateway answers from a single
 * datacenter address, and the public knowledge providers rate-limit and time
 * out that address. The reader's connection is not on that address, so the
 * auxiliary call is dispatched from here — in parallel with the gateway
 * request, never before or after it — and the two answers are merged in the UI.
 *
 * The contract, and it is not negotiable:
 *   - The gateway request is never delayed, blocked or failed by this module.
 *     It runs on its own; this one is a second, independent promise.
 *   - The auxiliary request has a hard client-side timeout of 2200ms
 *     (AUX_TIMEOUT_MS), clamped into the 2000-2500ms band whatever is asked for.
 *   - Every failure — network, CORS, non-2xx, malformed JSON, timeout, an
 *     aborted search — is swallowed. `fetchAuxiliaryResults` resolves with []
 *     and never rejects, so there is nothing for the caller to catch.
 *   - Nothing third-party is drawn. Results are normalised into the same
 *     `{ title, url, snippet, badge }` shape the gateway's cards use and
 *     rendered by the same card renderer, in the app's own design language.
 *
 * What goes over the wire: the query, and nothing else. Requests are sent with
 * `credentials: "omit"` and `referrerPolicy: "no-referrer"`, so the providers
 * learn neither the reader's identity nor which page asked.
 */

/** The auxiliary deadline. Inside the 2000-2500ms band the product requires. */
export const AUX_TIMEOUT_MS = 2200;

/** The band. A caller may tune the deadline, but not out of it. */
const TIMEOUT_FLOOR_MS = 2000;
const TIMEOUT_CEILING_MS = 2500;

/** How many Wikipedia pages a search may contribute. */
const WIKIPEDIA_LIMIT = 3;

/** How many of those get a second call for a summary. Two is enough to fill
 *  the cards and keeps the second hop inside the deadline. */
const SUMMARY_LIMIT = 2;

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const DUCKDUCKGO_API = "https://api.duckduckgo.com/";

/* ------------------------------- primitives ------------------------------- */

/**
 * Clamp a requested deadline into the band. A number outside it, or no number
 * at all, becomes AUX_TIMEOUT_MS.
 * @param {number|undefined} value
 * @returns {number}
 */
export function clampTimeout(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return AUX_TIMEOUT_MS;
  return Math.min(TIMEOUT_CEILING_MS, Math.max(TIMEOUT_FLOOR_MS, Math.round(ms)));
}

const ENTITIES = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
});

/**
 * Provider text is text, not markup. The Wikimedia search endpoint marks the
 * matched words with `<span class="searchmatch">`, and some summaries carry
 * inline tags — shown as literal angle brackets they would read as corruption.
 * Tags are dropped and the handful of entities that survive are decoded. The
 * result is a plain string that only ever reaches the DOM through textContent.
 * @param {unknown} value
 * @returns {string}
 */
export function stripMarkup(value) {
  return String(value == null ? "" : value)
    .replace(/<[^>]*>/g, "")
    .replace(/&(#39|amp|lt|gt|quot|nbsp);/g, (match, name) => ENTITIES[name] || match)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * An absolute http(s) URL, or "". A card links out to whatever the provider
 * sent, so `javascript:` and `data:` are dropped here rather than trusted and
 * neutralised later.
 * @param {unknown} value
 * @returns {string}
 */
export function httpUrl(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "https://en.wikipedia.org");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch (error) {
    return "";
  }
}

/**
 * The comparison key for a URL: scheme-less, case-insensitive host, no
 * trailing slash. Two providers naming the same page differently must collapse
 * to one card.
 * @param {unknown} value
 * @returns {string}
 */
export function urlKey(value) {
  const url = httpUrl(value);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path}${parsed.search}`.toLowerCase();
  } catch (error) {
    return "";
  }
}

/* ------------------------------- normalising ------------------------------ */

/**
 * One provider item, in the shape the card renderer already understands.
 *
 * `federated: true` is what marks the text as someone else's: the renderer
 * shows an attribution line and a link to the original for those cards, and it
 * keeps them out of anything that pretends to be a crawled result.
 *
 * @param {object} item
 * @returns {object|null}
 */
export function normalizeAuxResult(item) {
  if (!item || typeof item !== "object") return null;

  const url = httpUrl(item.url);
  const title = stripMarkup(item.title);
  // External text without a named source is not shown at all: the terms of the
  // endpoints we call require attribution, and a card that hides where its
  // words came from is worse than no card.
  const source = stripMarkup(item.source).toLowerCase();
  if (!url || !title || !source) return null;

  const badge = stripMarkup(item.badge);
  const snippet = stripMarkup(item.snippet);

  return {
    title,
    url,
    snippet,
    badge: badge || source,
    source,
    source_url: url,
    category: "WEB",
    federated: true,
  };
}

/**
 * Drop duplicates, both inside the auxiliary set and against what the gateway
 * already returned. A Wikipedia page that the index also matched must appear
 * once, as the indexed card.
 *
 * @param {object[]} items
 * @param {string[]} [existingUrls]
 * @returns {object[]}
 */
export function dedupeAuxResults(items, existingUrls = []) {
  const seen = new Set();
  (Array.isArray(existingUrls) ? existingUrls : []).forEach((url) => {
    const key = urlKey(url);
    if (key) seen.add(key);
  });

  const out = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = urlKey(item && item.url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

/* -------------------------------- providers ------------------------------- */

/** The last path segment of a Wikipedia article URL, as a page title. */
function pageTitleOf(url) {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(last).replace(/_/g, " ");
  } catch (error) {
    return "";
  }
}

/**
 * Wikipedia: the OpenSearch endpoint for the three closest pages, then the
 * summary endpoint for the ones OpenSearch left without a description.
 *
 * OpenSearch is cheap and returns titles and URLs in one call, but its
 * descriptions array is empty for most pages — a card built from it alone would
 * be a bare title. The summary call is what turns those into something worth
 * showing, and it is only made for the top two.
 */
async function wikipediaProvider(query, ctx) {
  const searchUrl =
    `${WIKIPEDIA_API}?action=opensearch` +
    `&search=${encodeURIComponent(query)}` +
    `&limit=${WIKIPEDIA_LIMIT}` +
    `&namespace=0` +
    `&format=json&origin=*`;

  const payload = await ctx.json(searchUrl);
  if (!Array.isArray(payload)) return [];

  const titles = Array.isArray(payload[1]) ? payload[1] : [];
  const descriptions = Array.isArray(payload[2]) ? payload[2] : [];
  const urls = Array.isArray(payload[3]) ? payload[3] : [];

  const items = [];
  titles.slice(0, WIKIPEDIA_LIMIT).forEach((title, index) => {
    const url = httpUrl(urls[index]);
    const clean = stripMarkup(title);
    if (!url || !clean) return;
    items.push({
      title: clean,
      url,
      snippet: stripMarkup(descriptions[index]),
      badge: "Wikipedia",
      source: "wikipedia",
      page: pageTitleOf(url) || clean,
    });
  });

  const thin = items.filter((item) => !item.snippet).slice(0, SUMMARY_LIMIT);
  await Promise.all(
    thin.map(async (item) => {
      const summary = await ctx.json(
        `${WIKIPEDIA_SUMMARY}${encodeURIComponent(item.page)}?redirect=true`,
      );
      if (!summary || typeof summary !== "object") return;
      item.snippet = stripMarkup(summary.extract) || stripMarkup(summary.description);
    }),
  );

  return items;
}

/**
 * DuckDuckGo Instant Answer: the keyless, CORS-enabled public snippet endpoint.
 * It answers entity questions rather than searching the web, so it either has a
 * page to point at or it contributes nothing — which is the honest outcome, not
 * a card assembled out of whatever fields happened to be filled in.
 */
async function duckduckgoProvider(query, ctx) {
  const url =
    `${DUCKDUCKGO_API}?q=${encodeURIComponent(query)}` +
    `&format=json&no_html=1&skip_disambig=1&t=eyesearch`;

  const payload = await ctx.json(url);
  if (!payload || typeof payload !== "object") return [];

  const target = httpUrl(payload.AbstractURL);
  const title = stripMarkup(payload.Heading);
  if (!target || !title) return [];

  return [
    {
      title,
      url: target,
      snippet: stripMarkup(payload.AbstractText) || stripMarkup(payload.Abstract),
      badge: "DuckDuckGo",
      source: "duckduckgo",
    },
  ];
}

/** Asked together, in parallel, each answering only for itself. */
const PROVIDERS = [wikipediaProvider, duckduckgoProvider];

/* ------------------------------- dispatching ------------------------------ */

/**
 * Build the deadline-aware fetch context shared by every provider call of one
 * search: one AbortController, one timer, one caller signal.
 */
function contextFor(fetchImpl, signal, deadline, timeoutMs) {
  const timer = setTimeout(() => deadline.abort(), timeoutMs);
  const forwardAbort = () => deadline.abort();
  if (signal && typeof signal.addEventListener === "function") {
    if (signal.aborted) deadline.abort();
    else signal.addEventListener("abort", forwardAbort);
  }

  const ctx = {
    /** GET a JSON document, or throw. The caller swallows the throw. */
    async json(url) {
      const response = await fetchImpl(url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: deadline.signal,
      });
      if (!response || !response.ok) {
        throw new Error(`auxiliary request failed: ${response ? response.status : "no response"}`);
      }
      return response.json();
    },
    dispose() {
      clearTimeout(timer);
      if (signal && typeof signal.removeEventListener === "function") {
        signal.removeEventListener("abort", forwardAbort);
      }
    },
  };
  return ctx;
}

/**
 * Ask every auxiliary provider about `query`, from this browser.
 *
 * Resolves with the normalised, de-duplicated cards — or with [] for any
 * reason at all. It never rejects and never throws synchronously, so the
 * caller may fire it and forget it.
 *
 * @param {string} query
 * @param {{signal?: AbortSignal, timeoutMs?: number, fetchImpl?: Function,
 *          providers?: Function[], existingUrls?: string[]}} [options]
 * @returns {Promise<object[]>}
 */
export async function fetchAuxiliaryResults(query, options = {}) {
  const cleaned = String(query || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const fetchImpl = options.fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!fetchImpl) return [];
  if (options.signal && options.signal.aborted) return [];

  const providers = Array.isArray(options.providers) && options.providers.length
    ? options.providers
    : PROVIDERS;

  const deadline = new AbortController();
  const ctx = contextFor(fetchImpl, options.signal, deadline, clampTimeout(options.timeoutMs));

  try {
    const settled = await Promise.allSettled(
      providers.map((provider) => provider(cleaned, ctx)),
    );

    const raw = [];
    settled.forEach((outcome) => {
      if (outcome.status === "fulfilled" && Array.isArray(outcome.value)) {
        raw.push(...outcome.value);
      }
    });

    const normalised = raw
      .map((item) => normalizeAuxResult(item))
      .filter((item) => item !== null);

    return dedupeAuxResults(normalised, options.existingUrls);
  } catch (error) {
    // Deliberately silent: a failed auxiliary request must leave no trace in
    // the UI, the console or the reader's way.
    return [];
  } finally {
    ctx.dispose();
  }
}
