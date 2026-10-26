package com.eyesearch.app.menu.language

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * Kannada / English switching using per-app locales (AppCompat 1.6+).
 *
 * setApplicationLocales recreates the running activity itself, so callers do not
 * need to restart anything; on API < 33 the compatibility delegate stores the
 * choice and AppCompat applies it on the next attach.
 */
object LocaleHelper {

    const val ENGLISH = "en"
    const val KANNADA = "kn"

    val supported: List<String> = listOf(ENGLISH, KANNADA)

    fun currentLanguage(): String {
        val locales = AppCompatDelegate.getApplicationLocales()
        val tag = if (locales.isEmpty) null else locales.get(0)?.language
        return if (tag != null && supported.contains(tag)) tag else ENGLISH
    }

    fun setLanguage(languageTag: String) {
        val tag = if (supported.contains(languageTag)) languageTag else ENGLISH
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
    }

    /** True for Kannada strings, so callers can pick the Kannada font. */
    fun isKannada(text: String?): Boolean =
        text != null && text.any { it in '\u0C80'..'\u0CFF' }
}
