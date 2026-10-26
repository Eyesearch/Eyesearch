/**
 * home/media-tools — camera / image input.
 *
 * Opens the device camera (or file picker) and hands the chosen image to the
 * caller. The EyeSearch gateway has no vision endpoint yet, so this module
 * deliberately does not invent a result: it previews the capture and reports
 * the file upward, and the composition root explains the limitation.
 */

import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

const LENS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a2 2 0 0 0 1.7-1l.5-.8A1.6 1.6 0 0 1 11.3 3h1.4a1.6 1.6 0 0 1 1.4.8l.5.8a2 2 0 0 0 1.7 1h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

/**
 * @param {HTMLElement} container
 * @param {{onImage: (file: File) => void}} handlers
 */
export function mountLensButton(container, handlers) {
  if (!container) throw new Error("mountLensButton: container is required");

  const row = container.querySelector(".media-tools") || document.createElement("div");
  if (!row.isConnected) {
    row.className = "media-tools";
    container.appendChild(row);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-tool";
  button.dataset.tool = "lens";
  button.innerHTML = `${LENS_ICON}<span class="media-tool-label"></span>`;
  const label = button.querySelector(".media-tool-label");

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.setAttribute("capture", "environment");
  fileInput.hidden = true;
  fileInput.setAttribute("aria-hidden", "true");

  const preview = document.createElement("div");
  preview.className = "media-preview";
  preview.hidden = true;

  row.append(button, fileInput);
  container.appendChild(preview);

  button.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      if (typeof handlers.onError === "function") handlers.onError(t("lensNotImage"));
      return;
    }
    preview.hidden = false;
    preview.textContent = "";
    const image = document.createElement("img");
    image.alt = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
    const caption = document.createElement("span");
    caption.textContent = file.name;
    preview.append(image, caption);

    if (typeof handlers.onImage === "function") handlers.onImage(file);
    fileInput.value = "";
  });

  const refresh = () => {
    label.textContent = t("lens");
  };
  refresh();
  onLangChange(refresh);

  return { element: button, preview };
}
