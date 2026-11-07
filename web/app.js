/**
 * Composition root. Owns application state and wires the modules together; each
 * module is independent and talks back only through the callbacks declared here.
 *
 *   home/search-input      → onSearch(query)   (Enter or the search button only)
 *   home/media-tools       → onTranscript(text) / onImage(file), inside the bar
 *   home/quick-links       → navigation only
 *   home/feed-cards        → weather (Open-Meteo) + headlines (our own gateway)
 *   menu/theme-selector    → one toggle button, system default
 *   profile/*              → account placeholder, popover summary, history screen
 *   results/*              → tabs, cards, and the AI Mode chat panel
 *
 * Three views: home hero, results (own search bar + tabs + cards), history.
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
import { mountHistoryView } from "./profile/local-history/history-view.js";
import { mountTabSwitcher } from "./results/nav-tabs/tab-switcher.js";
import {
  createKnowledgeHero,
  createWebCard,
  equaliseCardHeights,
  pickKnowledgeCard,
} from "./results/result-cards/web-card.js";
import { mountChatPanel } from "./results/ai-chat/chat-panel.js";
import { fetchAuxiliaryResults, dedupeAuxResults } from "./results/client-federation/aux-fetch.js";

const mount = (name) => document.querySelector(`[data-mount="${name}"]`);

const state = {
  query: "",
  tab: "all",
  controller: null,
  token: 0,
  lastPayload: null,
  view: "home",
};

const els = {
  home: document.getElementById("home-section"),
  results: document.getElementById("results-region"),
  history: document.getElementById("history-view"),
  cards: document.getElementById("result-cards"),
  notice: document.getElementById("app-notice"),
  profilePanel: document.getElementById("profile-panel"),
  profileToggle: document.querySelector('[data-action="toggle-profile"]'),
  backButton: document.querySelector('.app-bar button[data-action="go-home"]'),
  closeHistory: document.querySelector('[data-action="close-history"]'),
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

/** @param {"home"|"results"|"history"} view */
function setView(view) {
  state.view = view;
  if (els.home) els.home.hidden = view !== "home";
  if (els.results) els.results.hidden = view !== "results";
  if (els.history) els.history.hidden = view !== "history";
  if (els.backButton) els.backButton.hidden = view !== "results";
}

function setBusy(busy) {
  if (els.cards) els.cards.setAttribute("aria-busy", busy ? "true" : "false");
}

