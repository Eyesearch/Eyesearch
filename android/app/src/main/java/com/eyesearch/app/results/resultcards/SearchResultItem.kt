package com.eyesearch.app.results.resultcards

/**
 * The result models — the app's copy of the gateway contract.
 *
 * `SearchResultItem` maps one entry of `/v1/search` `results[]`; `SearchMeta`
 * carries the honest extras (`took_ms`, `degraded`, `cache_hit`, providers);
 * `SearchPayload` bundles both so a screen renders from a single object.
 */
data class SearchResultItem(
    val id: String,
    val title: String,
    val url: String,
    val snippet: String,
    val source: String,
    val kind: String,
    val thumbnailUrl: String? = null,
    val posterUrl: String? = null,
) {
    val host: String
        get() = runCatching { java.net.URI(url).host?.removePrefix("www.").orEmpty() }.getOrDefault("")

    val breadcrumb: String
        get() = runCatching {
            val uri = java.net.URI(url)
            val segments = uri.path.orEmpty().split("/").filter { it.isNotBlank() }.take(2)
                .map { it.replace(Regex("\\.(html?|php|aspx?)$"), "").replace('-', ' ') }
            (listOf(host) + segments).filter { it.isNotBlank() }.joinToString(" › ")
        }.getOrDefault(url)
}

data class SearchMeta(
    val query: String,
    val tookMs: Long? = null,
    val degraded: Boolean = false,
    val cacheHit: Boolean = false,
    val providers: Map<String, Int> = emptyMap(),
    val failedProviders: List<String> = emptyList(),
    val totalEstimate: Int? = null,
)

data class SearchPayload(
    val meta: SearchMeta,
    val results: List<SearchResultItem>,
)
