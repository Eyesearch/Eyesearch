/**
 * Card rendering tests.
 *
 * There is no bundler and no npm dependency here on purpose — the web client is
 * plain modules served as files. So the test renders the real `web-card.js` in
 * headless Chromium against the real stylesheets and asserts the DOM that comes
 * out. That is closer to what a user gets than a jsdom shim would be, and it
 * needs nothing installed beyond a Chromium binary.
 *
 *   node web/tests/card-render.test.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

const CARD_JS = readFileSync(join(root, "web/results/result-cards/web-card.js"), "utf8")
  .replace("export function createWebCard", "function createWebCard");
const BASE_CSS = readFileSync(join(root, "web/base.css"), "utf8");
const CARD_CSS = readFileSync(join(root, "web/results/result-cards/card-renderer.css"), "utf8");

const CASES = [
  {
    name: "an indexed card with breadcrumbs",
    result: {
      url: "https://karnataka.gov.in/dept/health/notifications",
      title: "District Health Notifications",
      snippet: "The department publishes district health notifications.",
      category: "GOV",
      brand_name: "Karnataka",
      breadcrumbs: ["Dept", "Health", "Notifications"],
    },
  },
  {
    name: "a federated card with attribution and facts",
    result: {
      url: "https://en.wikipedia.org/wiki/Bengaluru",
      title: "Bengaluru",
      snippet: "Bengaluru is the capital of Karnataka.",
      category: "WEB",
      source: "wikipedia",
      source_url: "https://en.wikipedia.org/wiki/Bengaluru",
      entities: {
        phones: ["080-22221234"],
        pin_codes: ["560001"],
        dates: ["12 October 2026"],
      },
    },
  },
  {
    name: "an older card with neither",
    result: { url: "https://a.com/x", title: "Plain", snippet: "plain" },
  },
];

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${BASE_CSS}</style><style>${CARD_CSS}</style></head>
<body><div id="out"></div><script>${CARD_JS}
const cases = ${JSON.stringify(CASES)};
const out = document.getElementById("out");
for (const item of cases) out.appendChild(createWebCard(item.result, {}));
setTimeout(() => {
  const probe = {
    crumbs: [...document.querySelectorAll(".card-breadcrumb")].map((e) => e.textContent.trim()),
    parts: [...document.querySelectorAll(".card-crumb-part")].map((e) => e.textContent),
    attribution: [...document.querySelectorAll(".card-attribution-label")].map((e) => e.textContent),
    outbound: [...document.querySelectorAll(".card-attribution-link")].map((e) => e.getAttribute("href")),
    facts: [...document.querySelectorAll(".card-facts li")].map((e) => e.textContent),
    icons: [...document.querySelectorAll(".card-favicon img")].map((e) => e.getAttribute("src")),
  };
  document.title = "PROBE:" + JSON.stringify(probe);
}, 400);
</script></body></html>`;

function render() {
  const dir = mkdtempSync(join(tmpdir(), "eyecard-"));
  const page = join(dir, "page.html");
  writeFileSync(page, html);
  try {
    const dom = execFileSync(
      "chromium",
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--window-size=760,900",
        "--virtual-time-budget=4000",
        "--dump-dom",
        `file://${page}`,
      ],
      { encoding: "utf8", timeout: 120000 },
    );
    const start = dom.indexOf("PROBE:");
    const end = dom.indexOf("</title>", start);
    return JSON.parse(dom.slice(start + 6, end).replace(/&quot;/g, '"'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
}

const probe = render();

check("breadcrumb parts", probe.parts, ["Dept", "Health", "Notifications"]);
check("breadcrumb reads as words", probe.crumbs[0].startsWith("karnataka.gov.in"), true);
check("breadcrumb joins with a separator", probe.crumbs[0].includes("Dept › Health"), true);
check("attribution names the source", probe.attribution, ["Source: Wikipedia"]);
check("attribution links out", probe.outbound, ["https://en.wikipedia.org/wiki/Bengaluru"]);
check("structured facts are shown", probe.facts, ["080-22221234", "PIN 560001", "12 October 2026"]);

// The card must ask the site for its own icon; a third-party icon service would
// leak which page the reader is on.
check(
  "icons are requested from the site itself",
  probe.icons.every((src) => !/duckduckgo|google\.com\/s2/.test(src)),
  true,
);
check("a card with no breadcrumbs falls back to the host", probe.crumbs[2], "a.com");

if (failures.length) {
  console.error(`card rendering: ${failures.length} failure(s)\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`card rendering: all ${7} checks passed`);
