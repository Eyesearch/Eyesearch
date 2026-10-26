/**
 * home/media-tools — camera / image input, as an inline icon inside the bar.
 *
 * Opens the device camera (or the file picker) and hands the chosen image to the
 * caller. The gateway has no vision endpoint, so this module deliberately does
 * not invent a result: it reports the file upward and the composition root
 * explains the limitation in one line.
 */

import { t } from "../../menu/language-selector/lang-switcher.js";

const LENS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a2 2 0 0 0 1.7-1l.5-.8A1.6 1.6 0 0 1 11.3 3h1.4a1.6 1.6 0 0 1 1.4.8l.5.8a2 2 0 0 0 1.7 1h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';

/**
 * @param {HTMLElement} slot container inside the search bar
 * @param {{onImage: (file: File) => void, onError?: (message: string) => void}} handlers
 */
export function mountLensButton(slot, handlers) {
  if (!slot) throw new Error("mountLensButton: slot is required");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-inline-button";
  button.dataset.tool = "lens";
  button.setAttribute("aria-label", t("lens"));
  button.setAttribute("title", t("lens"));
  button.innerHTML = LENS_ICON;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.setAttribute("capture", "environment");
  fileInput.hidden = true;
  fileInput.setAttribute("aria-hidden", "true");

  slot.append(button, fileInput);

  button.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      if (typeof handlers.onError === "function") handlers.onError(t("lensNotImage"));
      return;
    }
    if (typeof handlers.onImage === "function") handlers.onImage(file);
  });

  return { element: button };
}