function closeProfilePanel() {
  if (!els.profilePanel || els.profilePanel.hidden) return;
  els.profilePanel.hidden = true;
  els.profileToggle?.setAttribute("aria-expanded", "false");
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

/** Keep the home bar and the results bar showing the same query. */
function setInputs(value) {
  homeInput.setValue(value);
  resultsInput.setValue(value);
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

  setInputs(cleaned);
  setView("results");
  closeProfilePanel();
  syncUrl(cleaned, true);
  showNotice("");
  renderSkeletons();
  setBusy(true);
  latency.setLoading();
  addHistory(cleaned);

  const started = performance.now();

  if (tab === "ai") {
    // AI Mode: a conversational answer, streamed, seeded with this query.
    setBusy(false);
    if (els.cards) els.cards.textContent = "";
    document.body.dataset.tab = "ai";
    chatPanel.ask(cleaned);
    return;
  }
  document.body.dataset.tab = "all";
  chatPanel.clear();

  // Client-side federation: the auxiliary providers are asked from this browser
  // at the same moment as the gateway, on the reader's own connection — the
  // gateway's datacenter address is what those providers rate-limit. The promise
  // is not awaited here on purpose: the gateway's answer renders first and the
  // auxiliary cards are appended when (if) they arrive. It resolves with [] for
  // every failure, so there is nothing to catch.
  const auxiliary = fetchAuxiliaryResults(cleaned, { signal: controller.signal });

  try {
    const payload = await searchWeb(cleaned, { signal: controller.signal });
    if (token !== state.token) return;

    state.lastPayload = payload;
    renderPayload(payload, cleaned, tab, started);
    attachAuxiliary(auxiliary, token, payload, cleaned);
  } catch (error) {
    if (token !== state.token) return;
    if (error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      // The skeleton cards are already on screen. Returning here used to leave
      // them there for ever, which is what "loading indefinitely" looked like.
      renderError(new ApiError("The search timed out.", { code: "timeout" }));
      return;
    }
    renderError(error);
  } finally {
    // Always, whichever way the request ended: the busy flag and the latency
    // readout must not outlive the attempt that set them.
    if (token === state.token) {
      setBusy(false);
      latency.reset();
    }
  }
}

function renderPayload(payload, query, tab) {
  const results = payload.results || [];
  if (results.length === 0) {
    renderEmpty(t("noResultsFor").replace("{{query}}", query), t("noResultsBody"));
    return;
  }

  els.cards.textContent = "";
  const fragment = document.createDocumentFragment();

  // One knowledge card, above the list. It is not part of `results`: those are
  // pages we crawled, and an external answer mixed into that list would look
  // like one of them.
  //
  // One, not a row: the secondary cards used to sit under it as a carousel, and
  // they competed with the results for attention while saying less than any of
  // them. The card that answers the query is the card worth showing.
  const knowledgeCard = pickKnowledgeCard(payload.primary_card, payload.knowledge_cards, query);
  const hero = createKnowledgeHero(knowledgeCard, {
    moreLabel: t("more"),
    lessLabel: t("showLess"),
  });
  if (hero) fragment.appendChild(hero);

  results.forEach((result) => {
    fragment.appendChild(createWebCard(result, { terms: terms(query), compact: tab === "ai" }));
  });
  els.cards.appendChild(fragment);

  // Give every card the height of the tallest one in this set. Content differs
  // — a brand line here, a two-line snippet there — and letting each card size
  // itself makes the column stair-step, which reads as broken rather than tidy.
  equaliseCardHeights(els.cards);

  if (payload.degraded) showNotice(t("degradedNotice"));

  // Re-equalise when the window changes size: the cards are laid out again, and
  // a floor measured at the old width is wrong at the new one. Crossing the
  // mobile breakpoint removes it entirely.
  window.addEventListener("resize", () => {
    if (state.resizeTimer) clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(() => equaliseCardHeights(els.cards), 120);
  });
}

/* --------------------------- client-side federation ------------------------ */

/**
 * Append the auxiliary cards once they land.
 *
 * The gateway's results are already on screen by the time this runs, and that
 * is the whole point of the split: this call can take 2 seconds, time out, or
 * fail entirely and the reader never sees anything but their own results.
 *
 * Everything is guarded, because a slower search can be replaced by a faster
 * one: a stale token means the reader has moved on and these cards belong to a
 * query nobody is looking at any more.
 */
function attachAuxiliary(promise, token, payload, query) {
  promise
    .then((items) => {
      // Only the token is checked, not the view: the history screen hides the
      // card list without clearing it, so cards appended while the reader is
      // there are still the right cards when they come back. Going home clears
      // the list and bumps the token, which is the case that matters.
      if (token !== state.token) return;
      const primaryUrls = (payload.results || []).map((result) => result && result.url);
      const cards = dedupeAuxResults(items, primaryUrls);
      if (cards.length === 0) return;
      appendAuxiliaryCards(cards, query);
    })
    .catch(() => {
      /* fail silently: an auxiliary card is a bonus, never a dependency */
    });
}

/**
 * Draw auxiliary cards with the same renderer, and the same card, as everything
 * else. They carry `federated: true`, so the renderer adds the attribution line
 * that says whose words these are — the only difference a reader should see.
 */
function appendAuxiliaryCards(cards, query) {
  if (!els.cards) return;

  // The gateway found nothing and the empty state is showing. Real cards below
  // "no results" would read as a bug, so the empty state gives way.
  const empty = els.cards.querySelector(".empty-state");
  if (empty) empty.remove();

  const fragment = document.createDocumentFragment();
  cards.forEach((card) => {
    fragment.appendChild(createWebCard(card, { terms: terms(query), compact: state.tab === "ai" }));
  });
  els.cards.appendChild(fragment);

  // The new cards are part of the column now, so the shared height is measured
  // again — a federated card is taller, and a ragged list is what that floor is
  // there to prevent.
  equaliseCardHeights(els.cards);
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
  closeProfilePanel();
  if (focus) homeInput.focus();
}

/* --------------------------------- history -------------------------------- */

function openHistory() {
  closeProfilePanel();
  setView("history");
  historyView.refresh();
}

function closeHistory() {
  setView(state.query ? "results" : "home");
}

/* --------------------------------- mounting -------------------------------- */

const homeInput = mountSearchInput(mount("search-input"), {
  id: "search-input",
  onSearch: (query) => runSearch(query),
  onClear: () => goHome({ focus: false }),
});

const resultsInput = mountSearchInput(mount("results-search"), {
  id: "results-search-input",
  compact: true,
  onSearch: (query) => runSearch(query),
  onClear: () => {
    resultsInput.clear();
    homeInput.clear();
    goHome({ focus: false });
  },
});

// Voice and camera sit inside both bars.
mountMicButton(homeInput.actions, {
  onTranscript: (text) => runSearch(text),
  onError: (message) => showNotice(message),
});
mountLensButton(homeInput.actions, {
  onImage: (file) => showNotice(t("lensNotice").replace("{name}", file && file.name ? file.name : "image")),
  onError: (message) => showNotice(message),
});
mountMicButton(resultsInput.actions, {
  onTranscript: (text) => runSearch(text),
  onError: (message) => showNotice(message),
});
mountLensButton(resultsInput.actions, {
  onImage: (file) => showNotice(t("lensNotice").replace("{name}", file && file.name ? file.name : "image")),
  onError: (message) => showNotice(message),
});

// The timing line and source-attribution badges were removed from the UI; the
// no-op shim keeps the surrounding flow untouched.
const latency = { update() {}, reset() {}, setLoading() {} };

const tabs = mountTabSwitcher(mount("nav-tabs"), {
  onChange: (tab) => {
    if (state.query) runSearch(state.query, { tab });
    else state.tab = tab;
  },
});

const chatPanel = mountChatPanel(mount("ai-chat"), {});

const historyView = mountHistoryView(mount("history-full"), {
  onPick: (query) => {
    runSearch(query);
  },
});

mountQuickLinks(mount("quick-links"), {});

const feed = document.createElement("div");
feed.className = "feed-grid";
const weatherMount = document.createElement("div");
const newsMount = document.createElement("div");
feed.append(weatherMount, newsMount);
mount("feed-cards").appendChild(feed);

mountWeatherCard(weatherMount, {});
mountNewsCard(newsMount, { onOpen: (query) => runSearch(query) });

mountThemeToggle(mount("menu"));

mountAuthPlaceholder(mount("account"));
mountClearHistory(mount("history"), {
  onOpenHistory: () => openHistory(),
  onPick: (query) => runSearch(query),
  onCleared: () => closeProfilePanel(),
});

/* ------------------------------ navigation --------------------------------- */

els.backButton?.addEventListener("click", () => goHome());
els.closeHistory?.addEventListener("click", () => closeHistory());
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
  if (!inside) closeProfilePanel();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.view === "history") closeHistory();
});

window.addEventListener("popstate", (event) => {
  const query = (event.state && event.state.q) || new URLSearchParams(location.search).get("q") || "";
  if (query) runSearch(query);
  else goHome({ focus: false });
});

/* ----------------------------- service worker ------------------------------ */

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    // The query string is the point: a different URL is a different worker, so the
    // browser fetches this one instead of keeping the cached script that pinned
    // the old gateway. Bump it with CACHE_NAME in sw.js.
    navigator.serviceWorker.register("./sw.js?v=6").catch((error) => {
      console.warn("eyesearch: service worker registration failed", error);
    });
  });
}

/* ----------------------------------- boot ---------------------------------- */

applyStaticText();
setView("home");

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery && initialQuery.trim()) {
  runSearch(initialQuery);
}

// Exposed for tests and for embedding the page elsewhere.
window.EyeSearchApp = {
  search: (query, options) => runSearch(query, options),
  home: () => goHome(),
  openHistory: () => openHistory(),
  closeHistory: () => closeHistory(),
  getState: () => ({ ...state, controller: undefined }),
};
