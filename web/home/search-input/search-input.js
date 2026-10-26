/**
 * home/search-input — the search field, with autocomplete.
 *
 * Owns: the field, the clear button, the submit button, the inline action slot
 * (voice and camera) and the suggestions dropdown. It never searches on its own:
 * a query runs when the form is submitted — Enter or the search button — or when
 * a suggestion is chosen.
 *
 * Autocomplete calls `GET /v1/suggest` after a 250 ms pause, renders the
 * completions directly under the bar, and follows the combobox pattern so the
 * dropdown is usable from the keyboard (arrows, Enter, Escape).
 */

import { API_CONFIG, fetchSuggestions } from "../../config/api-config.js";
import { t } from "../../menu/language-selector/lang-switcher.js";

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CLEAR_ICON =
  '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/**
 * @param {HTMLElement} container
 * @param {{onSearch: (query: string) => void, onClear?: () => void,
 *          id?: string, compact?: boolean}} handlers
 */
export function mountSearchInput(container, handlers) {
  if (!container) throw new Error("mountSearchInput: container is required");
  const onSearch = handlers.onSearch;
  const onClear = handlers.onClear || (() => {});
  const fieldId = handlers.id || "search-input";
  const listId = `${fieldId}-suggestions`;

  const form = document.createElement("form");
  form.className = handlers.compact ? "search-form search-form-compact" : "search-form";
  form.setAttribute("role", "search");
  form.autocomplete = "off";

  const iconWrap = document.createElement("span");
  iconWrap.className = "search-icon";
  iconWrap.innerHTML = SEARCH_ICON;

  const input = document.createElement("input");
  input.type = "search";
  input.name = "q";
  input.id = fieldId;
  input.className = "search-field";
  input.inputMode = "search";
  input.enterKeyHint = "search";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.placeholder = t("searchPlaceholder");
  input.setAttribute("aria-label", t("searchLabel"));
  // Combobox wiring: the input owns the listbox below it.
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", listId);

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

  const suggestions = document.createElement("ul");
  suggestions.className = "search-suggestions";
  suggestions.id = listId;
  suggestions.setAttribute("role", "listbox");
  suggestions.setAttribute("aria-label", t("suggestions"));
  suggestions.hidden = true;

  form.append(iconWrap, input, clear, actions, submit, suggestions);

  if (handlers.compact) {
    container.append(form);
  } else {
    const hint = document.createElement("p");
    hint.className = "search-hint";
    hint.textContent = t("searchHint");
    container.append(form, hint);
  }

  let suggestTimer = 0;
  let suggestController = null;
  let items = [];
  let activeIndex = -1;

  const syncClear = () => {
    clear.hidden = input.value.length === 0;
  };

  /* ------------------------------ suggestions ----------------------------- */

  const closeSuggestions = () => {
    if (suggestTimer) {
      clearTimeout(suggestTimer);
      suggestTimer = 0;
    }
    if (suggestController) {
      suggestController.abort();
      suggestController = null;
    }
    items = [];
    activeIndex = -1;
    suggestions.hidden = true;
    suggestions.textContent = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const setActive = (index) => {
    if (items.length === 0) return;
    activeIndex = (index + items.length) % items.length;
    Array.from(suggestions.children).forEach((node, position) => {
      const isActive = position === activeIndex;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-selected", String(isActive));
      if (isActive) input.setAttribute("aria-activedescendant", node.id);
    });
  };

  const choose = (index) => {
    const value = items[index];
    if (!value) return;
    input.value = value;
    syncClear();
    closeSuggestions();
    submitSearch();
  };

  const renderSuggestions = (completions) => {
    items = completions;
    activeIndex = -1;
    suggestions.textContent = "";

    if (completions.length === 0) {
      suggestions.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }

    completions.forEach((text, index) => {
      const item = document.createElement("li");
      item.className = "search-suggestion";
      item.id = `${listId}-${index}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", "false");
      // A button inside the option keeps click and keyboard activation identical.
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault(); // keep focus in the field
        choose(index);
      });
      item.appendChild(button);
      suggestions.appendChild(item);
    });

    suggestions.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const loadSuggestions = async (query) => {
    if (suggestController) suggestController.abort();
    const controller = new AbortController();
    suggestController = controller;
    try {
      const completions = await fetchSuggestions(query, { signal: controller.signal });
      if (controller.signal.aborted) return;
      // Ignore a response that no longer matches what is in the field.
      if (input.value.trim() !== query) return;
      renderSuggestions(completions);
    } catch (error) {
      /* aborted or failed: suggestions are optional */
    }
  };

  const scheduleSuggestions = (value) => {
    const query = value.trim();
    if (suggestTimer) {
      clearTimeout(suggestTimer);
      suggestTimer = 0;
    }
    if (query.length < API_CONFIG.suggestMinChars) {
      closeSuggestions();
      return;
    }
    suggestTimer = setTimeout(() => {
      suggestTimer = 0;
      loadSuggestions(query);
    }, API_CONFIG.suggestDebounceMs);
  };

  /* --------------------------------- events ------------------------------- */

  const submitSearch = () => {
    const cleaned = input.value.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    closeSuggestions();
    onSearch(cleaned);
  };

  input.addEventListener("input", () => {
    syncClear();
    scheduleSuggestions(input.value);
  });

  input.addEventListener("keydown", (event) => {
    const open = !suggestions.hidden && items.length > 0;
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      closeSuggestions();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSearch();
  });

  clear.addEventListener("click", () => {
    input.value = "";
    syncClear();
    closeSuggestions();
    onClear();
    input.focus();
  });

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) closeSuggestions();
  });

  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (event.key === "/" && !typing) {
      event.preventDefault();
      input.focus();
    } else if (event.key === "Escape" && active === input && suggestions.hidden) {
      input.value = "";
      syncClear();
      closeSuggestions();
      onClear();
      input.blur();
    }
  });

  return {
    getValue: () => input.value,
    setValue: (value) => {
      input.value = String(value == null ? "" : value);
      syncClear();
      closeSuggestions();
    },
    focus: () => input.focus(),
    clear: () => {
      input.value = "";
      syncClear();
      closeSuggestions();
    },
    element: form,
    actions,
    submit: submitSearch,
    closeSuggestions,
  };
}
