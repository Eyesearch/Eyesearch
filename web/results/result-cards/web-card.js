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
 * Every card carries a category chip, so a reader can tell a gazette notice from
 * a news item without opening either. `web` is the default rather than a gap:
 * a card with no chip looks like a bug next to one that has it.
 */
function categoryOf(result) {
  // The server already sends a short upper-case code (GOV, TECH, FINANCE…), and
  // it knows the page's category from the classifier rather than from the media
  // kind. Kind is the fallback for rows indexed before categories were returned.
  const fromServer = String(result.category || "").trim();
  if (fromServer) return fromServer.toUpperCase();

  const raw = KIND_LABEL[result.kind] || result.kind || "";
  const cleaned = String(raw).replace(/[_-]+/g, " ").trim().toUpperCase();
  return cleaned || "WEB";
}

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
    // The site's own icon, not a third party's copy of it. This used to fall
    // back to DuckDuckGo's icon service and then Google's, which meant every
    // card view told two other companies which page the reader was looking at —
    // and made the UI depend on two services that can rate-limit or disappear.
    // A site that serves no icon at /favicon.ico gets a letter tile instead,
    // which is honest and costs nothing.
    icon.src = `https://${host}/favicon.ico`;
    icon.alt = "";
    icon.width = 16;
    icon.height = 16;
    icon.loading = "lazy";
    icon.addEventListener("error", () => {
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

  // The server sends the path as words (agent 34), so the second line can say
  // "Health › Notifications" instead of a truncated URL. When it does not — an
  // older row, a federated card — the host alone is still the right answer:
  // it tells the reader whose page this is.
  const crumbs = Array.isArray(result.breadcrumbs)
    ? result.breadcrumbs.map((part) => String(part || "").trim()).filter(Boolean)
    : [];

  const crumb = document.createElement("span");
  crumb.className = "card-breadcrumb";
  if (crumbs.length) {
    crumb.appendChild(document.createTextNode(host ? `${host} › ` : ""));
    crumbs.forEach((part, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "card-crumb-sep";
        sep.setAttribute("aria-hidden", "true");
        // Spaces in the text, not only in the margin: this is read aloud and
        // extracted as text, and "Dept›Health" is not a breadcrumb there.
        sep.textContent = " › ";
        crumb.appendChild(sep);
      }
      const span = document.createElement("span");
      span.className = "card-crumb-part";
      span.textContent = part;
      crumb.appendChild(span);
    });
  } else {
    crumb.textContent = host || url;
  }

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

  // Brand over breadcrumb, as Google stacks them: the site's name on one line
  // and where on the site this page sits on the next. A single row forced the
  // breadcrumb to compete with the brand for width.
  const headings = document.createElement("div");
  headings.className = "card-headings";

  const brandName = String(result.brand_name || "").trim();
  if (brandName) {
    const brand = document.createElement("span");
    brand.className = "card-brand";
    brand.textContent = brandName;
    headings.appendChild(brand);
  }
  headings.appendChild(crumb);
  top.append(favicon, headings);

  // Direct child of the header row, not of the breadcrumb: the crumb clips its
  // overflow, so a chip inside it can never reach the card's right edge.
  const category = document.createElement("span");
  category.className = "card-category-badge";
  category.textContent = categoryOf(result);
  top.appendChild(category);

  // Federated answers carry a `source`. Showing it is not decoration: the text
  // came from someone else, and the terms of the endpoints we use require the
  // attribution to be visible. A card that hides where its answer came from is
  // worse than no card.
  const sourceName = String(result.source || "").trim();
  if (sourceName) {
    const attribution = document.createElement("div");
    attribution.className = "card-attribution";

    const label = document.createElement("span");
    label.className = "card-attribution-label";
    label.textContent = `Source: ${sourceName.charAt(0).toUpperCase()}${sourceName.slice(1)}`;

    const sourceUrl = String(result.source_url || result.url || "").trim();
    if (sourceUrl) {
      const outbound = document.createElement("a");
      outbound.className = "card-attribution-link";
      outbound.href = sourceUrl;
      outbound.target = "_blank";
      outbound.rel = "noopener noreferrer";
      outbound.textContent = "View original";
      attribution.append(label, outbound);
    } else {
      attribution.append(label);
    }
    body.appendChild(attribution);
  }

  // Structured facts a card can state outright — a phone number, a PIN code, a
  // date (agent 45). Only rendered when the server sent some.
  const entities = result.entities && typeof result.entities === "object" ? result.entities : null;
  if (entities) {
    const facts = [
      ...(Array.isArray(entities.phones) ? entities.phones : []),
      ...(Array.isArray(entities.pin_codes) ? entities.pin_codes.map((p) => `PIN ${p}`) : []),
      ...(Array.isArray(entities.dates) ? entities.dates : []),
    ].filter(Boolean);
    if (facts.length) {
      const box = document.createElement("ul");
      box.className = "card-facts";
      facts.slice(0, 4).forEach((fact) => {
        const item = document.createElement("li");
        item.textContent = String(fact);
        box.appendChild(item);
      });
      body.appendChild(box);
    }
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
