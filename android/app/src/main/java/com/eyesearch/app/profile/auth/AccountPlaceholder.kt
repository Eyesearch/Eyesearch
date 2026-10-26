package com.eyesearch.app.profile.auth

/**
 * Account support is deliberately absent: the gateway exposes no auth endpoints
 * yet. This object is the single place that says so, so the UI never shows a
 * sign-in button that cannot work, and swapping in a real implementation later
 * touches one file.
 */
object AccountPlaceholder {

    const val IS_AVAILABLE: Boolean = false

    const val TITLE: String = "Account"

    const val BODY: String =
        "Sign-in is not wired up yet — the gateway has no auth endpoints. " +
            "Search, history and settings all work without an account."

    const val ACTION_LABEL: String = "Sign in (coming soon)"
}
