/**
 * The stale-gateway guard.
 *
 * The site is served through a service worker that is cache-first for static
 * modules — including api-config.js. That is why a normal reload kept serving a
 * copy that pointed at the dead Render host while Ctrl+Shift+R, which bypasses
 * the worker, worked.
 *
 * These checks fail if the version stops being bumped in step, which is the
 * mistake that caused it.
 *
 *   node web/tests/cache-busting.test.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

const sw = read("web/sw.js");
const app = read("web/app.js");
const index = read("web/index.html");
const config = read("web/config/api-config.js");

const failures = [];
let checks = 0;
function check(label, ok) {
  checks += 1;
  if (!ok) failures.push(label);
}

// One version number, used in three places. If they drift, a browser keeps the
// old worker or the old module and the fix silently stops working.
const cacheName = /const CACHE_NAME = "eyesearch-v(\d+)"/.exec(sw)?.[1];
const registered = /register\("\.\/sw\.js\?v=(\d+)"\)/.exec(app)?.[1];
const scripted = /src="\.\/app\.js\?v=(\d+)"/.exec(index)?.[1];

check("sw.js declares a versioned cache", Boolean(cacheName));
check("app.js registers a versioned worker", Boolean(registered));
check("index.html versions the entry module", Boolean(scripted));
check("all three versions agree", cacheName === registered && registered === scripted);

// The worker must actually drop old caches on activate, or bumping does nothing.
check("activate deletes caches that do not match", /caches\.keys\(\)/.test(sw) && /caches\.delete/.test(sw));
check("install skips waiting", /self\.skipWaiting\(\)/.test(sw));
check("activate claims clients", /self\.clients\.claim\(\)/.test(sw));

// The gateway itself must never be the dead host.
check("api-config has no Render host", !config.includes("onrender"));
check("api-config defaults to the VM's TLS name", /DEFAULT_BASE = "https:\/\/eyesearch\.duckdns\.org"/.test(config));

// /v1 must never be answered from cache: search results are live.
check("the worker never caches /v1", /\/v1\//.test(sw) && /return;/.test(sw));

if (failures.length) {
  console.error(`cache busting: ${failures.length} failure(s)\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}
console.log(`cache busting: all ${checks} checks passed (version v${cacheName})`);
