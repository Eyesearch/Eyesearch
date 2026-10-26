package com.eyesearch.app.results.resultcards

import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import com.eyesearch.app.core.network.SearchResultItem

/**
 * Result list for both tabs. The AI tab passes the same items with presentation
 * fields absent, so one adapter serves both.
 */
class ResultsAdapter(
    private val terms: () -> List<String> = { emptyList() },
    private val onClick: (SearchResultItem) -> Unit = {},
) : ListAdapter<SearchResultItem, ResultCardViewHolder>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ResultCardViewHolder =
        ResultCardViewHolder.create(parent.context)

    override fun onBindViewHolder(holder: ResultCardViewHolder, position: Int) {
        holder.bind(getItem(position), terms(), onClick)
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<SearchResultItem>() {
            override fun areItemsTheSame(oldItem: SearchResultItem, newItem: SearchResultItem) =
                oldItem.url == newItem.url

            override fun areContentsTheSame(oldItem: SearchResultItem, newItem: SearchResultItem) =
                oldItem == newItem
        }
    }
}
