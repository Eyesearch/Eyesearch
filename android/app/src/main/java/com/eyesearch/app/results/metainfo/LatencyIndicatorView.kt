package com.eyesearch.app.results.metainfo

import android.content.Context
import android.util.AttributeSet
import android.widget.TextView
import com.eyesearch.app.results.resultcards.SearchMeta
import java.util.Locale

/**
 * "5 results · found in 0.43s" plus the honest extras: when the gateway reports
 * `degraded`, the failing providers are named; a cache hit is labelled.
 */
class LatencyIndicatorView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : TextView(context, attrs, defStyleAttr) {

    init {
        textSize = 12.5f
        alpha = 0.75f
    }

    fun showLoading() {
        text = "Searching…"
    }

    fun update(meta: SearchMeta, count: Int) {
        val noun = if (count == 1) "result" else "results"
        val seconds = meta.tookMs?.let { formatSeconds(it) }
        val parts = mutableListOf("$count $noun")
        if (seconds != null) parts += "found in $seconds"
        if (meta.cacheHit) parts += "cached"
        if (meta.degraded) {
            val failed = meta.failedProviders.map(::label).filter { it.isNotBlank() }
            parts += if (failed.isEmpty()) "partial results" else "partial: ${failed.joinToString(", ")}"
        }
        val answered = meta.providers.filterValues { it > 0 }.keys.map(::label)
        if (answered.isNotEmpty()) parts += "sources: ${answered.take(3).joinToString(" · ")}"
        text = parts.joinToString(" · ")
    }

    fun clear() {
        text = ""
    }

    private fun formatSeconds(millis: Long): String =
        if (millis < 1000) String.format(Locale.US, "%.2fs", millis / 1000.0)
        else String.format(Locale.US, "%.1fs", millis / 1000.0)

    private fun label(provider: String): String = when (provider) {
        "duckduckgo" -> "DuckDuckGo"
        "duckduckgo_html" -> "DuckDuckGo HTML"
        "duckduckgo_lite" -> "DuckDuckGo Lite"
        "bing" -> "Bing"
        "turso_cache", "cache" -> "cache"
        else -> provider.replace('_', ' ')
    }
}
