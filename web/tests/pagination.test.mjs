/**
 * Pagination tests.
 *
 * The page numbers are drawn by `pagination.js` and nothing else, so they can be
 * rendered in headless Chromium and read back as DOM. That is the same approach
 * the card tests take, and it needs nothing installed beyond a Chromium binary.
 *
 *   node web/tests/pagination.test.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

const PAGINATION_JS = readFileSync(join(root, "web/results/pagination/pagination.js"), "utf8")
  .replace(/^export /gm, "");

const CHROMIUM = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].find(
  (name) => {
    try {
      execFileSync("which", [name], { stdio: "pipe" });
      return name;
    } catch (error) {
      return null;
    }
  },
);

if (!CHROMIUM) {
  console.error("pagination tests need a Chromium binary on PATH");
  process.exit(1);
}

const CASES = [
  {
    name: "the first page offers every direction forward",
    page: 1,
    totalPages: 5,
    expect: ["Previous", "1", "2", "3", "4", "5", "Next"],
    disabled: ["Previous"],
    current: "1",
  },
  {
    name: "a middle page keeps the ends in reach",
    page: 10,
    totalPages: 20,
    expect: ["Previous", "1", "…", "8", "9", "10", "11", "12", "…", "20", "Next"],
    disabled: [],
    current: "10",
  },
  {
    name: "the last page cannot go further",
    page: 5,
    totalPages: 5,
    expect: ["Previous", "1", "2", "3", "4", "5", "Next"],
    disabled: ["Next"],
    current: "5",
  },
  {
    name: "one page means no footer at all",
    page: 1,
    totalPages: 1,
    expect: [],
    disabled: [],
    current: null,
  },
];

function renderOne({ page, totalPages }) {
  const html = `<!doctype html><html><body><div id="out"></div>
<script type="module">
${PAGINATION_JS}
const out = document.getElementById("out");
const nav = createPagination({ page: ${page}, totalPages: ${totalPages}, onPage: () => {} });
if (nav) out.appendChild(nav);
</script></body></html>`;
  const dir = mkdtempSync(join(tmpdir(), "eyesearch-pagination-"));
  const file = join(dir, "case.html");
  writeFileSync(file, html);
  try {
    const dom = execFileSync(
      CHROMIUM,
      ["--headless", "--disable-gpu", "--no-sandbox", "--dump-dom", `file://${file}`],
      { encoding: "utf8", timeout: 60000 },
    );
    return dom;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let failures = 0;
for (const testCase of CASES) {
  const dom = renderOne(testCase);
  const labels = [...dom.matchAll(/class="pagination-button[^"]*"[^>]*>([^<]+)</g)].map((m) =>
    m[1].trim(),
  );
  const gaps = (dom.match(/class="pagination-gap"/g) || []).length;
  const withGaps =
    gaps === 0
      ? labels
      : labels.reduce((all, label) => {
          all.push(label);
          return all;
        }, []);

  const expectedNumbers = testCase.expect.filter((label) => label !== "…");
  const numbersMatch =
    JSON.stringify(withGaps) === JSON.stringify(expectedNumbers) &&
    gaps === testCase.expect.filter((label) => label === "…").length;

  const disabled = [...dom.matchAll(/class="pagination-button[^"]*"[^>]*disabled[^>]*>([^<]+)</g)]
    .map((m) => m[1].trim())
    .sort();
  const disabledMatch = JSON.stringify(disabled) === JSON.stringify([...testCase.disabled].sort());

  const currentMatch = testCase.current
    ? new RegExp(`aria-current="page"[^>]*>${testCase.current}<`).test(dom) ||
      new RegExp(`>${testCase.current}<`).test(dom)
    : !/aria-current="page"/.test(dom);

  if (!numbersMatch || !disabledMatch || !currentMatch) {
    failures += 1;
    console.error(`FAIL ${testCase.name}`);
    console.error(`  numbers  ${JSON.stringify(withGaps)} (want ${JSON.stringify(expectedNumbers)})`);
    console.error(`  gaps     ${gaps} (want ${testCase.expect.filter((l) => l === "…").length})`);
    console.error(`  disabled ${JSON.stringify(disabled)} (want ${JSON.stringify(testCase.disabled)})`);
    console.error(`  current  ${currentMatch}`);
  } else {
    console.log(`ok ${testCase.name}`);
  }
}

if (failures) {
  console.error(`${failures} pagination case(s) failed`);
  process.exit(1);
}
console.log("pagination: all cases passed");
