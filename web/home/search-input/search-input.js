/**
 * home/search-input — the search field.
 *
 * Owns: input markup, debounced search-as-you-type, clear button, keyboard
 * shortcuts, and the disabled/busy affordances. It never fetches anything; it
 * reports intent through `onSearch(query, { immediate })`.
 */

import { API_CONFIG } from "../../config/api-config.js";
import { t, onLangChange, getLang } from "../../menu/language-selector/lang-switcher.js";

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CLEAR_ICON =
  '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/**
 * @param {HTMLElement} container
 * @param {{onSearch: (query: string, meta: {immediate: boolean}) => void, onClear?: () => void}} handlers
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
  input.setAttribute("aria-label", t("searchLabel"));

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "search-clear";
  clear.hidden = true;
  clear.setAttribute("aria-label", t("clear"));
  clear.innerHTML = CLEAR_ICON;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "search-submit";
  submit.setAttribute("aria-label", t("searchLabel"));
  submit.innerHTML = SEARCH_ICON;

  form.append(iconWrap, input, clear, submit);

  const hint = document.createElement("p");
  hint.className = "search-hint";
  hint.textContent = t("searchHint");

  container.append(form, hint);

  let timer = 0;
  let composing = false;

  const syncClear = () => {
    clear.hidden = input.value.length === 0;
  };

  const emit = (query, immediate) => {
    const cleaned = query.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    onSearch(cleaned, { immediate });
  };

  const cancelPending = () => {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  };

  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
  });

  input.addEventListener("input", () => {
    syncClear();
    cancelPending();
    if (composing) return;
    const value = input.value.trim();
    if (value.length === 0) {
      onClear();
      return;
    }
    if (value.length < API_CONFIG.minChars && value.length < 2) return;
    timer = setTimeout(() => {
      timer = 0;
      emit(input.value, false);
    }, API_CONFIG.debounceMs);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    cancelPending();
    emit(input.value, true);
  });

  clear.addEventListener("click", () => {
    cancelPending();
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
      cancelPending();
      input.value = "";
      syncClear();
      onClear();
      input.blur();
    }
  });

  const refreshLabels = () => {
    input.setAttribute("aria-label", t("searchLabel"));
    clear.setAttribute("aria-label", t("clear"));
    submit.setAttribute("aria-label", t("searchLabel"));
    hint.textContent = t("searchHint");
    input.placeholder = t("searchPlaceholder");
    input.lang = getLang();
  };
  refreshLabels();
  onLangChange(refreshLabels);

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
  };
}
