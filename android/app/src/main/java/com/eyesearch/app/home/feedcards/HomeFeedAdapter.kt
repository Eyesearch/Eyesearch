package com.eyesearch.app.home.feedcards

import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView

/**
 * The home feed: a weather reading and live headlines, in one list.
 *
 * Weather is a [FeedItem.Weather] the caller fills from Open-Meteo (keyless);
 * headlines are [FeedItem.Headline] entries produced by the gateway, so the feed
 * stays live without a second data source.
 */
sealed interface FeedItem {
    val stableId: String

    data class Weather(
        val temperatureC: Int?,
        val condition: String,
        val place: String,
        val error: String? = null,
    ) : FeedItem {
        override val stableId: String = "weather"
    }

    data class Headline(
        val title: String,
        val url: String,
        val host: String,
    ) : FeedItem {
        override val stableId: String = "headline:$url"
    }
}

class HomeFeedAdapter(
    private val onHeadlineClick: (FeedItem.Headline) -> Unit = {},
) : ListAdapter<FeedItem, RecyclerView.ViewHolder>(DIFF) {

    override fun getItemViewType(position: Int): Int = when (getItem(position)) {
        is FeedItem.Weather -> TYPE_WEATHER
        is FeedItem.Headline -> TYPE_HEADLINE
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val column = LinearLayout(parent.context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 24)
        }
        return if (viewType == TYPE_WEATHER) {
            val title = TextView(parent.context).apply { textSize = 11f }
            val value = TextView(parent.context).apply { textSize = 26f }
            val subtitle = TextView(parent.context).apply { textSize = 13f }
            column.addView(title)
            column.addView(value)
            column.addView(subtitle)
            WeatherHolder(column, value, subtitle)
        } else {
            val title = TextView(parent.context).apply {
                textSize = 13.5f
                setPadding(0, 10, 0, 2)
            }
            val host = TextView(parent.context).apply { textSize = 11f }
            column.addView(title)
            column.addView(host)
            HeadlineHolder(column, title, host)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = getItem(position)) {
            is FeedItem.Weather -> (holder as WeatherHolder).bind(item)
            is FeedItem.Headline -> (holder as HeadlineHolder).bind(item, onHeadlineClick)
        }
    }

    class WeatherHolder(
        root: LinearLayout,
        private val value: TextView,
        private val subtitle: TextView,
    ) : RecyclerView.ViewHolder(root) {
        fun bind(item: FeedItem.Weather) {
            value.text = when {
                item.error != null -> "—"
                item.temperatureC != null -> "${item.temperatureC}°C"
                else -> "—"
            }
            subtitle.text = if (item.error != null) item.error else "${item.condition} · ${item.place}"
        }
    }

    class HeadlineHolder(
        root: LinearLayout,
        private val title: TextView,
        private val host: TextView,
    ) : RecyclerView.ViewHolder(root) {
        fun bind(item: FeedItem.Headline, onClick: (FeedItem.Headline) -> Unit) {
            title.text = item.title
            host.text = item.host
            root.setOnClickListener { onClick(item) }
        }
    }

    companion object {
        private const val TYPE_WEATHER = 1
        private const val TYPE_HEADLINE = 2

        private val DIFF = object : DiffUtil.ItemCallback<FeedItem>() {
            override fun areItemsTheSame(oldItem: FeedItem, newItem: FeedItem) = oldItem.stableId == newItem.stableId
            override fun areContentsTheSame(oldItem: FeedItem, newItem: FeedItem) = oldItem == newItem
        }
    }
}
