/**
 * Timeout, retry and error classification in `config/api-config.js`.
 *
 * The module is loaded in Node with a stubbed `fetch`, so each failure mode can
 * be produced on demand: a hang, a dropped socket, a 4xx, a 5xx, a user abort.
 * That is the only way to test a retry without waiting fifteen seconds.
 *
 *   node web/tests/api-retry.test.mjs
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE = readFileSync(join(root, "web/config/api-config.js"), "utf8");

async function scenario(body) {
  const dir = mkdtempSync(join(tmpdir(), "eye-retry-"));
  const file = join(dir, "probe.mjs");
  writeFileSync(
    file,
    `globalThis.location = { hostname: "eyesearch.github.io", protocol: "https:" };
globalThis.window = { location: globalThis.location };
// Node 21+ ships a getter-only \`navigator\`, so plain assignment throws there
// while working on Node 20. Defining it is valid on both, which matters
// because CI runs a newer Node than a developer's laptop.
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
  writable: true,
});
${SOURCE}
${body}
`,
  );
  try {
    const module = await import(`file://${file}`);
    return await module.__probe();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A fetch that fails the first `failures` calls, then answers. */
function stubFetch(plan) {
  let calls = 0;
  const record = { calls: 0, aborted: 0 };
  globalThis.fetch = async (url, options) => {
    calls += 1;
    record.calls = calls;
    const step = plan[Math.min(calls - 1, plan.length - 1)];
    if (step === "hang") {
      return await new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          record.aborted += 1;
          reject(options.signal.reason || new DOMException("aborted", "AbortError"));
        });
      });
    }
    if (step === "drop") throw new TypeError("Failed to fetch");
    return {
      ok: step < 400,
      status: step,
      json: async () => ({ query: "q", results: [] }),
    };
  };
  return record;
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
}

// 0. The panel survives the mapping.
{
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      query: "phonepe",
      results: [{ url: "https://www.phonepe.com/" }],
      primary_card: { title: "PhonePe", url: "https://en.wikipedia.org/wiki/PhonePe" },
      knowledge_cards: [{ title: "PhonePe", url: "https://a.in/x" }],
      blend: { intent: "navigational", organic_count: 1, knowledge_count: 1, took_ms: 42 },
    }),
  });
  const value = await scenario(`
export async function __probe() { return await searchWeb("phonepe"); }
`);
  check("the hero card survives", value.primary_card && value.primary_card.title === "PhonePe", JSON.stringify(value.primary_card));
  check("the chips survive", Array.isArray(value.knowledge_cards) && value.knowledge_cards.length === 1, JSON.stringify(value.knowledge_cards));
  check("the blend metadata survives", value.blend && value.blend.intent === "navigational", JSON.stringify(value.blend));
}

// 0b. A response without a panel is still valid.
{
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ query: "q", results: [] }) });
  const value = await scenario(`
export async function __probe() { return await searchWeb("q"); }
`);
  check("no hero is null, not undefined", value.primary_card === null, String(value.primary_card));
  check("no chips is an empty list", Array.isArray(value.knowledge_cards) && value.knowledge_cards.length === 0, JSON.stringify(value.knowledge_cards));
}

// 1. The window is fifteen seconds.
await scenario(`
export async function __probe() {
  return { timeout: DEFAULT_TIMEOUT_MS, config: API_CONFIG.requestTimeoutMs, backoff: API_CONFIG.retryBackoffMs };
}
`).then((value) => {
  check("the default timeout is 15 s", value.timeout === 15000, String(value.timeout));
  check("the config uses the same window", value.config === 15000, String(value.config));
  check("the backoff is 800 ms", value.backoff === 800, String(value.backoff));
});

// 2. A dropped connection is retried once.
{
  const record = stubFetch(["drop", 200]);
  const value = await scenario(`
export async function __probe() {
  try { await searchWeb("karnataka"); return { ok: true }; }
  catch (error) { return { ok: false, code: error.code }; }
}
`).catch((error) => ({ ok: false, code: String(error) }));
  check("a dropped connection is retried", record.calls === 2, `calls=${record.calls}`);
  check("and then succeeds", value.ok === true, JSON.stringify(value));
}

// 3. A 4xx is never retried.
{
  const record = stubFetch([400]);
  const value = await scenario(`
export async function __probe() {
  try { await searchWeb("karnataka"); return { ok: true }; }
  catch (error) { return { ok: false, code: error.code, retryable: error.retryable }; }
}
`);
  check("a 4xx is not retried", record.calls === 1, `calls=${record.calls}`);
  check("and is reported not retryable", value.retryable === false, JSON.stringify(value));
}

// 4. A 5xx is retried once.
{
  const record = stubFetch([503, 200]);
  const value = await scenario(`
export async function __probe() {
  try { await searchWeb("karnataka"); return { ok: true }; }
  catch (error) { return { ok: false, code: error.code }; }
}
`);
  check("a 5xx is retried", record.calls === 2, `calls=${record.calls}`);
  check("and then succeeds", value.ok === true, JSON.stringify(value));
}

// 5. A timeout is reported as a timeout, not as an unreachable gateway.
{
  stubFetch(["hang"]);
  const value = await scenario(`
export async function __probe() {
  try { await searchWeb("karnataka", { timeoutMs: 40 }); return { ok: true }; }
  catch (error) { return { ok: false, code: error.code, message: error.message }; }
}
`);
  check("a timeout keeps its own code", value.code === "timeout", JSON.stringify(value));
  check(
    "and does not claim the gateway is unreachable",
    !/can't reach/i.test(value.message || ""),
    value.message,
  );
}

// 6. A user abort is reported as a cancel, and never retried.
{
  const record = stubFetch(["hang"]);
  const value = await scenario(`
export async function __probe() {
  const controller = new AbortController();
  const promise = searchWeb("karnataka", { signal: controller.signal });
  controller.abort();
  try { await promise; return { ok: true }; }
  catch (error) { return { ok: false, code: error.code, retryable: error.retryable }; }
}
`);
  check("an abort keeps its own code", value.code === "aborted", JSON.stringify(value));
  check("an abort is not retried", value.retryable === false, JSON.stringify(value));
}

const failures = results.filter((r) => !r.ok);
if (failures.length) {
  console.error("api retry: FAILED");
  for (const failure of failures) console.error(`  - ${failure.name}: ${failure.detail}`);
  process.exit(1);
}
console.log(`api retry: all ${results.length} checks passed`);
