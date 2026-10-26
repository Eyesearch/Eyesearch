/**
 * home/feed-cards — weather.
 *
 * Open-Meteo is used because it needs no API key and sends CORS headers, so the
 * card is real data rather than a mock. Default location is Bengaluru; the
 * coordinates are overridable through `options`.
 */

import { t, onLangChange } from "../../menu/language-selector/lang-switcher.js";

const BENGALURU = { latitude: 12.9716, longitude: 77.5946, name: { en: "Bengaluru", kn: "ಬೆಂಗಳೂರು" } };

// WMO weather interpretation codes → { en, kn } short descriptions.
const CODES = {
  0: { en: "Clear sky", kn: "ಸ್ವಚ್ಛ ಆಕಾಶ" },
  1: { en: "Mainly clear", kn: "ಬಹುತೇಕ ಸ್ವಚ್ಛ" },
  2: { en: "Partly cloudy", kn: "ಭಾಗಶಃ ಮೋಡ" },
  3: { en: "Overcast", kn: "ಮೋಡ ಕವಿದ" },
  45: { en: "Fog", kn: "ಮಂಜು" },
  48: { en: "Rime fog", kn: "ಮಂಜು" },
  51: { en: "Light drizzle", kn: "ಹಗುರ ತುಂತುರು" },
  53: { en: "Drizzle", kn: "ತುಂತುರು ಮಳೆ" },
  55: { en: "Heavy drizzle", kn: "ಭಾರೀ ತುಂತುರು" },
  61: { en: "Light rain", kn: "ಹಗುರ ಮಳೆ" },
  63: { en: "Rain", kn: "ಮಳೆ" },
  65: { en: "Heavy rain", kn: "ಭಾರೀ ಮಳೆ" },
  71: { en: "Light snow", kn: "ಹಗುರ ಹಿಮ" },
  80: { en: "Rain showers", kn: "ಮಳೆ ಸುರಿತ" },
  81: { en: "Rain showers", kn: "ಮಳೆ ಸುರಿತ" },
  82: { en: "Violent showers", kn: "ತೀವ್ರ ಮಳೆ" },
  95: { en: "Thunderstorm", kn: "ಗುಡುಗು ಸಹಿತ ಮಳೆ" },
  96: { en: "Thunderstorm with hail", kn: "ಆಲಿಕಲ್ಲು ಮಳೆ" },
  99: { en: "Thunderstorm with hail", kn: "ಆಲಿಕಲ್ಲು ಮಳೆ" },
};

function describe(code, lang) {
  const entry = CODES[code];
  if (!entry) return { en: "Weather", kn: "ಹವಾಮಾನ" }[lang] || "Weather";
  return entry[lang] || entry.en;
}

/**
 * @param {HTMLElement} container
 * @param {{latitude?: number, longitude?: number, label?: string}} options
 */
export function mountWeatherCard(container, options = {}) {
  if (!container) throw new Error("mountWeatherCard: container is required");

  const latitude = Number.isFinite(options.latitude) ? options.latitude : BENGALURU.latitude;
  const longitude = Number.isFinite(options.longitude) ? options.longitude : BENGALURU.longitude;

  const card = document.createElement("article");
  card.className = "feed-card weather-card";
  const heading = document.createElement("h2");
  heading.className = "section-title";
  const body = document.createElement("div");
  body.className = "weather-body";
  card.append(heading, body);
  container.appendChild(card);

  let snapshot = null;

  const render = () => {
    const lang = document.documentElement.lang || "en";
    heading.textContent = t("weather");
    body.textContent = "";

    if (!snapshot) {
      const placeholder = document.createElement("p");
      placeholder.className = "feed-muted";
      placeholder.textContent = t("weatherLoading");
      body.appendChild(placeholder);
      return;
    }
    if (snapshot.error) {
      const message = document.createElement("p");
      message.className = "feed-muted";
      message.textContent = t("weatherUnavailable");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "feed-action";
      retry.textContent = t("retry");
      retry.addEventListener("click", () => load());
      body.append(message, retry);
      return;
    }

    const temp = document.createElement("p");
    temp.className = "weather-temp";
    temp.textContent = `${Math.round(snapshot.temperature)}°C`;
    const condition = document.createElement("p");
    condition.className = "weather-condition";
    condition.textContent = describe(snapshot.code, lang);
    const place = document.createElement("p");
    place.className = "feed-muted";
    place.textContent = options.label || BENGALURU.name[lang] || BENGALURU.name.en;
    if (lang === "kn") place.setAttribute("lang", "kn");
    body.append(temp, condition, place);
  };

  async function load() {
    snapshot = null;
    render();
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(latitude));
      url.searchParams.set("longitude", String(longitude));
      url.searchParams.set("current", "temperature_2m,weather_code");
      url.searchParams.set("timezone", "auto");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const current = payload && payload.current ? payload.current : {};
      if (typeof current.temperature_2m !== "number") throw new Error("malformed payload");
      snapshot = { temperature: current.temperature_2m, code: Number(current.weather_code) };
    } catch (error) {
      snapshot = { error: error && error.message ? error.message : "failed" };
    }
    render();
  }

  render();
  load();
  onLangChange(render);

  return { refresh: load, element: card };
}
