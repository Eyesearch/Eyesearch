/**
 * Composition root. This file owns application state and wires the four modules
 * together; every module below is independent and only talks through the small
 * callbacks declared here.
 *
 *   home/search-input      → onSearch(query)   (Enter or the search button only)
 *   home/media-tools       → onTranscript(text) / onImage(file), inside the bar
 *   home/quick-links       → navigation only
 *   home/feed-cards        → weather (Open-Meteo) + headlines (our own gateway)
 *   menu/theme-selector    → one toggle button, system default
 *   profile/*              → auth placeholder + local search history
 *   results/*              → tabs, cards, latency/provider badges
 */

import { searchWeb, retrieveContext, errorTextFor, ApiError } from "./config/api-config.js";
import { mountSearchInput } from "./home/search-input/search-input.js";
import { mountMicButton } from "./home/media-tools/mic-handler.js";
import { mountLensButton } from "./home/media-tools/lens-handler.js";
import { mountQuickLinks } from "./home/quick-links/quick-links.js";
import { mountWeatherCard } from "./home/feed-cards/weather-card.js";
import { mountNewsCard } from "./home/feed-cards/news-card.js";
import { mountThemeToggle } from "./menu/theme-selector/theme-toggle.js";
import { t, getLang } from "./menu/language-selector/lang-switcher.js";
import { mountAuthPlaceholder } from "./profile/account/auth-placeholder.js";
import { addHistory } from "./profile/local-history/history-manager.js";
import { mountClearHistory } from "./profile/local-history/clear-history.js";
import { mountTabSwitcher } from "./results/nav-tabs/tab-switcher.js";
import { createWebCard } from "./results/result-cards/web-card.js";
import { mountLatencyBadge } from "./results/meta-info/latency-badge.js";

const mount = (name) => document.querySelector(`[data-mount="${name}"]`);

const state = {
  query: "",
  tab: "all",
  controller: null,
  token: 0,
  lastPayload: null,
};

const els = {
  home: document.getElementById("home-section"),
  results: document.getElementById("results-region"),
  cards: document.getElementById("result-cards"),
  notice: document.getElementById("app-notice"),
  profilePanel: document.getElementById("profile-panel"),
  profileToggle: document.querySelector('[data-action="toggle-profile"]'),
  backButton: document.querySelector('button[data-action="go-home"]'),
  brand: document.querySelector('a[data-action="go-home"]'),
};

/* ------------------------------ small helpers ----------------------------- */

function applyStaticText() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  document.documentElement.lang = getLang();
}

function showNotice(message, { ok = false } = {}) {
  if (!els.notice) return;
  els.notice.textContent = message;
  els.notice.classList.toggle("notice-ok", ok);
  els.notice.hidden = !message;
}

function setView(view) {
  const results = view === "results";
  if (els.home) els.home.hidden = results;
  if (els.results) els.results.hidden = !results;
  if (els.backButton) els.backButton.hidden = !results;
}

function setBusy(busy) {
  if (els.cards) els.cards.setAttribute("aria-busy", busy ? "true" : "false");
}

function renderSkeletons(count = 4) {
  if (!els.cards) return;
  els.cards.textContent = "";
  for (let index = 0; index < count; index += 1) {
    const row = document.createElement("div");
    row.className = "card card-skeleton";
    row.setAttribute("aria-hidden", "true");
    const lineA = document.createElement("div");
    lineA.className = "skeleton";
    lineA.style.height = "14px";
    lineA.style.width = "62%";
    const lineB = document.createElement("div");
    lineB.className = "skeleton";
    lineB.style.height = "11px";
    lineB.style.marginTop = "10px";
    const lineC = document.createElement("div");
    lineC.className = "skeleton";
    lineC.style.height = "11px";
    lineC.style.marginTop = "6px";
    lineC.style.width = "84%";
    row.append(lineA, lineB, lineC);
    els.cards.appendChild(row);
  }
}

function renderEmpty(title, text) {
  if (!els.cards) return;
  els.cards.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "empty-state";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = text;
  wrap.append(heading, body);
  els.cards.appendChild(wrap);
}

function renderError(error) {
  if (!els.cards) return;
  els.cards.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "error-state";
  const heading = document.createElement("h3");
  heading.textContent = error instanceof ApiError ? errorTextFor(error.code) : t("errorTitle");
  const body = document.createElement("p");
  body.textContent = error && error.message ? error.message : t("errorBody");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "retry-button";
  retry.textContent = t("retry");
  retry.addEventListener("click", () => runSearch(state.query));
  wrap.append(heading, body, retry);
  els.cards.appendChild(wrap);
  latency.reset();
}

function terms(query) {
  return query
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 6);
}

function syncUrl(query, push) {
  const target = query ? `?q=${encodeURIComponent(query)}` : location.pathname;
  try {
    if (push) history.pushState({ q: query }, "", target);
    else history.replaceState({ q: query }, "", target);
  } catch (error) {
    /* file:// or sandboxed contexts: URL sync is optional */
  }
}

/* --------------------------------- results -------------------------------- */

async function runSearch(query, { tab = state.tab } = {}) {
  const cleaned = String(query || "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    goHome();
    return;
  }

  state.query = cleaned;
  state.tab = tab;
  state.token += 1;
  const token = state.token;

  if (state.controller) state.controller.abort();
  const controller = new AbortController();
  state.controller = controller;

  setView("results");
  syncUrl(cleaned, true);
  showNotice("");
  renderSkeletons();
  setBusy(true);
  latency.setLoading();

  const started = performance.now();
  try {
    const payload =
      tab === "ai"
        ? await retrieveContext(cleaned, { signal: controller.signal })
        : await searchWeb(cleaned, { signal: controller.signal });
    if (token !== state.token) return;

    state.lastPayload = payload;
    renderPayload(payload, cleaned, tab, started);
  } catch (error) {
    if (error && (error.name === "AbortError" || error.name === "TimeoutError")) return;
    if (token !== state.token) return;
    renderError(error);
  } finally {
    if (token === state.token) setBusy(false);
  }
}

