/*
 * EyeSearch UI — vanilla ES2020, no build step, no runtime dependencies.
 *
 * Contract with the gateway (GET /v1/search?q=&limit=&page=):
 *   { query, page, limit, total_estimate, took_ms, degraded, cache_hit,
 *     providers: {name: count}, results: [{id, title, url, snippet, source,
 *     kind, poster_url, thumbnail_url, published_at, score}] }
 * Failures arrive as { error: { code, message, retryable } }.
 */
(function () {
  "use strict";

  var DEFAULTS = { apiBase: "", limit: 10, debounce: 320, minChars: 2 };
  var rawConfig = window.EYESEARCH_CONFIG || {};
  var CONFIG = {
    apiBase: String(rawConfig.apiBase != null ? rawConfig.apiBase : DEFAULTS.apiBase).replace(/\/+$/, ""),
    limit: clampInt(rawConfig.limit, DEFAULTS.limit, 1, 50),
    debounce: clampInt(rawConfig.debounce, DEFAULTS.debounce, 0, 2000),
    minChars: clampInt(rawConfig.minChars, DEFAULTS.minChars, 1, 10)
  };

  var KANNADA = /[\u0C80-\u0CFF]/;
  var KIND_LABEL = {
    video: "Video",
    image: "Image",
    news: "News",
    film: "Film",
    document: "PDF",
    web: "",
    other: ""
  };
  var PROVIDER_LABEL = {
    duckduckgo: "DuckDuckGo",
    duckduckgo_html: "DuckDuckGo HTML",
    duckduckgo_lite: "DuckDuckGo Lite",
    bing: "Bing",
    turso_cache: "cache",
    cache: "cache",
    chain: "gateway"
  };
  var CODE_TEXT = {
    bad_request: "That query could not be understood.",
    rate_limited: "Too many searches right now.",
    provider_unavailable: "The search providers are not responding.",
    database_error: "The search index is unavailable.",
    not_found: "Nothing was found for that query.",
    internal: "Something went wrong on the gateway."
  };

  var el = {};
  var state = { query: "", controller: null, timer: 0, token: 0, lastQuery: "" };

  /* ------------------------------- helpers ------------------------------- */

  function clampInt(value, fallback, min, max) {
    var n = parseInt(value, 10);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function endpoint(query) {
    return (
      CONFIG.apiBase +
      "/v1/search?q=" +
      encodeURIComponent(query) +
      "&limit=" +
      encodeURIComponent(String(CONFIG.limit))
    );
  }

  function providerLabel(name) {
    var key = String(name || "");
    if (PROVIDER_LABEL[key]) return PROVIDER_LABEL[key];
    return key.replace(/_/g, " ");
  }

  function isKannada(text) {
    return KANNADA.test(text || "");
  }

  function seconds(tookMs) {
    var ms = Number(tookMs);
    if (!isFinite(ms) || ms < 0) return null;
    if (ms < 1000) return (ms / 1000).toFixed(2) + "s";
    return (ms / 1000).toFixed(1) + "s";
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (err) {
      return "";
    }
  }

  function breadcrumbFor(url) {
    var parts = [];
    var host = hostOf(url);
    if (host) parts.push({ text: host, leaf: false });
    try {
      var segments = new URL(url).pathname.split("/").filter(Boolean);
      var shown = segments.slice(0, 2);
      shown.forEach(function (segment, index) {
        var text = decodeURIComponent(segment)
          .replace(/\.(html?|php|aspx?|jsp|txt)$/i, "")
          .replace(/[-_]+/g, " ")
          .trim();
        if (!text) text = decodeURIComponent(segment);
        if (text.length > 34) text = text.slice(0, 33) + "…";
        parts.push({ text: text, leaf: index === shown.length - 1 });
      });
    } catch (err) {
      /* unparsable URL: host-only breadcrumb is enough */
    }
    return parts;
  }

  function highlightInto(target, text, terms) {
    target.textContent = "";
    var value = String(text == null ? "" : text);
    if (!terms.length) {
      target.appendChild(document.createTextNode(value));
      return;
    }
    var pattern = new RegExp("(" + terms.map(escapeRegExp).join("|") + ")", "gi");
    var cursor = 0;
    var match;
    while ((match = pattern.exec(value)) !== null) {
      if (match.index > cursor) {
        target.appendChild(document.createTextNode(value.slice(cursor, match.index)));
      }
      var mark = document.createElement("mark");
      mark.textContent = match[0];
      target.appendChild(mark);
      cursor = match.index + match[0].length;
      if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
    }
    if (cursor < value.length) {
      target.appendChild(document.createTextNode(value.slice(cursor)));
    }
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function searchTerms(query) {
    return String(query || "")
      .split(/\s+/)
      .filter(function (word) {
        return word.length > 1;
      })
      .slice(0, 6);
  }

  /* -------------------------------- view -------------------------------- */

  function setMode(mode) {
    var results = mode === "results";
    el.hero.classList.toggle("is-collapsed", results);
    el.hero.hidden = results;
    el.topbar.hidden = !results;
    el.resultsWrap.hidden = !results;
  }

  function setInputs(value) {
    if (el.qHero.value !== value) el.qHero.value = value;
    if (el.qCompact.value !== value) el.qCompact.value = value;
    toggleClearButtons();
  }

  function toggleClearButtons() {
    el.clearHero.hidden = el.qHero.value.length === 0;
    el.clearCompact.hidden = el.qCompact.value.length === 0;
  }

  function clearResults() {
    el.results.textContent = "";
    hideState();
    el.badgeDegraded.hidden = true;
    el.badgeCache.hidden = true;
    el.badgeProviders.hidden = true;
    el.retry.hidden = true;
    el.metaStatus.textContent = "";
  }

  function showSkeletons(count) {
    el.results.textContent = "";
    el.results.setAttribute("aria-busy", "true");
    hideState();
    el.retry.hidden = true;
    var template = el.tplSkeleton.content.firstElementChild;
    for (var i = 0; i < count; i += 1) {
      el.results.appendChild(template.cloneNode(true));
    }
  }

  function hideState() {
    el.state.hidden = true;
    el.state.textContent = "";
  }

  function renderState(options) {
    el.results.textContent = "";
    el.results.setAttribute("aria-busy", "false");
    el.state.hidden = false;
    el.state.textContent = "";

    if (options.icon) {
      var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "state-icon");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("aria-hidden", "true");
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", options.icon);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.6");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      icon.appendChild(path);
      el.state.appendChild(icon);
    }

    var title = document.createElement("p");
    title.className = "state-title";
    title.textContent = options.title || "";
    el.state.appendChild(title);

    if (options.text) {
      var text = document.createElement("p");
      text.className = "state-text";
      text.textContent = options.text;
      el.state.appendChild(text);
    }
    el.retry.hidden = !options.retry;
  }

  function renderMeta(payload, count) {
    var took = seconds(payload.took_ms);
    var pieces = [];
    pieces.push(count === 1 ? "1 result" : count + " results");
    if (took) pieces.push("found in " + took);
    el.metaStatus.textContent = pieces.join(" · ");
    el.metaStatus.setAttribute("lang", isKannada(payload.query) ? "kn" : "en");

    var failed = Array.isArray(payload.failed_providers) ? payload.failed_providers : [];
    var degraded = payload.degraded === true;
    if (degraded) {
      var names = failed.filter(Boolean);
      var labels = names.map(providerLabel);
      el.badgeDegraded.textContent =
        labels.length > 0
          ? "Partial results · " + labels.join(", ") + " unavailable"
          : "Partial results";
      el.badgeDegraded.title = labels.length
        ? "These providers failed: " + labels.join(", ")
        : "At least one provider failed for this query";
      el.badgeDegraded.hidden = false;
    } else {
      el.badgeDegraded.hidden = true;
    }

    el.badgeCache.hidden = payload.cache_hit !== true;

    var providers = payload.providers && typeof payload.providers === "object" ? payload.providers : {};
    var names2 = Object.keys(providers).filter(function (name) {
      return Number(providers[name]) > 0;
    });
    if (names2.length > 0) {
      el.badgeProviders.textContent = names2
        .slice(0, 3)
        .map(providerLabel)
        .join(" · ");
      el.badgeProviders.hidden = false;
    } else {
      el.badgeProviders.hidden = true;
    }
  }

  function buildCard(result, terms) {
    var node = el.tplCard.content.firstElementChild.cloneNode(true);
    var url = typeof result.url === "string" ? result.url : "";
    var host = hostOf(url);
    var title = result.title || url || "Untitled result";

    var media = node.querySelector(".card-media");
    var mediaImg = media.querySelector("img");
    var poster = result.thumbnail_url || result.poster_url;
    if (poster) {
      media.hidden = false;
      mediaImg.src = poster;
      mediaImg.alt = "";
      mediaImg.addEventListener("error", function () {
        media.hidden = true;
      });
    }

    var favicon = node.querySelector(".favicon");
    var faviconImg = favicon.querySelector("img");
    var fallback = favicon.querySelector(".favicon-fallback");
    if (host) {
      faviconImg.src = "https://icons.duckduckgo.com/ip3/" + host + ".ico";
      faviconImg.addEventListener("error", function () {
        if (!faviconImg.dataset.retried) {
          faviconImg.dataset.retried = "1";
          faviconImg.src = "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(host);
          return;
        }
        faviconImg.hidden = true;
        fallback.hidden = false;
        fallback.textContent = host.charAt(0);
      });
    } else {
      faviconImg.hidden = true;
      fallback.hidden = false;
      fallback.textContent = "?";
    }

    var crumb = node.querySelector(".breadcrumb");
    crumb.textContent = "";
    breadcrumbFor(url).forEach(function (part, index) {
      if (index > 0) {
        var sep = document.createElement("span");
        sep.className = "bc-sep";
        sep.textContent = "›";
        crumb.appendChild(sep);
      }
      var span = document.createElement("span");
      if (part.leaf) span.className = "bc-leaf";
      span.textContent = part.text;
      crumb.appendChild(span);
    });
    if (isKannada(title)) crumb.setAttribute("lang", "kn");

    var kind = node.querySelector(".kind");
    var label = KIND_LABEL[result.kind] || "";
    if (label) {
      kind.hidden = false;
      kind.textContent = label;
    }

    var link = node.querySelector(".card-title a");
    link.href = url || "#";
    link.textContent = title;
    if (isKannada(title)) link.setAttribute("lang", "kn");
    if (result.source) link.title = "Source: " + result.source;

    var snippet = node.querySelector(".card-snippet");
    highlightInto(snippet, result.snippet || "", terms);
    if (isKannada(result.snippet)) snippet.setAttribute("lang", "kn");
    if (!result.snippet) snippet.hidden = true;

    return node;
  }

  function renderPayload(payload, query, token) {
    if (token !== state.token) return;
    var results = Array.isArray(payload.results) ? payload.results : [];
    var terms = searchTerms(query);

    el.results.textContent = "";
    el.results.setAttribute("aria-busy", "false");
    renderMeta(payload, results.length);

    if (results.length === 0) {
      var failed = Array.isArray(payload.failed_providers) ? payload.failed_providers : [];
      renderState({
        icon: "M4 7h16M4 12h10M4 17h7",
        title: "No results for “" + query + "”",
        text:
          failed.length > 0
            ? "The providers that answered had nothing for this query (" +
              failed.map(providerLabel).join(", ") +
              " did not respond). Try different words, or search again in a moment."
            : "Try different words, a shorter query, or check the spelling.",
        retry: true
      });
      return;
    }

    hideState();
    var fragment = document.createDocumentFragment();
    results.forEach(function (result) {
      fragment.appendChild(buildCard(result, terms));
    });
    el.results.appendChild(fragment);
  }

  function renderError(message, detail, retry) {
    el.results.setAttribute("aria-busy", "false");
    el.metaStatus.textContent = "";
    el.badgeDegraded.hidden = true;
    el.badgeCache.hidden = true;
    el.badgeProviders.hidden = true;
    renderState({
      icon: "M12 8v5M12 16.5v.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
      title: message,
      text: detail,
      retry: retry
    });
  }

  /* -------------------------------- logic ------------------------------- */

  function syncUrl(query, push) {
    var target = query ? "?q=" + encodeURIComponent(query) : location.pathname;
    try {
      if (push) history.pushState({ q: query }, "", target);
      else history.replaceState({ q: query }, "", target);
    } catch (err) {
      /* file:// or sandboxed contexts: URL sync is optional */
    }
  }

  function cancelPending() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = 0;
    }
    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }
  }

  function startSearch(query, options) {
    var settings = options || {};
    var cleaned = String(query || "").replace(/\s+/g, " ").trim();
    cancelPending();
    state.query = cleaned;
    state.lastQuery = cleaned;

    if (!cleaned) {
      setMode("hero");
      clearResults();
      syncUrl("", Boolean(settings.push));
      return;
    }

    setInputs(cleaned);
    setMode("results");
    if (settings.push !== false) syncUrl(cleaned, Boolean(settings.push));

    state.token += 1;
    var token = state.token;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    state.controller = controller;

    showSkeletons(Math.min(5, CONFIG.limit));
    el.metaStatus.textContent = "Searching…";
    el.badgeDegraded.hidden = true;
    el.badgeCache.hidden = true;
    el.badgeProviders.hidden = true;

    var started = Date.now();
    fetch(endpoint(cleaned), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            return { response: response, body: body };
          });
      })
      .then(function (outcome) {
        if (token !== state.token) return;
        var response = outcome.response;
        var body = outcome.body || {};
        if (!response.ok) {
          var errorCode = body && body.error ? body.error.code : "";
          var errorMessage = body && body.error ? body.error.message : "";
          var friendly = CODE_TEXT[errorCode] || "The search could not be completed.";
          var retryable = body && body.error ? body.error.retryable !== false : true;
          renderError(
            friendly,
            errorMessage || "HTTP " + response.status + " from the search gateway.",
            retryable
          );
          return;
        }
        if (body && body.error) {
          renderError(CODE_TEXT[body.error.code] || "The search could not be completed.", body.error.message || "", true);
          return;
        }
        renderPayload(body, cleaned, token);
      })
      .catch(function (error) {
        if (error && error.name === "AbortError") return;
        if (token !== state.token) return;
        renderError(
          "Can't reach the search gateway",
          "Check your connection and try again. If you are offline, results will not load. (" +
            (Date.now() - started) +
            " ms)",
          true
        );
      })
      .finally(function () {
        if (token === state.token) el.results.setAttribute("aria-busy", "false");
      });
  }

  function scheduleSearch(query) {
    if (state.timer) clearTimeout(state.timer);
    var cleaned = String(query || "").trim();
    if (cleaned.length < CONFIG.minChars) {
      cancelPending();
      if (cleaned.length === 0) {
        state.token += 1;
        setMode("hero");
        clearResults();
        syncUrl("", false);
      }
      return;
    }
    state.timer = setTimeout(function () {
      state.timer = 0;
      startSearch(cleaned, { push: false });
    }, CONFIG.debounce);
  }

  function bindForm(form, input) {
    if (!form || !input) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      startSearch(input.value, { push: true });
    });
    input.addEventListener("input", function () {
      setInputs(input.value);
      scheduleSearch(input.value);
    });
    input.addEventListener("search", function () {
      startSearch(input.value, { push: true });
    });
  }

  function bindClear(button, input) {
    if (!button) return;
    button.addEventListener("click", function () {
      cancelPending();
      state.token += 1;
      setInputs("");
      setMode("hero");
      clearResults();
      syncUrl("", false);
      input.focus();
    });
  }

  function init() {
    el.hero = document.getElementById("hero");
    el.topbar = document.getElementById("topbar");
    el.resultsWrap = document.getElementById("results-wrap");
    el.results = document.getElementById("results");
    el.metaStatus = document.getElementById("meta-status");
    el.badgeDegraded = document.getElementById("badge-degraded");
    el.badgeCache = document.getElementById("badge-cache");
    el.badgeProviders = document.getElementById("badge-providers");
    el.state = document.getElementById("state");
    el.retry = document.getElementById("btn-retry");
    el.tplCard = document.getElementById("tpl-card");
    el.tplSkeleton = document.getElementById("tpl-skeleton");
    el.chips = document.getElementById("chips");
    el.qHero = document.getElementById("q");
    el.qCompact = document.getElementById("q-compact");
    el.clearHero = document.querySelector('[data-clear="hero"]');
    el.clearCompact = document.querySelector('[data-clear="compact"]');

    bindForm(document.getElementById("search-form"), el.qHero);
    bindForm(document.getElementById("search-form-compact"), el.qCompact);
    bindClear(el.clearHero, el.qHero);
    bindClear(el.clearCompact, el.qCompact);

    if (el.retry) {
      el.retry.addEventListener("click", function () {
        startSearch(state.lastQuery, { push: false });
      });
    }

    if (el.chips) {
      el.chips.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-suggestion]");
        if (!button) return;
        startSearch(button.getAttribute("data-suggestion"), { push: true });
        if (el.qCompact && el.topbar && !el.topbar.hidden) el.qCompact.focus();
      });
    }

    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        (el.topbar.hidden ? el.qHero : el.qCompact).focus();
      } else if (event.key === "Escape" && typing) {
        cancelPending();
        state.token += 1;
        setInputs("");
        setMode("hero");
        clearResults();
        syncUrl("", false);
        target.blur();
      }
    });

    window.addEventListener("popstate", function (event) {
      var query = (event.state && event.state.q) || new URLSearchParams(location.search).get("q") || "";
      if (query) startSearch(query, { push: false });
      else {
        cancelPending();
        state.token += 1;
        setInputs("");
        setMode("hero");
        clearResults();
      }
    });

    setMode("hero");
    toggleClearButtons();

    var initial = new URLSearchParams(location.search).get("q");
    if (initial && initial.trim()) {
      startSearch(initial, { push: false });
    } else if (el.qHero) {
      el.qHero.focus({ preventScroll: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed for tests and for embedding the UI inside another page.
  window.EyeSearchUI = {
    search: function (query) {
      startSearch(query, { push: true });
    },
    config: CONFIG
  };
})();
