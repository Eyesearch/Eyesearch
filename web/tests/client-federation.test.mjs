/**
 * Client-side federation tests.
 *
 * Two halves, because the module has two jobs:
 *
 *   1. Fetching. `aux-fetch.js` is plain ESM with no DOM in it, so it is
 *      imported straight into Node and driven against a stubbed `fetch`. That
 *      is how the deadline, the fail-silent contract and the normalisation are
 *      checked without a network.
 *   2. Drawing. The badge change lives in `web-card.js`, which needs a layout,
 *      so that half renders the real module against the real stylesheets in
 *      headless Chromium — the same way the other card tests do.
 *
 *   node web/tests/client-federation.test.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUX_TIMEOUT_MS,
  clampTimeout,
  stripMarkup,
  httpUrl,
  urlKey,
  normalizeAuxResult,
  dedupeAuxResults,
  fetchAuxiliaryResults,
} from "../results/client-federation/aux-fetch.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

const failures = [];
let checks = 0;

function check(label, actual, expected) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures.push(
      `${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

/* ------------------------------- primitives -------------------------------- */

check("the deadline sits inside the 2000-2500ms band", AUX_TIMEOUT_MS >= 2000 && AUX_TIMEOUT_MS <= 2500, true);
check("no deadline asked for keeps the default", clampTimeout(undefined), AUX_TIMEOUT_MS);
check("a deadline under the floor is raised to it", clampTimeout(200), 2000);
check("a deadline over the ceiling is lowered to it", clampTimeout(9000), 2500);
check("a deadline inside the band is kept", clampTimeout(2300), 2300);

check(
  "provider markup is dropped and entities decoded",
  stripMarkup('<span class="searchmatch">Bengaluru</span>, also known as Bangalore &amp; co'),
  "Bengaluru, also known as Bangalore & co",
);
check("whitespace collapses to one line", stripMarkup("a\n\n  b\t c"), "a b c");
check("a non-string survives as text", stripMarkup(null), "");

check("an https url is kept", httpUrl("https://en.wikipedia.org/wiki/Bengaluru"), "https://en.wikipedia.org/wiki/Bengaluru");
check("a javascript: url is refused", httpUrl("javascript:alert(1)"), "");
check("a data: url is refused", httpUrl("data:text/html,<b>x</b>"), "");
check("an empty url is refused", httpUrl("   "), "");

check(
  "the same page spelled two ways shares one key",
  urlKey("https://www.en.wikipedia.org/wiki/Bengaluru/"),
  urlKey("https://en.wikipedia.org/wiki/Bengaluru"),
);
check("different pages keep different keys", urlKey("https://a.com/x") === urlKey("https://a.com/y"), false);

/* ------------------------------- normalising ------------------------------- */

const NORMALISED = normalizeAuxResult({
  title: "  Bengaluru  ",
  url: "https://en.wikipedia.org/wiki/Bengaluru",
  snippet: "Capital of Karnataka",
  badge: "Wikipedia",
  source: "wikipedia",
});
check("a normalised card has the contract fields", Object.keys(NORMALISED).sort(), [
  "badge",
  "category",
  "federated",
  "snippet",
  "source",
  "source_url",
  "title",
  "url",
]);
check("external text is marked federated", NORMALISED.federated, true);
check("the title is trimmed", NORMALISED.title, "Bengaluru");
check("the badge is carried through", NORMALISED.badge, "Wikipedia");
check("the card gets the shared web category", NORMALISED.category, "WEB");

check(
  "a card with no source is dropped, attribution is not optional",
  normalizeAuxResult({ title: "x", url: "https://a.com/x" }),
  null,
);
check(
  "a card with no usable url is dropped",
  normalizeAuxResult({ title: "x", url: "javascript:1", source: "wikipedia" }),
  null,
);
check("a card with no title is dropped", normalizeAuxResult({ url: "https://a.com/x", source: "wikipedia" }), null);
check(
  "the badge falls back to the source name",
  normalizeAuxResult({ title: "x", url: "https://a.com/x", source: "wikipedia" }).badge,
  "wikipedia",
);