function renderPayload(payload, query, tab, started) {
  const results = payload.results || [];
  latency.update({
    took_ms: payload.took_ms != null ? payload.took_ms : Math.round(performance.now() - started),
    count: results.length,
    degraded: payload.degraded === true,
    cache_hit: payload.cache_hit === true,
    providers: payload.providers || {},
    failed_providers: payload.failed_providers || [],
    measured: payload.took_ms == null,
    query,
    tab,
  });

  if (results.length === 0) {
    renderEmpty(t("noResultsTitle"), t("noResultsBody"));
    return;
  }

  els.cards.textContent = "";
  const fragment = document.createDocumentFragment();
  results.forEach((result) => {
    fragment.appendChild(createWebCard(result, { terms: terms(query), compact: tab === "ai" }));
  });
  els.cards.appendChild(fragment);

  if (payload.degraded) showNotice(t("degradedNotice"));
}

/** Reset to the home hero: clear results, the URL and the in-flight request. */
function goHome({ focus = true } = {}) {
  state.token += 1;
  if (state.controller) {
    state.controller.abort();
    state.controller = null;
  }
  state.query = "";
  state.lastPayload = null;
  if (els.cards) els.cards.textContent = "";
  latency.reset();
  showNotice("");
  setView("home");
  syncUrl("", false);
  if (els.profilePanel && !els.profilePanel.hidden) {
    els.profilePanel.hidden = true;
    els.profileToggle?.setAttribute("aria-expanded", "false");
  }
  if (focus && searchInput) searchInput.focus();
}

/* --------------------------------- mounting -------------------------------- */

const searchInput = mountSearchInput(mount("search-input"), {
  onSearch: (query) => {
    addHistory(query);
    runSearch(query);
  },
  onClear: () => goHome({ focus: false }),
});

const latency = mountLatencyBadge(mount("meta-info"));

const tabs = mountTabSwitcher(mount("nav-tabs"), {
  onChange: (tab) => {
    if (state.query) runSearch(state.query, { tab });
    else state.tab = tab;
  },
});

mountMicButton(searchInput.actions, {
  onTranscript: (text) => {
    searchInput.setValue(text);
    addHistory(text);
    runSearch(text);
  },
  onError: (message) => showNotice(message),
});

mountLensButton(searchInput.actions, {
  onImage: (file) => {
    // The gateway has no vision endpoint yet, so say so instead of pretending.
    showNotice(t("lensNotice").replace("{name}", file && file.name ? file.name : "image"));
  },
  onError: (message) => showNotice(message),
});

mountQuickLinks(mount("quick-links"), {});

const feed = document.createElement("div");
feed.className = "feed-grid";
const weatherMount = document.createElement("div");
const newsMount = document.createElement("div");
feed.append(weatherMount, newsMount);
mount("feed-cards").appendChild(feed);

mountWeatherCard(weatherMount, {});
mountNewsCard(newsMount, {
  onOpen: (query) => {
    searchInput.setValue(query);
    addHistory(query);
    runSearch(query);
  },
});

mountThemeToggle(mount("menu"));

mountAuthPlaceholder(mount("account"));
mountClearHistory(mount("history"), {
  onPick: (query) => {
    searchInput.setValue(query);
    addHistory(query);
    runSearch(query);
  },
  onCleared: () => {
    if (els.profilePanel) els.profilePanel.hidden = true;
    els.profileToggle?.setAttribute("aria-expanded", "false");
  },
});

/* ------------------------------ navigation --------------------------------- */

els.backButton?.addEventListener("click", () => goHome());

els.brand?.addEventListener("click", (event) => {
  event.preventDefault();
  goHome();
});

els.profileToggle?.addEventListener("click", () => {
  const open = els.profilePanel.hidden;
  els.profilePanel.hidden = !open;
  els.profileToggle.setAttribute("aria-expanded", String(open));
});

document.addEventListener("click", (event) => {
  if (!els.profilePanel || els.profilePanel.hidden) return;
  const inside = els.profilePanel.contains(event.target) || els.profileToggle?.contains(event.target);
  if (!inside) {
    els.profilePanel.hidden = true;
    els.profileToggle?.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("popstate", (event) => {
  const query = (event.state && event.state.q) || new URLSearchParams(location.search).get("q") || "";
  if (query) {
    searchInput.setValue(query);
    runSearch(query);
  } else {
    goHome({ focus: false });
  }
});

/* ----------------------------- service worker ------------------------------ */

// Progressive enhancement: the app works without it, but with it the shell and
// every module load offline and repeat visits skip the network for static code.
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("eyesearch: service worker registration failed", error);
    });
  });
}

/* ----------------------------------- boot ---------------------------------- */

applyStaticText();
setView("home");

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery && initialQuery.trim()) {
  searchInput.setValue(initialQuery);
  runSearch(initialQuery);
}

// Exposed for tests and for embedding the page elsewhere.
window.EyeSearchApp = {
  search: (query, options) => runSearch(query, options),
  home: () => goHome(),
  getState: () => ({ ...state, controller: undefined }),
};
