/**
 * Which gateway the app talks to, and why.
 *
 * The rule that matters: an https:// page may not call an http:// API. Chrome
 * blocks it as mixed content before the request leaves the machine, so the
 * choice is made from the page's own protocol rather than from a preference.
 *
 *   node web/tests/api-config.test.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE = readFileSync(join(root, "web/config/api-config.js"), "utf8");

function probe(origin) {
  const dir = mkdtempSync(join(tmpdir(), "eyeapi-"));
  const file = join(dir, "probe.mjs");
  writeFileSync(
    file,
    `globalThis.location = ${JSON.stringify(new URL(origin).protocol ? { hostname: new URL(origin).hostname, protocol: new URL(origin).protocol } : {})};
globalThis.window = { location: globalThis.location };
${SOURCE}
console.log(JSON.stringify({
  base: API_CONFIG.baseUrl,
  search: buildSearchUrl("karnataka", 10),
  suggest: buildSuggestUrl("kar"),
}));
`,
  );
  try {
    const out = execFileSync("node", [file], { encoding: "utf8" });
    return JSON.parse(out.trim().split("\n").pop());
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

// The hosted site is https, so it must use the https gateway — never the IP.
const pages = probe("https://eyesearch.github.io");
check("the https site uses the https gateway", pages.base, "https://eyesearch.duckdns.org");
check("search path is /v1/search with q and limit", pages.search.includes("/v1/search?q=karnataka&limit=10"), true);
check("suggest path is /v1/suggest with q", pages.suggest.includes("/v1/suggest?q=kar"), true);
check("the https site never calls the plain-http IP", pages.search.startsWith("http://"), false);

// A page served over http may use the IP, because nothing is blocked there.
const vm = probe("http://35.255.20.40");
check("an http page uses the VM address", vm.base, "http://35.255.20.40:8000");

// Local development stays on localhost.
const local = probe("http://127.0.0.1:8000");
check("local dev stays on localhost", local.base, "http://127.0.0.1:8000");

if (failures.length) {
  console.error(`api config: ${failures.length} failure(s)\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}
console.log(`api config: all ${checks} checks passed`);
