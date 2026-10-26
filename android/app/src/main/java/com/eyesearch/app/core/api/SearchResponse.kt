package com.eyesearch.app.core.api

import com.eyesearch.app.results.resultcards.SearchResultItem

/**
 * The gateway's `/v1/search` payload.
 *
 * [meta] carries the honest extras the UI must be able to show — `took_ms`,
 * `degraded`, `cache_hit`, which providers answered — and [results] the cards.
 */
data class SearchResponse(
    val meta: SearchMeta,
    val results: List<SearchResultItem>,
)

data class SearchMeta(
    val query: String,
    val tookMs: Long? = null,
    val degraded: Boolean = false,
    val cacheHit: Boolean = false,
    val providers: Map<String, Int> = emptyMap(),
    val failedProviders: List<String> = emptyList(),
    val totalEstimate: Int? = null,
)
