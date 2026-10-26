/**
 * home/search-input — the search field.
 *
 * Owns: the field, the clear button, the submit button and the inline action
 * slot (voice and camera live there, inside the bar). It never fetches anything.
 *
 * Searching is explicit: a search runs only when the form is submitted — Enter
 * in the field, or a click on the search button. Typing never triggers a request.
 */

import { t } from "../../menu/language-selector/lang-switcher.js";

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CLEAR_ICON =
  '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/**
 * @param {HTMLElement} container
 * @param {{onSearch: (query: string) => void, onClear?: () => void}} handlers
 */
export function mountSearchInput(container, handlers) {
  if (!container) throw new Error("mountSearchInput: container is required");
  const onSearch = handlers.onSearch;
  const onClear = handlers.onClear || (() => {});

  const form = document.createElement("form");
  form.className = "search-form";
  form.setAttribute("role", "search");
  form.autocomplete = "off";

  const iconWrap = document.createElement("span");
  iconWrap.className = "search-icon";
  iconWrap.innerHTML = SEARCH_ICON;

  const input = document.createElement("input");
  input.type = "search";
  input.name = "q";
  input.id = "search-input";
  input.className = "search-field";
  input.inputMode = "search";
  input.enterKeyHint = "search";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.placeholder = t("searchPlaceholder");
  input.setAttribute("aria-label", t("searchLabel"));

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "search-clear";
  clear.hidden = true;
  clear.setAttribute("aria-label", t("clear"));
  clear.innerHTML = CLEAR_ICON;

  // Voice and camera mount here, between the field and the search button.
  const actions = document.createElement("span");
  actions.className = "search-actions";
  actions.dataset.slot = "media-tools";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "search-submit";
  submit.setAttribute("aria-label", t("searchLabel"));
  submit.innerHTML = SEARCH_ICON;

  form.append(iconWrap, input, clear, actions, submit);

  const hint = document.createElement("p");
  hint.className = "search-hint";
  hint.textContent = t("searchHint");

  container.append(form, hint);

  const syncClear = () => {
    clear.hidden = input.value.length === 0;
  };

  const submitSearch = () => {
    const cleaned = input.value.replace(/\s+/g, " ").trim();
    if (cleaned) onSearch(cleaned);
  };

  input.addEventListener("input", syncClear);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSearch();
  });

  clear.addEventListener("click", () => {
    input.value = "";
    syncClear();
    onClear();
    input.focus();
  });

  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (event.key === "/" && !typing) {
      event.preventDefault();
      input.focus();
    } else if (event.key === "Escape" && active === input) {
      input.value = "";
      syncClear();
      onClear();
      input.blur();
    }
  });

  return {
    getValue: () => input.value,
    setValue: (value) => {
      input.value = String(value == null ? "" : value);
      syncClear();
    },
    focus: () => input.focus(),
    clear: () => {
      input.value = "";
      syncClear();
    },
    element: form,
    actions,
    submit: submitSearch,
  };
}
