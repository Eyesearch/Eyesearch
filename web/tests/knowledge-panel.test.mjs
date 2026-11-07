/**
 * The knowledge panel: one card, the right card, and a working toggle.
 *
 * Renders the real `web-card.js` in headless Chromium against the real
 * stylesheets and asserts the DOM — a jsdom shim would pass on markup that never
 * lays out.
 *
 *   node web/tests/knowledge-panel.test.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

const CARD_JS = readFileSync(join(root, "web/results/result-cards/web-card.js"), "utf8")
  // Every export stripped in one pass: naming them individually meant a new
  // function in the module broke every test that inlines it.
  .replace(/^export /gm, "");
const BASE_CSS = readFileSync(join(root, "web/base.css"), "utf8");
const CARD_CSS = readFileSync(join(root, "web/results/result-cards/card-renderer.css"), "utf8");

const LONG =
  "Karnataka is a state in the south western region of India. It was formed on 1 November 1956, with the passing of the States Reorganisation Act, and it was originally known as the State of Mysore. It was renamed Karnataka in 1973.";

const SHORT = "Karnataka is a state in south western India.";

const HERO = {
  title: "Karnataka",
  snippet_short: "Karnataka is a state in south western India.",
  snippet_full: LONG,
  url: "https://en.wikipedia.org/wiki/Karnataka",
  brand: "Wikipedia",
  source: "wikipedia",
  relevance: 0.85,
};

function run(cases) {
  const dir = mkdtempSync(join(tmpdir(), "kp-"));
  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}\n${CARD_CSS}</style></head>
<body><div id="host"></div>
<script>${CARD_JS}</script>
<script>
const CASES = ${JSON.stringify(cases)};
const out = [];
for (const c of CASES) {
  const host = document.getElementById("host");
  host.textContent = "";
  const result = { name: c.name };
  try {
    if (c.kind === "pick") {
      const picked = pickKnowledgeCard(c.primary, c.cards, c.query);
      result.picked = picked ? picked.title : null;
      out.push(result);
      continue;
    }
    const node = createKnowledgeHero(c.card, c.options || {});
    if (node) host.appendChild(node);
    const el = host.firstElementChild;
    result.present = !!el;
    if (el) {
      result.className = el.className;
      result.chips = el.querySelectorAll(".knowledge-card-chip").length;
      result.carousels = document.querySelectorAll(".knowledge-card-chips").length;
      const title = el.querySelector(".knowledge-hero-title");
      result.title = title ? title.textContent : null;
      result.titleTag = title ? title.tagName : null;
      const badge = el.querySelector(".knowledge-hero-badge");
      result.badge = badge ? badge.textContent : null;
      const body = el.querySelector(".knowledge-hero-snippet");
      result.text = body ? body.textContent : null;
      const more = el.querySelector(".knowledge-hero-more");
      result.hasToggle = !!more;
      if (more) {
        result.label = more.textContent;
        result.controls = more.getAttribute("aria-controls") === body.id;
        more.click();
        result.expanded = body.textContent;
        result.expandedLabel = more.textContent;
        result.aria = more.getAttribute("aria-expanded");
        more.click();
        result.collapsed = body.textContent;
        result.collapsedLabel = more.textContent;
      }
      const link = el.querySelector(".knowledge-hero-link");
      result.link = link ? link.getAttribute("href") : null;
      const rect = el.getBoundingClientRect();
      result.visible = rect.height > 0;
      result.width = Math.round(rect.width);
    }
  } catch (e) {
    result.error = String(e);
  }
  out.push(result);
}
document.title = JSON.stringify(out);
</script></body></html>`;

    const file = join(dir, "page.html");
    writeFileSync(file, html);
    const raw = execFileSync(
      "chromium",
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        // Container-friendly: no usable /dev/shm, no first-run profile.
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        // Hermetic: a card asks the site for its own favicon, and a real
        // request would leave the page waiting on someone else's server —
        // Chrome's virtual clock does not advance while a fetch is pending,
        // so the test hangs wherever that host is slow. Refuse every
        // external host instead: the icon fails at once, the letter tile
        // appears, and the test measures the app rather than the network.
        "--host-resolver-rules=MAP * ~NOTFOUND",
        "--dump-dom",
        `file://${file}`,
      ],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
    );
    const match = raw.match(/<title>([\s\S]*?)<\/title>/);
    if (!match) throw new Error("no result title in DOM");
    return JSON.parse(
      match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const cases = [
  { name: "long card", kind: "hero", card: HERO, options: { lessLabel: "Show less" } },
  { name: "short card", kind: "hero", card: { ...HERO, snippet_full: SHORT, snippet_short: SHORT } },
  { name: "no snippet", kind: "hero", card: null },
  { name: "exact title wins", kind: "pick", query: "karnataka",
    primary: { title: "Architecture of Karnataka", relevance: 0.9 },
    cards: [{ title: "Karnataka", relevance: 0.6 }, { title: "History of Karnataka", relevance: 0.7 }] },
  { name: "case insensitive", kind: "pick", query: "KARNATAKA",
    primary: { title: "Architecture of Karnataka" }, cards: [{ title: "karnataka" }] },
  { name: "no exact falls back to primary", kind: "pick", query: "karnataka",
    primary: { title: "Architecture of Karnataka" }, cards: [{ title: "History of Karnataka" }] },
  { name: "no primary uses relevance", kind: "pick", query: "karnataka", primary: null,
    cards: [{ title: "History of Karnataka", relevance: 0.2 }, { title: "Economy of Karnataka", relevance: 0.8 }] },
  { name: "empty", kind: "pick", query: "karnataka", primary: null, cards: [] },
];

const results = run(cases);
let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) passed += 1;
  else failures.push(`${name}: ${detail}`);
}

const by = Object.fromEntries(results.map((r) => [r.name, r]));

// The card itself
check("the card renders", by["long card"].present, "not rendered");
check("it is the hero", by["long card"].className === "knowledge-hero-card", by["long card"].className);
check("the title is a heading", by["long card"].titleTag === "H2", by["long card"].titleTag);
check("it names the source", by["long card"].badge === "Wikipedia", by["long card"].badge);
check("it links out", by["long card"].link === HERO.url, by["long card"].link);
check("it is visible", by["long card"].visible === true, "zero height");

// The carousel is gone
check("no chips are rendered", by["long card"].chips === 0, String(by["long card"].chips));
check("no carousel container exists", by["long card"].carousels === 0, String(by["long card"].carousels));

// The toggle
check("a long snippet has a toggle", by["long card"].hasToggle === true, "no toggle");
check("it starts collapsed", by["long card"].text.length < LONG.length, String(by["long card"].text.length));
check("it ends at a word, not mid-word", /…$/.test(by["long card"].text), by["long card"].text);
check("the button says More", by["long card"].label === "More", by["long card"].label);
check("it points at the snippet", by["long card"].controls === true, "aria-controls missing");
check("expanding shows the whole text", by["long card"].expanded === LONG, String(by["long card"].expanded.length));
check("the button says Show less", by["long card"].expandedLabel === "Show less", by["long card"].expandedLabel);
check("it reports its state", by["long card"].aria === "true", by["long card"].aria);
check("collapsing restores the excerpt", by["long card"].collapsed === by["long card"].text, by["long card"].collapsed);
check("the label returns to More", by["long card"].collapsedLabel === "More", by["long card"].collapsedLabel);

// Short text
check("a short snippet has no toggle", by["short card"].hasToggle === false, "toggle appeared");
check("a short snippet is shown whole", by["short card"].text === SHORT, by["short card"].text);
check("an empty card renders nothing", by["no snippet"].present === false, "rendered anyway");

// Picking
check("an exact title beats the server's pick", by["exact title wins"].picked === "Karnataka", by["exact title wins"].picked);
check("the match ignores case", by["case insensitive"].picked === "karnataka", by["case insensitive"].picked);
check("without an exact match the server's pick stands", by["no exact falls back to primary"].picked === "Architecture of Karnataka", by["no exact falls back to primary"].picked);
check("without a primary the most relevant wins", by["no primary uses relevance"].picked === "Economy of Karnataka", by["no primary uses relevance"].picked);
check("an empty set picks nothing", by["empty"].picked === null, String(by["empty"].picked));

const total = passed + failures.length;
if (failures.length) {
  console.error("knowledge panel: FAILED");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}
console.log(`knowledge panel: all ${total} checks passed`);
