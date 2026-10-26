package com.eyesearch.app.home.quicklinks

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.eyesearch.app.R
import com.eyesearch.app.databinding.ItemQuickLinkBinding

/** Shortcut grid; each tile opens the link in the user's browser. */
class QuickLinksAdapter(
    private val onOpen: (QuickLinkModel) -> Unit = {},
) : ListAdapter<QuickLinkModel, QuickLinksAdapter.Holder>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val binding = ItemQuickLinkBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Holder(binding)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        holder.bind(getItem(position), onOpen)
    }

    class Holder(private val binding: ItemQuickLinkBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: QuickLinkModel, onOpen: (QuickLinkModel) -> Unit) {
            binding.quickTile.text = item.tile
            binding.quickTile.setBackgroundColor(item.tint)
            binding.quickLabel.text = item.label
            binding.root.contentDescription = item.label
            binding.root.setOnClickListener { onOpen(item) }
        }
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<QuickLinkModel>() {
            override fun areItemsTheSame(oldItem: QuickLinkModel, newItem: QuickLinkModel) = oldItem.id == newItem.id
            override fun areContentsTheSame(oldItem: QuickLinkModel, newItem: QuickLinkModel) = oldItem == newItem
        }
    }
}
