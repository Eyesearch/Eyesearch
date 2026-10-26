/**
 * home/media-tools — voice search, as an inline icon inside the search bar.
 *
 * Uses the Web Speech API where it exists (Chrome/Edge). Where it does not
 * (Firefox, Safari), the button is not rendered at all rather than sitting there
 * broken. A recognised transcript is handed to the caller, which fills the field
 * and runs the search.
 */

import { t } from "../../menu/language-selector/lang-switcher.js";

const MIC_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * @param {HTMLElement} slot container inside the search bar
 * @param {{onTranscript: (text: string) => void, onError?: (message: string) => void}} handlers
 */
export function mountMicButton(slot, handlers) {
  if (!slot) throw new Error("mountMicButton: slot is required");
  const Ctor = recognitionCtor();
  if (!Ctor) {
    // No recogniser: render nothing instead of a dead control.
    return { supported: false, element: null, stop: () => {} };
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-inline-button";
  button.dataset.tool = "mic";
  button.dataset.listening = "false";
  button.setAttribute("aria-label", t("mic"));
  button.setAttribute("title", t("mic"));
  button.innerHTML = MIC_ICON;
  slot.appendChild(button);

  let recognition = null;
  let listening = false;

  const setListening = (value) => {
    listening = value;
    button.dataset.listening = String(value);
    button.setAttribute("aria-pressed", String(value));
    button.setAttribute("aria-label", value ? t("micListening") : t("mic"));
  };

  const stop = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        /* already stopped */
      }
    }
    setListening(false);
  };

  button.addEventListener("click", () => {
    if (listening) {
      stop();
      return;
    }
    recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const result = event.results && event.results[0] && event.results[0][0];
      const text = result && result.transcript ? result.transcript.trim() : "";
      if (text && typeof handlers.onTranscript === "function") handlers.onTranscript(text);
    };
    recognition.onerror = (event) => {
      setListening(false);
      const reason = event && event.error ? event.error : "unknown";
      const message =
        reason === "not-allowed" || reason === "service-not-allowed" ? t("micDenied") : `${t("micFailed")} (${reason})`;
      if (typeof handlers.onError === "function") handlers.onError(message);
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
    } catch (error) {
      setListening(false);
      if (typeof handlers.onError === "function") handlers.onError(t("micFailed"));
    }
  });

  return { supported: true, element: button, stop };
}
