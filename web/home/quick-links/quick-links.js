/**
 * home/quick-links — shortcut grid.
 *
 * Static, curated destinations (India-first, as the product is Indian), each a
 * plain anchor so it works with middle-click, keyboard and screen readers.
 * Links are data, not markup, so the list is trivial to change.
 */

import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

const LINKS = [
  { label: { en: "Wikipedia", kn: "ವಿಕಿಪೀಡಿಯ" }, href: "https://en.wikipedia.org", tile: "W", tint: "#4a5568" },
  { label: { en: "Kannada Wikipedia", kn: "ಕನ್ನಡ ವಿಕಿಪೀಡಿಯ" }, href: "https://kn.wikipedia.org", tile: "ಕ", tint: "#7a5af8" },
  { label: { en: "Namma Metro", kn: "ನಮ್ಮ ಮೆಟ್ರೋ" }, href: "https://english.bmrc.co.in", tile: "M", tint: "#0f9d58" },
  { label: { en: "IRCTC", kn: "ಐಆರ್‌ಸಿಟಿಸಿ" }, href: "https://www.irctc.co.in", tile: "I", tint: "#c2410c" },
  { label: { en: "GitHub", kn: "ಗಿಟ್‌ಹಬ್" }, href: "https://github.com/Eyesearch", tile: "G", tint: "#24292f" },
  { label: { en: "YouTube", kn: "ಯೂಟ್ಯೂಬ್" }, href: "https://www.youtube.com", tile: "Y", tint: "#cc0000" },
  { label: { en: "Prajavani", kn: "ಪ್ರಜಾವಾಣಿ" }, href: "https://www.prajavani.net", tile: "P", tint: "#1d4ed8" },
  { label: { en: "OpenStreetMap", kn: "ಓಪನ್‌ಸ್ಟ್ರೀಟ್‌ಮ್ಯಾಪ್" }, href: "https://www.openstreetmap.org", tile: "O", tint: "#0b7a75" },
];

function labelFor(link, lang) {
  return (link.label && (link.label[lang] || link.label.en)) || link.href;
}

/**
 * @param {HTMLElement} container
 * @param {{lang?: string}} options
 */
export function mountQuickLinks(container, options = {}) {
  if (!container) throw new Error("mountQuickLinks: container is required");

  const section = document.createElement("section");
  section.className = "quick-links";
  const heading = document.createElement("h2");
  heading.className = "section-title";
  const grid = document.createElement("ul");
  grid.className = "quick-grid";
  section.append(heading, grid);
  container.appendChild(section);

  const render = () => {
    const lang = options.lang || document.documentElement.lang || "en";
    heading.textContent = t("quickLinks");
    grid.textContent = "";
    LINKS.forEach((link) => {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      anchor.className = "quick-link";
      anchor.href = link.href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      const tile = document.createElement("span");
      tile.className = "quick-tile";
      tile.textContent = link.tile;
      tile.style.background = link.tint;
      const text = document.createElement("span");
      text.className = "quick-label";
      text.textContent = labelFor(link, lang);
      if (lang === "kn") text.setAttribute("lang", "kn");
      anchor.append(tile, text);
      item.appendChild(anchor);
      grid.appendChild(item);
    });
  };

  render();
  onLangChange(render);

  return { element: section, links: LINKS };
}
