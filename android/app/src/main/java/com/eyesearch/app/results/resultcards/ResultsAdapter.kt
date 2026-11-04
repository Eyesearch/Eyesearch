package com.eyesearch.app.results.resultcards

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.eyesearch.app.core.api.KnowledgeCard
import com.eyesearch.app.databinding.ItemHeroCardBinding
import com.eyesearch.app.databinding.ItemSearchResultBinding

/** What the list holds: an external hero card, or an indexed result. */
sealed interface ResultsRow {
    data class Hero(
        val card: KnowledgeCard,
        /** The secondary cards shown as pills under the hero. */
        val chips: List<KnowledgeCard> = emptyList(),
    ) : ResultsRow
    data class Result(val item: SearchResultItem) : ResultsRow
}

/**
 * Result list for both tabs.
 *
 * The hero card is a row of its own rather than a view above the list, so it
 * scrolls with the results and the list keeps one adapter. `results` stays the
 * indexed pages: the hero is never counted among them.
 */
class ResultsAdapter(
    private val terms: () -> List<String> = { emptyList() },
    private val onClick: (SearchResultItem) -> Unit = {},
    private val onOpenExternal: (String) -> Unit = {},
) : ListAdapter<ResultsRow, RecyclerView.ViewHolder>(DIFF) {

    override fun getItemViewType(position: Int): Int = when (getItem(position)) {
        is ResultsRow.Hero -> TYPE_HERO
        is ResultsRow.Result -> TYPE_RESULT
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_HERO -> HeroCardViewHolder(
                ItemHeroCardBinding.inflate(inflater, parent, false),
                onOpenExternal,
            )
            else -> ResultCardViewHolder(
                ItemSearchResultBinding.inflate(inflater, parent, false),
            )
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val row = getItem(position)) {
            is ResultsRow.Hero -> (holder as HeroCardViewHolder).bind(row.card, row.chips)
            is ResultsRow.Result -> (holder as ResultCardViewHolder).bind(row.item, terms(), onClick)
        }
    }

    companion object {
        private const val TYPE_HERO = 0
        private const val TYPE_RESULT = 1

        private val DIFF = object : DiffUtil.ItemCallback<ResultsRow>() {
            override fun areItemsTheSame(oldItem: ResultsRow, newItem: ResultsRow): Boolean =
                when {
                    oldItem is ResultsRow.Hero && newItem is ResultsRow.Hero ->
                        oldItem.card.url == newItem.card.url
                    oldItem is ResultsRow.Result && newItem is ResultsRow.Result ->
                        oldItem.item.url == newItem.item.url
                    else -> false
                }

            override fun areContentsTheSame(oldItem: ResultsRow, newItem: ResultsRow): Boolean =
                oldItem == newItem
        }
    }
}
