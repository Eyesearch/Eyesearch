package com.eyesearch.app.menu.theme

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate

/**
 * Theme choice: System / Light / Dark, persisted in SharedPreferences and
 * applied through [AppCompatDelegate] so the whole activity recreates correctly.
 */
class ThemePreferences(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    enum class Mode { SYSTEM, LIGHT, DARK }

    fun current(): Mode {
        val stored = prefs.getString(KEY_MODE, null) ?: return Mode.SYSTEM
        return runCatching { Mode.valueOf(stored) }.getOrDefault(Mode.SYSTEM)
    }

    fun set(mode: Mode) {
        prefs.edit().putString(KEY_MODE, mode.name).apply()
        apply(mode)
    }

    /** Applies a mode without persisting it — used once at startup. */
    fun apply(mode: Mode = current()) {
        AppCompatDelegate.setDefaultNightMode(
            when (mode) {
                Mode.LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
                Mode.DARK -> AppCompatDelegate.MODE_NIGHT_YES
                Mode.SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            },
        )
    }

    companion object {
        private const val PREFS = "eyesearch.theme"
        private const val KEY_MODE = "mode"
    }
}