const DEDUPED = dedupeAuxResults(
  [
    { url: "https://en.wikipedia.org/wiki/Bengaluru", source: "wikipedia" },
    { url: "https://en.wikipedia.org/wiki/Bengaluru/", source: "wikipedia" },
    { url: "https://karnataka.gov.in/", source: "wikipedia" },
  ],
  ["https://www.karnataka.gov.in"],
);
check("duplicates collapse and indexed pages win", DEDUPED.length, 1);
check("the surviving card is the first one", DEDUPED[0].url, "https://en.wikipedia.org/wiki/Bengaluru");

/* -------------------------------- fetching --------------------------------- */

const OPENSEARCH = [
  "bengaluru",
  ["Bengaluru", "Bengaluru FC", "Bengaluru Metropolitan Transport Corporation"],
  ["", "", ""],
  [
    "https://en.wikipedia.org/wiki/Bengaluru",
    "https://en.wikipedia.org/wiki/Bengaluru_FC",
    "https://en.wikipedia.org/wiki/Bengaluru_Metropolitan_Transport_Corporation",
  ],
];

const SUMMARY = {
  extract: "<b>Bengaluru</b>, also known as Bangalore, is the capital of Karnataka.",
  description: "Capital of Karnataka, India",
};

const DDG = {
  Heading: "Bengaluru",
  AbstractText: "Bengaluru is the capital of the Indian state of Karnataka.",
  AbstractURL: "https://en.wikipedia.org/wiki/Bangalore",
};

/** A fetch stub that answers each provider from the payloads above. */
function stubFetch({ opensearch = OPENSEARCH, summary = SUMMARY, ddg = DDG, fail = null } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push(url);
    if (fail && fail(url)) throw new Error("network down");
    let body;
    if (url.startsWith("https://en.wikipedia.org/w/api.php")) body = opensearch;
    else if (url.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) body = summary;
    else if (url.startsWith("https://api.duckduckgo.com/")) body = ddg;
    else throw new Error(`unexpected url ${url}`);
    return { ok: true, status: 200, json: async () => body };
  };
  return { impl, calls };
}

const stub = stubFetch();
const results = await fetchAuxiliaryResults("bengaluru", { fetchImpl: stub.impl });

check("three Wikipedia pages and one web snippet come back", results.length, 4);
check(
  "every auxiliary card is federated and attributed",
  results.every((item) => item.federated === true && item.source && item.source_url),
  true,
);
check(
  "the Wikipedia cards name Wikipedia",
  results.filter((item) => item.source === "wikipedia").map((item) => item.badge),
  ["Wikipedia", "Wikipedia", "Wikipedia"],
);
check("the web snippet names its provider as the provider spells it", results[3].badge, "DuckDuckGo");
check(
  "an empty opensearch description is filled from the summary",
  results[0].snippet,
  "Bengaluru, also known as Bangalore, is the capital of Karnataka.",
);
check(
  "the cross-origin opt-in is on every Wikipedia api call",
  stub.calls.filter((url) => url.includes("/w/api.php")).every((url) => url.includes("origin=*")),
  true,
);
check("only the two thin cards cost a summary call", stub.calls.filter((url) => url.includes("/page/summary/")).length, 2);
check("the query is encoded into the request", stub.calls[0].includes("search=bengaluru"), true);

const excluded = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: stubFetch().impl,
  existingUrls: ["https://en.wikipedia.org/wiki/Bengaluru"],
});
check("a page the gateway already returned is not repeated", excluded.length, 3);

/* ------------------------------ fail-silent -------------------------------- */

const noProviders = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: stubFetch().impl,
  providers: [
    async () => {
      throw new Error("provider exploded");
    },
    async () => [{ title: "Kept", url: "https://a.com/k", source: "wikipedia" }],
  ],
});
check("one dead provider does not lose the other's cards", noProviders.length, 1);
check("the surviving card is normalised", noProviders[0].federated, true);

const networkDown = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: stubFetch({ fail: () => true }).impl,
});
check("a network failure resolves to nothing, not a rejection", networkDown, []);

const badStatus = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
});
check("a non-2xx answer resolves to nothing", badStatus, []);

const badJson = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("not json");
    },
  }),
});
check("a malformed body resolves to nothing", badJson, []);

const emptyQuery = await fetchAuxiliaryResults("   ", { fetchImpl: stubFetch().impl });
check("an empty query is not dispatched", emptyQuery, []);

const preAborted = new AbortController();
preAborted.abort();
const abortedSearch = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: stubFetch().impl,
  signal: preAborted.signal,
});
check("a search already aborted dispatches nothing", abortedSearch, []);

