/**
 * Mobile layout tests.
 *
 * Renders the real stylesheets and the real card module at phone widths and
 * asserts that nothing pushes the page sideways. Run with:
 *
 *   node web/tests/mobile-layout.test.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

const CARD_JS = read("web/results/result-cards/web-card.js")
  .replace("export function createWebCard", "function createWebCard")
  .replace("export function equaliseCardHeights", "function equaliseCardHeights");

const STYLES = [read("web/base.css"), read("web/home/search-input/search-input.css"), read("web/results/result-cards/card-renderer.css")]
  .map((css) => `<style>${css}</style>`)
  .join("\n");

const LONG = "The department publishes district health notifications for every office across the state, with contact details and deadlines for each district health officer, and a helpline for complaints.";

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${STYLES}</head><body>
<div class="search-form"><input class="search-field" value="karnataka"><input class="search-field is-kannada" value="ಕರ್ನಾಟಕ"></div>
<div id="cards"></div>
<script>${CARD_JS}
const rows = [
  {url:"https://karnataka.gov.in/dept/health/notifications", title:"District Health Notifications", snippet:"${LONG}", category:"GOV", brand_name:"Karnataka", breadcrumbs:["Dept","Health","Notifications"]},
  {url:"https://aboutamazon.in/news/x", title:"Amazon becomes water positive in India", snippet:"India", category:"NEWS", brand_name:"About Amazon India", breadcrumbs:["News","Sustainability"]},
  {url:"https://a.com/x", title:"Short", snippet:"A short note.", category:"WEB"},
  {url:"https://b.com/y", title:"Long", snippet:"${LONG} ${LONG}", category:"WEB", brand_name:"B"},
  {url:"https://c.com/z", title:"Third", snippet:"Another note here.", category:"TECH", brand_name:"C"},
];
const out = document.getElementById("cards");
for (const r of rows) out.appendChild(createWebCard(r, {}));
equaliseCardHeights(out);
setTimeout(() => {
  const doc = document.documentElement;
  const probe = {
    viewport: window.innerWidth,
    scrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflow: doc.scrollWidth - window.innerWidth,
    inputFont: getComputedStyle(document.querySelector(".search-field")).fontSize,
    kannadaInputFont: getComputedStyle(document.querySelector(".is-kannada")).fontSize,
    cards: [...document.querySelectorAll(".card")].map((c) => {
      const r = c.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right) };
    }),
    snippetLines: [...document.querySelectorAll(".card-snippet")].map((s) => {
      const lineHeight = parseFloat(getComputedStyle(s).lineHeight);
      return Math.round((s.clientHeight / lineHeight) * 10) / 10;
    }),
    // Whether the text is actually cut off, which is what should decide
    // whether a card offers "More" — not how long the text happens to look.
    overflowing: [...document.querySelectorAll(".card-snippet")].map(
      (s) => s.scrollHeight > s.clientHeight + 1,
    ),
    clamp: getComputedStyle(document.querySelector(".card-snippet")).webkitLineClamp,
    moreVisible: [...document.querySelectorAll(".card-more")].map((b) => !b.hidden),
    toggle: (() => {
      const button = [...document.querySelectorAll(".card-more")].find((b) => !b.hidden);
      if (!button) return null;
      const snippet = button.closest(".card").querySelector(".card-snippet");
      const lineHeight = parseFloat(getComputedStyle(snippet).lineHeight);
      button.click();
      const expanded = {
        label: button.textContent,
        lines: Math.round((snippet.clientHeight / lineHeight) * 10) / 10,
      };
      button.click();
      return {
        expanded,
        collapsed: {
          label: button.textContent,
          lines: Math.round((snippet.clientHeight / lineHeight) * 10) / 10,
        },
      };
    })(),
    widest: Math.max(...[...document.querySelectorAll(".card, .card *")].map((e) => Math.round(e.getBoundingClientRect().right))),
  };
  document.title = "PROBE:" + JSON.stringify(probe);
}, 600);
</script></body></html>`;

function probeAt(width) {
  const dir = mkdtempSync(join(tmpdir(), "eyemob-"));
  const file = join(dir, "page.html");
  writeFileSync(file, page);
  try {
    const dom = execFileSync(
      "chromium",
      ["--headless", "--disable-gpu", "--no-sandbox", `--window-size=${width},900`,
       "--virtual-time-budget=4000", "--dump-dom", `file://${file}`],
      { encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "ignore"] },
    );
    const start = dom.indexOf("PROBE:");
    return JSON.parse(dom.slice(start + 6, dom.indexOf("</title>", start)).replace(/&quot;/g, '"'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const failures = [];
let checks = 0;
function check(label, actual, expected) {
  checks += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

for (const width of [360, 390, 412, 768, 1280]) {
  const p = probeAt(width);
  const where = `${width}px`;

  check(`${where}: no horizontal overflow`, p.overflow <= 0, true);
  check(`${where}: no card reaches past the viewport`, p.widest <= p.viewport + 1, true);
  check(`${where}: the search field is 16px`, p.inputFont, "16px");
  check(`${where}: the Kannada field is 16px`, p.kannadaInputFont, "16px");
  check(`${where}: every card fits the column`, p.cards.every((c) => c.width <= p.viewport), true);

  // The clamp is two lines everywhere, and no collapsed snippet may render a
  // third — a mobile rule used to set it to 3 and every card showed three.
  check(`${where}: the snippet is clamped to two lines`, p.clamp, "2");
  check(`${where}: no collapsed snippet exceeds two lines`, Math.max(...p.snippetLines) <= 2, true);

  if (width <= 600) {
    // Height follows content on a phone, so cards may differ, and a short
    // snippet takes one line rather than holding empty space.
    check(`${where}: cards size themselves`, new Set(p.cards.map((c) => c.height)).size > 1, true);
    check(`${where}: a short snippet takes one line`, Math.min(...p.snippetLines), 1);
  } else {
    check(`${where}: cards share one height`, new Set(p.cards.map((c) => c.height)).size, 1);
  }

  // "More" only where the clamp actually cuts text, and it expands in place.
  check(`${where}: More is offered exactly where the text is cut`, p.moreVisible, p.overflowing);
  check(`${where}: at least one card offers More`, p.moreVisible.some(Boolean), true);
  check(`${where}: More expands past two lines`, p.toggle?.expanded.lines > 2, true);
  check(`${where}: the label becomes Less`, p.toggle?.expanded.label, "Less");
  check(`${where}: Less collapses to two lines`, p.toggle?.collapsed.lines, 2);
  check(`${where}: the label returns to More`, p.toggle?.collapsed.label, "More");
}

if (failures.length) {
  console.error(`mobile layout: ${failures.length} failure(s)\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`mobile layout: all ${checks} checks passed across 360/390/412/768/1280`);
