package com.eyesearch.app.core.api

import com.eyesearch.app.results.resultcards.SearchResultItem

/**
 * The gateway's `/v1/search` payload.
 *
 * [meta] carries the honest extras the UI must be able to show — `took_ms`,
 * `degraded`, `cache_hit`, which providers answered — and [results] the cards.
 *
 * [primaryCard] and [knowledgeCards] are external answers. They are additive:
 * a response from an older backend omits both, and parses exactly as it did.
 */
data class SearchResponse(
    val meta: SearchMeta,
    val results: List<SearchResultItem>,
    //: The external answer, when the backend had one. Absent on most queries.
    val primaryCard: KnowledgeCard? = null,
    //: Secondary external cards. Additive: a response without them parses
    //: exactly as it did before.
    val knowledgeCards: List<KnowledgeCard> = emptyList(),
)

/**
 * One external card, from a source we did not crawl.
 *
 * Kept separate from [SearchResultItem] on purpose: an indexed result is a page
 * we verified, and a knowledge card is a claim from somewhere else. Rendering
 * them with the same model would make the difference impossible to show.
 */
data class KnowledgeCard(
    val title: String = "",
    val url: String = "",
    val brand: String = "",
    val brandName: String = "",
    val source: String = "",
    val snippet: String = "",
    val snippetShort: String = "",
    val snippetFull: String = "",
    val hasMore: Boolean = false,
    val relevance: Double? = null,
) {
    /** The preview the card shows before the reader asks for more. */
    val preview: String get() = snippetShort.ifBlank { snippet }

    /** What the toggle reveals. Never shorter than the preview. */
    val full: String get() = snippetFull.ifBlank { preview }

    /** The name to show above the snippet. */
    val label: String get() = brand.ifBlank { brandName }.ifBlank { source }
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
