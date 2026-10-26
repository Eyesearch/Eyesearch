package com.eyesearch.app.home.feedcards

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.eyesearch.app.databinding.ItemNewsCardBinding

/** One live headline, produced by our own gateway (no third-party news API). */
data class NewsItem(
    val title: String,
    val url: String,
    val host: String,
) {
    val stableId: String get() = "news:$url"
}

/** Live headlines list on the home screen. */
class NewsFeedAdapter(
    private val onOpen: (NewsItem) -> Unit = {},
) : ListAdapter<NewsItem, NewsFeedAdapter.Holder>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val binding = ItemNewsCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Holder(binding)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        holder.bind(getItem(position), onOpen)
    }

    class Holder(private val binding: ItemNewsCardBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: NewsItem, onOpen: (NewsItem) -> Unit) {
            binding.newsTitle.text = item.title
            binding.newsHost.text = item.host
            binding.root.setOnClickListener { onOpen(item) }
        }
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<NewsItem>() {
            override fun areItemsTheSame(oldItem: NewsItem, newItem: NewsItem) = oldItem.stableId == newItem.stableId
            override fun areContentsTheSame(oldItem: NewsItem, newItem: NewsItem) = oldItem == newItem
        }
    }
}
