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
  .replace("export function createWebCard", "function createWebCard")
  .replace("export function equaliseCardHeights", "function equaliseCardHeights");
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
      federated: true,
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
  {
    name: "a card whose snippet overflows two lines",
    result: {
      url: "https://b.gov.in/notices",
      title: "Notices",
      category: "GOV",
      source: "eyesearch_index",
      snippet:
        "The department publishes district health notifications for every office across the state, " +
        "with contact details and deadlines for each district health officer, and a helpline for complaints. " +
        "Notifications are updated every Monday and cover recruitment, examinations, welfare schemes and " +
        "public health advisories issued by the directorate throughout the year.",
    },
  },
];

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${BASE_CSS}</style><style>${CARD_CSS}</style></head>
<body><div id="out"></div><script>${CARD_JS}
const cases = ${JSON.stringify(CASES)};
const out = document.getElementById("out");
for (const item of cases) out.appendChild(createWebCard(item.result, {}));
equaliseCardHeights(out);
setTimeout(() => {
  const probe = {
    crumbs: [...document.querySelectorAll(".card-breadcrumb")].map((e) => e.textContent.trim()),
    parts: [...document.querySelectorAll(".card-crumb-part")].map((e) => e.textContent),
    attribution: [...document.querySelectorAll(".card-attribution-label")].map((e) => e.textContent),
    outbound: [...document.querySelectorAll(".card-attribution-link")].map((e) => e.getAttribute("href")),
    facts: [...document.querySelectorAll(".card-facts li")].map((e) => e.textContent),
    icons: [...document.querySelectorAll(".card-favicon img")].map((e) => e.getAttribute("src")),
    moreVisible: [...document.querySelectorAll(".card-more")].map((b) => !b.hidden),
    heights: [...document.querySelectorAll(".card")].map((c) => ({
      height: Math.round(c.getBoundingClientRect().height),
      federated: Boolean(c.querySelector(".card-attribution")),
    })),
  };

  const toggle = [...document.querySelectorAll(".card-more")].find((b) => !b.hidden);
  if (toggle) {
    const card = toggle.closest(".card");
    const snippet = card.querySelector(".card-snippet");
    const style = getComputedStyle(toggle);
    const buttonRect = toggle.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    probe.toggleStyle = {
      borderWidth: style.borderTopWidth,
      appearance: style.appearance,
    };
    // Flush with the content's right edge: the card's own padding is the gap.
    probe.toggleGapRight = Math.round(cardRect.right - buttonRect.right);

    // The snippet is what grows. The card may not: with a uniform floor it is
    // already as tall as the tallest card in the list, so expanding a short
    // snippet changes the text, not the row.
    const snippetBefore = Math.round(snippet.getBoundingClientRect().height);
    const cardBefore = Math.round(card.getBoundingClientRect().height);
    toggle.click();
    probe.expanded = {
      label: toggle.textContent,
      snippetGrew: Math.round(snippet.getBoundingClientRect().height) > snippetBefore,
      aria: toggle.getAttribute("aria-expanded"),
    };
    toggle.click();
    probe.collapsed = {
      label: toggle.textContent,
      snippetHeight: Math.round(snippet.getBoundingClientRect().height),
      backToDefault: Math.round(card.getBoundingClientRect().height) === cardBefore,
    };
  }
  document.title = "PROBE:" + JSON.stringify(probe);
}, 600);
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
let checks = 0;
function check(label, actual, expected) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
}

const probe = render();

check("breadcrumb parts", probe.parts, ["Dept", "Health", "Notifications"]);
check("breadcrumb reads as words", probe.crumbs[0].startsWith("karnataka.gov.in"), true);
check("breadcrumb joins with a separator", probe.crumbs[0].includes("Dept › Health"), true);
check("structured facts are shown", probe.facts, ["080-22221234", "PIN 560001", "12 October 2026"]);

// Attribution belongs to someone else's words only. `source` is set on every
// row — it names the index — so keying on it put "Source: eyesearch_index" on
// every card. Exactly one card here is federated, so exactly one badge.
check("attribution names the source", probe.attribution, ["Source: Wikipedia"]);
check("attribution links out", probe.outbound, ["https://en.wikipedia.org/wiki/Bengaluru"]);
check("indexed cards carry no attribution", probe.attribution.length, 1);

// The "More" toggle: offered only where the clamp cuts text, and it expands in
// place rather than sending the reader away.
check("More is offered only where it is needed", probe.moreVisible, [false, false, false, true]);
check("More expands the snippet", probe.expanded?.snippetGrew, true);
check("the button becomes Less", probe.expanded?.label, "Less");
check("the expanded state is announced", probe.expanded?.aria, "true");
check("Less collapses the snippet again", probe.collapsed?.label, "More");
check("collapsing restores the default height", probe.collapsed?.backToDefault, true);

// Every card is the same height in its default state, whether or not it offers
// "More" — the toggle is positioned over the snippet rather than stacked after
// it — and whether or not it is federated. The list takes the tallest card's
// height, so nothing stands proud of the column.
check("a federated card is measured too, not left standing taller", probe.heights.some((c) => c.federated), true);

// The toggle is plain text: no box, no native button chrome.
check("the toggle has no border", probe.toggleStyle?.borderWidth, "0px");
check("the toggle has no native appearance", probe.toggleStyle?.appearance, "none");

// Aligned to the right edge of the content area (the card's padding is the gap).
check("the toggle sits on the right", probe.toggleGapRight <= 20, true);

// One height for the whole list, computed from the tallest card actually
// rendered rather than a number guessed at in the stylesheet.
check("every card shares one height", new Set(probe.heights.map((c) => c.height)).size, 1);

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

console.log(`card rendering: all ${checks} checks passed`);
