/**
 * home/feed-cards — live headlines.
 *
 * There is no news API in the stack, so this card asks our own gateway for
 * "top headlines India" and renders the first few results as links. That keeps
 * the card genuinely live and exercises the same retrieval path the search page
 * uses, with the same degraded handling.
 */

import { searchWeb } from "../../config/api-config.js";
import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

const HEADLINE_QUERY = { en: "top news headlines India today", kn: "ಇಂದಿನ ಪ್ರಮುಖ ಸುದ್ದಿ ಭಾರತ" };

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

/**
 * @param {HTMLElement} container
 * @param {{onOpen?: (query: string) => void, limit?: number}} options
 */
export function mountNewsCard(container, options = {}) {
  if (!container) throw new Error("mountNewsCard: container is required");
  const limit = Number.isFinite(options.limit) ? options.limit : 4;

  const card = document.createElement("article");
  card.className = "feed-card news-card";
  const heading = document.createElement("h2");
  heading.className = "section-title";
  const list = document.createElement("ul");
  list.className = "news-list";
  const footer = document.createElement("button");
  footer.type = "button";
  footer.className = "feed-action";
  card.append(heading, list, footer);
  container.appendChild(card);

  let items = null;
  let failed = false;

  const render = () => {
    const lang = document.documentElement.lang || "en";
    heading.textContent = t("news");
    footer.textContent = t("seeMore");

    list.textContent = "";
    if (failed) {
      const item = document.createElement("li");
      item.className = "feed-muted";
      item.textContent = t("newsUnavailable");
      list.appendChild(item);
      return;
    }
    if (!items) {
      for (let index = 0; index < 3; index += 1) {
        const item = document.createElement("li");
        const bar = document.createElement("div");
        bar.className = "skeleton";
        bar.style.height = "12px";
        item.appendChild(bar);
        list.appendChild(item);
      }
      return;
    }
    items.forEach((result) => {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = result.title;
      if (lang === "kn" && /[\u0C80-\u0CFF]/.test(result.title || "")) anchor.setAttribute("lang", "kn");
      const host = document.createElement("span");
      host.className = "news-host";
      host.textContent = hostOf(result.url);
      item.append(anchor, host);
      list.appendChild(item);
    });
  };

  async function load() {
    failed = false;
    items = null;
    render();
    const lang = document.documentElement.lang === "kn" ? "kn" : "en";
    try {
      const payload = await searchWeb(HEADLINE_QUERY[lang], { limit });
      items = (payload.results || []).slice(0, limit);
      if (items.length === 0) failed = true;
    } catch (error) {
      failed = true;
    }
    render();
  }

  footer.addEventListener("click", () => {
    const lang = document.documentElement.lang === "kn" ? "kn" : "en";
    if (typeof options.onOpen === "function") options.onOpen(HEADLINE_QUERY[lang]);
  });

  render();
  load();
  onLangChange(() => {
    render();
    load();
  });

  return { refresh: load, element: card };
}
