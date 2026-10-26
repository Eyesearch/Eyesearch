package com.eyesearch.app.profile.history

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.eyesearch.app.databinding.ItemHistoryBinding
import java.util.concurrent.TimeUnit

/** Rows of the history screen: query, relative time, delete. */
class HistoryAdapter(
    private val onPick: (LocalHistoryEntity) -> Unit = {},
    private val onDelete: (LocalHistoryEntity) -> Unit = {},
) : ListAdapter<LocalHistoryEntity, HistoryAdapter.Holder>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val binding = ItemHistoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Holder(binding)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        holder.bind(getItem(position), onPick, onDelete)
    }

    class Holder(private val binding: ItemHistoryBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: LocalHistoryEntity, onPick: (LocalHistoryEntity) -> Unit, onDelete: (LocalHistoryEntity) -> Unit) {
            binding.historyQuery.text = item.query
            binding.historyTime.text = relativeTime(item.createdAt)
            binding.root.setOnClickListener { onPick(item) }
            binding.historyDelete.setOnClickListener { onDelete(item) }
        }
    }

    companion object {
        /** "just now", "2 hours ago", "3 days ago", "2 months ago"… */
        fun relativeTime(createdAt: Long, now: Long = System.currentTimeMillis()): String {
            val seconds = ((now - createdAt) / 1000).coerceAtLeast(0)
            return when {
                seconds < 45 -> "just now"
                seconds < 90 -> "a minute ago"
                seconds < TimeUnit.HOURS.toSeconds(1) -> "${seconds / 60} minutes ago"
                seconds < TimeUnit.HOURS.toSeconds(2) -> "an hour ago"
                seconds < TimeUnit.DAYS.toSeconds(1) -> "${seconds / 3600} hours ago"
                seconds < TimeUnit.DAYS.toSeconds(2) -> "a day ago"
                seconds < TimeUnit.DAYS.toSeconds(7) -> "${seconds / 86400} days ago"
                seconds < TimeUnit.DAYS.toSeconds(14) -> "a week ago"
                seconds < TimeUnit.DAYS.toSeconds(30) -> "${seconds / (86400 * 7)} weeks ago"
                seconds < TimeUnit.DAYS.toSeconds(60) -> "a month ago"
                seconds < TimeUnit.DAYS.toSeconds(365) -> "${seconds / (86400 * 30)} months ago"
                seconds < TimeUnit.DAYS.toSeconds(730) -> "a year ago"
                else -> "${seconds / (86400 * 365)} years ago"
            }
        }

        private val DIFF = object : DiffUtil.ItemCallback<LocalHistoryEntity>() {
            override fun areItemsTheSame(oldItem: LocalHistoryEntity, newItem: LocalHistoryEntity) =
                oldItem.queryKey == newItem.queryKey

            override fun areContentsTheSame(oldItem: LocalHistoryEntity, newItem: LocalHistoryEntity) =
                oldItem == newItem
        }
    }
}
