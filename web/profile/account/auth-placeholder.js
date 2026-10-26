/**
 * profile/account — deliberate placeholder.
 *
 * The gateway has no auth endpoints yet, so this states that plainly instead of
 * showing a dead sign-in form. When the backend grows /v1/auth, only this file
 * changes.
 */

import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

/**
 * @param {HTMLElement} container
 */
export function mountAuthPlaceholder(container) {
  if (!container) throw new Error("mountAuthPlaceholder: container is required");

  const card = document.createElement("section");
  card.className = "account-card";

  const heading = document.createElement("h2");
  heading.className = "section-title";

  const body = document.createElement("p");
  body.className = "feed-muted";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "feed-action";
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");

  card.append(heading, body, button);
  container.appendChild(card);

  const render = () => {
    heading.textContent = t("accountTitle");
    body.textContent = t("accountBody");
    button.textContent = t("signIn");
  };
  render();
  onLangChange(render);

  return { element: card };
}
