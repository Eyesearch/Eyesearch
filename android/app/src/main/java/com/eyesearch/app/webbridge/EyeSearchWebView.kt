package com.eyesearch.app.webbridge

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.AttributeSet
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * The hosted web client, embedded.
 *
 * The native screens are the primary experience; this bridge exists so a user
 * can reach the full web app (including anything added there first) without
 * leaving the app. Rules:
 *   - the app's own origin loads inside the WebView;
 *   - any other http(s) link opens in the user's browser instead;
 *   - nothing else (intents, tel:, mailto:) is handled silently.
 */
class EyeSearchWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : WebView(context, attrs, defStyleAttr) {

    var onExternalLink: ((Uri) -> Unit)? = null

    init {
        @SuppressLint("SetJavaScriptEnabled")
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        setBackgroundColor(0xFF0B0C0E.toInt())
        webViewClient = Client()
    }

    /** Loads the hosted app; [url] is the Pages deployment by default. */
    fun loadApp(url: String = DEFAULT_URL) {
        visibility = View.VISIBLE
        loadUrl(url)
    }

    /** Loads the web app already showing a query: /web/?q=… */
    fun loadSearch(url: String = DEFAULT_URL, query: String) {
        val separator = if (url.contains("?")) "&" else "?"
        loadApp("$url${separator}q=${Uri.encode(query)}")
    }

    fun destroySafely() {
        stopLoading()
        webViewClient = WebViewClient()
        destroy()
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url ?: return false
            val sameApp = uri.host == Uri.parse(DEFAULT_URL).host
            if (sameApp) return false
            return openExternally(uri)
        }

        private fun openExternally(uri: Uri): Boolean {
            onExternalLink?.invoke(uri)
            return try {
                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                true
            } catch (error: ActivityNotFoundException) {
                false
            }
        }
    }

    companion object {
        const val DEFAULT_URL = "https://eyesearch.github.io/Eyesearch/web/"
    }
}
