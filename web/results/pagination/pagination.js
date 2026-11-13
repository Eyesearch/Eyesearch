/**
 * Page numbers under the results: 1 2 3 … Next.
 *
 * A search engine shows a page of results, not the index. Without this the
 * client always asked for page 1, so everything below the tenth result was
 * crawled and never seen.
 *
 * The component draws only; `onPage` decides what happens when a number is
 * pressed. It is rebuilt on every render, so it holds no state of its own.
 */

/** How many numbered buttons before and after the current page. */
const WINDOW = 2;

/**
 * @param {object} options
 * @param {number} options.page      current page, 1-based
 * @param {number} options.totalPages
 * @param {(page: number) => void} options.onPage
 * @param {string} [options.label]   accessible name for the nav
 * @returns {HTMLElement | null} null when there is only one page
 */
export function createPagination({ page, totalPages, onPage, label = "Result pages" }) {
  const total = Math.max(1, Math.trunc(totalPages) || 1);
  if (total <= 1) return null;

  const current = Math.min(Math.max(1, Math.trunc(page) || 1), total);

  const nav = document.createElement("nav");
  nav.className = "pagination";
  nav.setAttribute("aria-label", label);

  const addButton = (text, target, { disabled = false, current: isCurrent = false } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pagination-button";
    button.textContent = String(text);
    if (isCurrent) {
      button.classList.add("is-current");
      button.setAttribute("aria-current", "page");
    }
    if (disabled) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else {
      button.addEventListener("click", () => onPage(target));
    }
    nav.appendChild(button);
    return button;
  };

  const addGap = () => {
    const gap = document.createElement("span");
    gap.className = "pagination-gap";
    gap.textContent = "…";
    gap.setAttribute("aria-hidden", "true");
    nav.appendChild(gap);
  };

  addButton("Previous", current - 1, { disabled: current === 1 });

  // The window around the current page, with the first and last always present
  // so the reader can see where the ends are without pressing Next repeatedly.
  // When the whole run is short enough to fit, it is shown whole: "1 2 3 … 5"
  // for five pages is a gap where there is nothing to hide.
  const fits = total <= WINDOW * 2 + 3;
  const first = fits ? 1 : Math.max(1, current - WINDOW);
  const last = fits ? total : Math.min(total, current + WINDOW);

  if (first > 1) {
    addButton(1, 1);
    if (first > 2) addGap();
  }
  for (let number = first; number <= last; number += 1) {
    addButton(number, number, { current: number === current });
  }
  if (last < total) {
    if (last < total - 1) addGap();
    addButton(total, total);
  }

  addButton("Next", current + 1, { disabled: current === total });

  return nav;
}
