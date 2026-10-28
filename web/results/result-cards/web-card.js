/**
 * results/result-cards — one structured result card.
 *
 * Everything here is built with DOM nodes and textContent: server strings are
 * never parsed as HTML, so a hostile result title cannot inject markup.
 *
 * Query terms are deliberately not highlighted: the card shows clean text, and
 * a "More" link appears only when the snippet is actually clamped.
 */

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function breadcrumbParts(url) {
  const parts = [];
  const host = hostOf(url);
  if (host) parts.push({ text: host, leaf: false });
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean).slice(0, 2);
    segments.forEach((segment, index) => {
      let text = decodeURIComponent(segment)
        .replace(/\.(html?|php|aspx?|jsp|txt)$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();
      if (!text) text = decodeURIComponent(segment);
      if (text.length > 34) text = `${text.slice(0, 33)}…`;
      parts.push({ text, leaf: index === segments.length - 1 });
    });
  } catch (error) {
    /* unparsable URL: host-only breadcrumb is enough */
  }
  return parts;
}

/**
 * A card title should read like a page title, not a domain. When the backend
 * only had the hostname (a portal that refused the crawler), humanise the label
 * rather than echoing "karnataka.gov.in" back at the reader.
 */
function titleFor(result, host, fallbackUrl) {
  const raw = String(result.title || "").trim();
  const bare = host.replace(/^www\./, "");
  const looksLikeHost =
    !raw || raw.toLowerCase() === bare.toLowerCase() || raw.toLowerCase() === host.toLowerCase();
  if (!looksLikeHost) return raw;

  const label = (bare.split(".")[0] || "").replace(/[-_]+/g, " ").trim();
  if (!label) return raw || fallbackUrl || "Untitled result";
  if (label.length <= 4) return label.toUpperCase();
  return label.replace(/\b\w/g, (character) => character.toUpperCase());
}

const VERIFIED_SUFFIXES = [".gov.in", ".nic.in", ".ac.in"];

function isVerifiedDomain(host) {
  const value = String(host || "").toLowerCase();
  return VERIFIED_SUFFIXES.some((suffix) => value.endsWith(suffix));
}

const KIND_LABEL = { video: "Video", image: "Image", news: "News", film: "Film", document: "PDF" };

/**
 * @param {object} result one entry from /v1/search results[]
 * @param {{terms?: string[], compact?: boolean}} options
 * @returns {HTMLElement}
 */
export function createWebCard(result, options = {}) {
  const item = document.createElement("article");
  item.className = "card";
  if (options.compact) item.classList.add("card-compact");

  const url = typeof result.url === "string" ? result.url : "";
  const host = hostOf(url);
  const title = titleFor(result, host, url);

  const poster = result.thumbnail_url || result.poster_url;
  if (poster) {
    const media = document.createElement("div");
    media.className = "card-media";
    const image = document.createElement("img");
    image.src = poster;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => media.remove());
    media.appendChild(image);
    item.appendChild(media);
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const top = document.createElement("div");
  top.className = "card-top";

  const favicon = document.createElement("span");
  favicon.className = "card-favicon";
  if (host) {
    const icon = document.createElement("img");
    icon.src = `https://icons.duckduckgo.com/ip3/${host}.ico`;
    icon.alt = "";
    icon.width = 16;
    icon.height = 16;
    icon.loading = "lazy";
    icon.addEventListener("error", () => {
      if (!icon.dataset.retried) {
        icon.dataset.retried = "1";
        icon.src = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
        return;
      }
      const tile = document.createElement("span");
      tile.className = "card-favicon-tile";
      tile.textContent = host.charAt(0);
      icon.replaceWith(tile);
    });
    favicon.appendChild(icon);
  } else {
    const tile = document.createElement("span");
    tile.className = "card-favicon-tile";
    tile.textContent = "?";
    favicon.appendChild(tile);
  }

  const crumb = document.createElement("span");
  crumb.className = "card-breadcrumb";
  breadcrumbParts(url).forEach((part, index) => {
    if (index > 0) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "›";
      crumb.appendChild(sep);
    }
    const span = document.createElement("span");
    if (part.leaf) span.className = "crumb-leaf";
    span.textContent = part.text;
    crumb.appendChild(span);
  });

  if (isVerifiedDomain(host)) {
    const badge = document.createElement("span");
    badge.className = "card-verified";
    badge.title = "Official Indian public domain";
    badge.setAttribute("aria-label", "Verified official domain");
    badge.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M12 2.6l2.3 1.7 2.8-.2 1 2.6 2.4 1.5-.7 2.7.7 2.7-2.4 1.5-1 2.6-2.8-.2L12 21.4l-2.3-1.7-2.8.2-1-2.6L3.5 15.8l.7-2.7-.7-2.7 2.4-1.5 1-2.6 2.8.2z" ' +
      'fill="currentColor"/><path d="M8.6 12.2l2.2 2.2 4.6-4.6" fill="none" stroke="#fff" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    crumb.appendChild(badge);
  }

  top.append(favicon, crumb);

  const label = KIND_LABEL[result.kind];
  if (label) {
    const kind = document.createElement("span");
    kind.className = "card-kind";
    kind.textContent = label;
    top.appendChild(kind);
  }

  const heading = document.createElement("h3");
  heading.className = "card-title";
  const link = document.createElement("a");
  link.href = url || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = title;
  if (result.source) link.title = `Source: ${result.source}`;
  heading.appendChild(link);

  const snippet = document.createElement("p");
  snippet.className = "card-snippet";
  const snippetText = String(result.snippet || "").trim();
  snippet.textContent = snippetText;
  if (!snippetText) snippet.hidden = true;

  // Shown only when the two-line clamp actually cuts text off, so a short
  // snippet does not advertise a "More" that leads nowhere new.
  const more = document.createElement("a");
  more.className = "card-more";
  more.href = url || "#";
  more.target = "_blank";
  more.rel = "noopener noreferrer";
  more.textContent = "More";
  more.hidden = true;

  body.append(top, heading, snippet, more);

  // Measure after layout: the card is not in the document yet at this point.
  if (snippetText) {
    requestAnimationFrame(() => {
      if (snippet.scrollHeight - snippet.clientHeight > 1) more.hidden = false;
    });
  }
  item.appendChild(body);
  return item;
}
