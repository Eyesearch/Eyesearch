package com.eyesearch.app.core.util

/**
 * One place for the values that would otherwise be scattered magic numbers and
 * strings. Anything environment-specific lives here so a build can change it
 * without hunting through the code.
 */
object Constants {

    // --- gateway ---------------------------------------------------------
    // The VM, not Render. Plain HTTP today, which is why
    // res/xml/network_security_config.xml permits cleartext for this one host.
    // Swap it for an https:// URL once the API sits behind a TLS proxy.
    const val API_BASE_URL = "http://35.255.20.40:8000"
    const val SEARCH_PATH = "/v1/search"
    const val RETRIEVE_PATH = "/v1/retrieve"
    const val DEFAULT_LIMIT = 10
    const val MAX_LIMIT = 50

    // --- networking ------------------------------------------------------
    const val CONNECT_TIMEOUT_SECONDS = 5L
    const val READ_TIMEOUT_SECONDS = 14L
    const val CALL_TIMEOUT_SECONDS = 16L

    // --- home feed -------------------------------------------------------
    const val HEADLINE_QUERY = "top news headlines India today"
    const val HEADLINE_LIMIT = 4
    const val WEATHER_URL =
        "https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946" +
            "&current=temperature_2m,weather_code&timezone=auto"
    const val WEATHER_PLACE = "Bengaluru"

    // --- preferences / storage -------------------------------------------
    const val PREFS_THEME = "eyesearch.theme"
    const val PREFS_KEY_THEME_MODE = "mode"
    const val DATABASE_NAME = "eyesearch.db"
    const val HISTORY_LIMIT = 200

    // --- web bridge ------------------------------------------------------
    const val WEB_APP_URL = "https://eyesearch.github.io/Eyesearch/web/"

    // --- misc ------------------------------------------------------------
    const val SEARCH_DEBOUNCE_NONE = 0 // explicit search only: no debounce
    const val LOCALE_TAG = "en-IN"
}
