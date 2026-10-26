/**
 * results/meta-info — speed, cache state and provider health.
 *
 * One status line for humans ("5 results · found in 0.43s") plus badges for the
 * facts the gateway is honest about: `degraded`, `cache_hit` and which providers
 * actually answered. A latency figure the gateway did not measure is labelled as
 * measured by the browser.
 */

import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

const PROVIDER_LABEL = {
  duckduckgo: "DuckDuckGo",
  duckduckgo_html: "DuckDuckGo HTML",
  duckduckgo_lite: "DuckDuckGo Lite",
  bing: "Bing",
  turso_cache: "cache",
  cache: "cache",
  chain: "gateway",
};

function providerLabel(name) {
  return PROVIDER_LABEL[name] || String(name || "").replace(/_/g, " ");
}

function formatSeconds(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return null;
  return value < 1000 ? `${(value / 1000).toFixed(2)}s` : `${(value / 1000).toFixed(1)}s`;
}

/**
 * @param {HTMLElement} container
 */
export function mountLatencyBadge(container) {
  if (!container) throw new Error("mountLatencyBadge: container is required");

  const bar = document.createElement("div");
  bar.className = "meta-bar";
  const status = document.createElement("span");
  status.className = "meta-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const degraded = document.createElement("span");
  degraded.className = "badge badge-warn";
  degraded.hidden = true;
  const cached = document.createElement("span");
  cached.className = "badge badge-soft";
  cached.hidden = true;
  const providers = document.createElement("span");
  providers.className = "badge badge-soft";
  providers.hidden = true;

  bar.append(status, degraded, cached, providers);
  container.appendChild(bar);

  let snapshot = null;

  const render = () => {
    if (!snapshot) {
      status.textContent = "";
      degraded.hidden = true;
      cached.hidden = true;
      providers.hidden = true;
      return;
    }
    if (snapshot.loading) {
      status.textContent = t("searchLabel") + "…";
      degraded.hidden = true;
      cached.hidden = true;
      providers.hidden = true;
      return;
    }

    const noun = snapshot.count === 1 ? t("result") : t("results");
    const seconds = formatSeconds(snapshot.took_ms);
    const pieces = [`${snapshot.count} ${noun}`];
    if (seconds) pieces.push(`${t("foundIn")} ${seconds}${snapshot.measured ? " (browser)" : ""}`);
    status.textContent = pieces.join(" · ");
    if (/[\u0C80-\u0CFF]/.test(snapshot.query || "")) status.setAttribute("lang", "kn");

    degraded.hidden = snapshot.degraded !== true;
    if (snapshot.degraded) {
      const failed = (snapshot.failed_providers || []).filter(Boolean).map(providerLabel);
      degraded.textContent = failed.length > 0 ? `${t("partial")} · ${failed.join(", ")}` : t("partial");
      degraded.title = failed.length > 0 ? `${failed.join(", ")} did not respond` : t("partial");
    }

    cached.hidden = snapshot.cache_hit !== true;
    cached.textContent = t("cached");

    const names = Object.keys(snapshot.providers || {}).filter((name) => Number(snapshot.providers[name]) > 0);
    providers.hidden = names.length === 0;
    if (names.length > 0) {
      providers.textContent = `${t("providers")}: ${names.slice(0, 3).map(providerLabel).join(" · ")}`;
    }
  };

  const api = {
    setLoading() {
      snapshot = { loading: true };
      render();
    },
    update(meta) {
      snapshot = { ...meta, loading: false };
      render();
    },
    reset() {
      snapshot = null;
      render();
    },
    element: bar,
  };

  onLangChange(render);
  render();
  return api;
}