// The real deadline: a fetch that never settles but honours the signal, so the
// module's own timer is what ends it. Clamped up to 2000ms, so this is the one
// slow check in the file — and the one that proves the band is real.
const hangingFetch = (url, init) =>
  new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });

const startedAt = Date.now();
const timedOut = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: hangingFetch,
  timeoutMs: 50,
});
const elapsed = Date.now() - startedAt;
check("a hanging request resolves to nothing", timedOut, []);
check("the deadline is at least the 2000ms floor", elapsed >= 1900, true);
check("the deadline is at most the 2500ms ceiling plus a margin", elapsed < 3000, true);

const midFlight = new AbortController();
setTimeout(() => midFlight.abort(), 120);
const interruptedAt = Date.now();
const interrupted = await fetchAuxiliaryResults("bengaluru", {
  fetchImpl: hangingFetch,
  signal: midFlight.signal,
});
check("aborting the search ends the auxiliary request", interrupted, []);
check("aborting the search ends it promptly", Date.now() - interruptedAt < 1500, true);

/* --------------------------------- drawing --------------------------------- */

const CARD_JS = readFileSync(join(root, "web/results/result-cards/web-card.js"), "utf8")
  .replace(/^export /gm, "");
const BASE_CSS = readFileSync(join(root, "web/base.css"), "utf8");
const CARD_CSS = readFileSync(join(root, "web/results/result-cards/card-renderer.css"), "utf8");

const CARDS = [
  {
    title: "Bengaluru",
    url: "https://en.wikipedia.org/wiki/Bengaluru",
    snippet: "Bengaluru is the capital of Karnataka.",
    badge: "Wikipedia",
    source: "wikipedia",
    source_url: "https://en.wikipedia.org/wiki/Bengaluru",
    federated: true,
  },
  {
    title: "Bengaluru",
    url: "https://en.wikipedia.org/wiki/Bangalore",
    snippet: "The capital of the Indian state of Karnataka.",
    badge: "DuckDuckGo",
    source: "duckduckgo",
    source_url: "https://en.wikipedia.org/wiki/Bangalore",
    federated: true,
  },
  {
    title: "An indexed page",
    url: "https://karnataka.gov.in/notices",
    snippet: "A page we crawled ourselves.",
    category: "GOV",
  },
];

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${BASE_CSS}</style><style>${CARD_CSS}</style></head>
<body><div id="out"></div><script>${CARD_JS}
const cards = ${JSON.stringify(CARDS)};
const out = document.getElementById("out");
for (const card of cards) out.appendChild(createWebCard(card, {}));
setTimeout(() => {
  document.title = "PROBE:" + JSON.stringify({
    labels: [...document.querySelectorAll(".card-attribution-label")].map((e) => e.textContent),
    federatedCards: document.querySelectorAll(".card-federated").length,
    indexedHasAttribution: Boolean(
      [...document.querySelectorAll(".card")][2].querySelector(".card-attribution")
    ),
    externalScripts: document.querySelectorAll("script[src], iframe, link[href^='http']").length,
  });
}, 400);
</script></body></html>`;

function render() {
  const dir = mkdtempSync(join(tmpdir(), "eyeaux-"));
  const page = join(dir, "page.html");
  writeFileSync(page, html);
  try {
    const dom = execFileSync(
      "chromium",
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        // Same container flags as the other card tests.
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--window-size=760,900",
        "--virtual-time-budget=3000",
        "--dump-dom",
        `file://${page}`,
      ],
      { encoding: "utf8", timeout: 120000 },
    );
    const start = dom.indexOf("PROBE:");
    const end = dom.indexOf("</title>", start);
    return JSON.parse(
      dom
        .slice(start + 6, end)
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const probe = render();

check(
  "the badge names the provider as it spells itself",
  probe.labels,
  ["Source: Wikipedia", "Source: DuckDuckGo"],
);
check("both auxiliary cards are drawn as federated", probe.federatedCards, 2);
check("an indexed card carries no attribution", probe.indexedHasAttribution, false);
check("nothing external is embedded in the card", probe.externalScripts, 0);

if (failures.length) {
  console.error(`client-side federation: ${failures.length} failure(s)\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`client-side federation: all ${checks} checks passed`);
