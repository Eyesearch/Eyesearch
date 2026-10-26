package com.eyesearch.app.results.resultcards

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import com.eyesearch.app.databinding.ItemSearchResultBinding

/** Result list for both tabs; the AI tab passes the same items, compactly. */
class ResultsAdapter(
    private val terms: () -> List<String> = { emptyList() },
    private val onClick: (SearchResultItem) -> Unit = {},
) : ListAdapter<SearchResultItem, ResultCardViewHolder>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ResultCardViewHolder {
        val binding = ItemSearchResultBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ResultCardViewHolder(binding)
    }

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
