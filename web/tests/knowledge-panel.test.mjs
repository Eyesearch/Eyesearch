/**
 * Knowledge panel rendering.
 *
 * Renders the real `web-card.js` in headless Chromium against the real
 * stylesheets and asserts the DOM, the same way the card tests do — a jsdom
 * shim would pass on markup that never lays out.
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
  // Every export is stripped in one pass. Naming them individually meant a
  // new function in the module broke every test that inlines it.
  .replace(/^export /gm, "")
  .replace("export function createKnowledgeChips", "function createKnowledgeChips");
const BASE_CSS = readFileSync(join(root, "web/base.css"), "utf8");
const CARD_CSS = readFileSync(join(root, "web/results/result-cards/card-renderer.css"), "utf8");

const HERO = {
  title: "Karnataka",
  snippet_short: "Karnataka is a state in south western India.",
  snippet_full:
    "Karnataka is a state in south western India. It was formed on 1 November 1956, with Bengaluru as its capital.",
  has_more: true,
  url: "https://en.wikipedia.org/wiki/Karnataka",
  brand: "Wikipedia",
  source: "wikipedia",
  relevance: 0.85,
};

const CARDS = [
  { title: "KSRTC", url: "https://ksrtc.in/", brand: "KSRTC", source: "searxng" },
  { title: "Bengaluru", url: "https://en.wikipedia.org/wiki/Bengaluru", brand: "Wikipedia" },
];

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
  let node = null;
  try {
    node = c.kind === "hero" ? createKnowledgeHero(c.card, c.options || {})
                             : createKnowledgeChips(c.cards, c.options || {});
  } catch (e) {
    out.push({ name: c.name, error: String(e) });
    continue;
  }
  if (node) host.appendChild(node);
  const el = host.firstElementChild;
  const result = { name: c.name, present: !!el };
  if (el) {
    result.className = el.className;
    result.text = el.textContent;
    result.tag = el.tagName;
    const title = el.querySelector(".knowledge-hero-title, .knowledge-card-chip-title");
    result.title = title ? title.textContent : null;
    const badge = el.querySelector(".knowledge-hero-badge");
    result.badge = badge ? badge.textContent : null;
    const link = el.querySelector(".knowledge-hero-link");
    result.link = link ? link.getAttribute("href") : null;
    result.rel = link ? link.getAttribute("rel") : null;
    const more = el.querySelector(".knowledge-hero-more");
    result.hasMore = !!more;
    if (more) {
      more.click();
      result.expandedText = el.querySelector(".knowledge-hero-snippet").textContent;
      result.expandedAria = more.getAttribute("aria-expanded");
      more.click();
      result.collapsedAgain = el.querySelector(".knowledge-hero-snippet").textContent;
    }
    result.chips = el.querySelectorAll(".knowledge-card-chip").length;
    const rect = el.getBoundingClientRect();
    result.width = Math.round(rect.width);
    result.visible = rect.height > 0;
  }
  out.push(result);
}
document.title = JSON.stringify(out);
</script></body></html>`;

    const file = join(dir, "page.html");
    writeFileSync(file, html);
    const raw = execFileSync(
      "chromium",
      ["--headless", "--no-sandbox", "--disable-gpu", "--dump-dom", `file://${file}`],
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
  { name: "hero with more", kind: "hero", card: HERO },
  { name: "hero without more", kind: "hero", card: { ...HERO, has_more: false } },
  { name: "hero with no title", kind: "hero", card: { ...HERO, title: "" } },
  { name: "empty hero", kind: "hero", card: null },
  { name: "chips", kind: "chips", cards: CARDS },
  { name: "no chips", kind: "chips", cards: [] },
  { name: "chips skip unusable", kind: "chips", cards: [{ title: "no url" }, CARDS[0]] },
];

const results = run(cases);
let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) passed += 1;
  else failures.push(`${name}: ${detail}`);
}

const by = Object.fromEntries(results.map((r) => [r.name, r]));

check("hero renders", by["hero with more"].present, "not rendered");
check(
  "hero carries its class",
  by["hero with more"].className === "knowledge-hero-card",
  by["hero with more"].className
);
check("hero shows the title", by["hero with more"].title === "Karnataka", by["hero with more"].title);
check("hero names the source", by["hero with more"].badge === "Wikipedia", by["hero with more"].badge);
check(
  "hero links to the source",
  by["hero with more"].link === HERO.url,
  by["hero with more"].link
);
check("the link is safe", by["hero with more"].rel === "noopener noreferrer", by["hero with more"].rel);
check("the toggle exists when has_more", by["hero with more"].hasMore, "no toggle");
check(
  "the toggle expands to the full text",
  by["hero with more"].expandedText === HERO.snippet_full,
  by["hero with more"].expandedText
);
check("the toggle reports its state", by["hero with more"].expandedAria === "true", by["hero with more"].expandedAria);
check(
  "the toggle collapses again",
  by["hero with more"].collapsedAgain === HERO.snippet_short,
  by["hero with more"].collapsedAgain
);
check("the hero is visible", by["hero with more"].visible === true, "zero height");
check("the hero is full width", by["hero with more"].width > 300, by["hero with more"].width);

check("no toggle without has_more", by["hero without more"].hasMore === false, "toggle appeared");
check("a titleless hero falls back to the host", by["hero with no title"].title === "en.wikipedia.org", by["hero with no title"].title);
check("an empty hero renders nothing", by["empty hero"].present === false, "rendered anyway");

check("chips render", by["chips"].chips === 2, String(by["chips"].chips));
check("chips carry their class", by["chips"].className === "knowledge-card-chips", by["chips"].className);
check("no chips when the list is empty", by["no chips"].present === false, "rendered anyway");
check("an unusable chip is skipped", by["chips skip unusable"].chips === 1, String(by["chips skip unusable"].chips));

const total = passed + failures.length;
if (failures.length) {
  console.error("knowledge panel: FAILED");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}
console.log(`knowledge panel: all ${total} checks passed`);
