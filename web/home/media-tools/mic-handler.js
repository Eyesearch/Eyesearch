/**
 * home/media-tools — voice search.
 *
 * Uses the Web Speech API where it exists. Chrome/Edge expose
 * `webkitSpeechRecognition`; Firefox and Safari do not, so the button renders
 * disabled with an explanation rather than failing silently. The recognition
 * language follows the UI language (kn-IN / en-IN).
 */

import { t, getLang, onLangChange } from "../../menu/language-selector/lang-switcher.js";

const MIC_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function localeFor(lang) {
  return lang === "kn" ? "kn-IN" : "en-IN";
}

/**
 * @param {HTMLElement} container
 * @param {{onTranscript: (text: string) => void, onError?: (message: string) => void}} handlers
 */
export function mountMicButton(container, handlers) {
  if (!container) throw new Error("mountMicButton: container is required");
  const Ctor = recognitionCtor();

  const row = container.querySelector(".media-tools") || document.createElement("div");
  if (!row.isConnected) {
    row.className = "media-tools";
    container.appendChild(row);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-tool";
  button.dataset.tool = "mic";
  button.dataset.listening = "false";
  button.innerHTML = `${MIC_ICON}<span class="media-tool-label"></span>`;
  const label = button.querySelector(".media-tool-label");

  if (!Ctor) {
    button.disabled = true;
    button.title = t("micUnsupported");
  }

  row.appendChild(button);

  let recognition = null;
  let listening = false;

  const setListening = (value) => {
    listening = value;
    button.dataset.listening = String(value);
    button.setAttribute("aria-pressed", String(value));
    label.textContent = value ? t("micListening") : t("mic");
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
    if (!Ctor) return;
    if (listening) {
      stop();
      return;
    }
    recognition = new Ctor();
    recognition.lang = localeFor(getLang());
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
        reason === "not-allowed" || reason === "service-not-allowed"
          ? t("micDenied")
          : `${t("micFailed")} (${reason})`;
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

  const refresh = () => {
    label.textContent = listening ? t("micListening") : t("mic");
    if (!Ctor) button.title = t("micUnsupported");
  };
  refresh();
  onLangChange(refresh);

  return { stop, element: button, supported: Boolean(Ctor) };
}
