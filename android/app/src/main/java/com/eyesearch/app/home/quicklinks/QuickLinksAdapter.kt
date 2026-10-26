package com.eyesearch.app.home.quicklinks

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView

/** A curated shortcut. India-first, matching the web UI's quick links. */
data class QuickLink(val label: String, val url: String)

class QuickLinksAdapter(
    private val onOpen: (QuickLink) -> Unit = {},
) : ListAdapter<QuickLink, QuickLinksAdapter.Holder>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val view = TextView(parent.context).apply {
            setPadding(24, 20, 24, 20)
            textSize = 13.5f
            isClickable = true
            isFocusable = true
        }
        return Holder(view)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val link = getItem(position)
        holder.text.text = link.label
        holder.text.setOnClickListener {
            onOpen(link)
            runCatching {
                holder.text.context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(link.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            }.onFailure { error ->
                if (error !is ActivityNotFoundException) throw error
            }
        }
    }

    class Holder(val text: TextView) : RecyclerView.ViewHolder(text)

    companion object {
        val DEFAULT_LINKS = listOf(
            QuickLink("Wikipedia", "https://en.wikipedia.org"),
            QuickLink("ಕನ್ನಡ ವಿಕಿಪೀಡಿಯ", "https://kn.wikipedia.org"),
            QuickLink("Namma Metro", "https://english.bmrc.co.in"),
            QuickLink("IRCTC", "https://www.irctc.co.in"),
            QuickLink("GitHub", "https://github.com/Eyesearch"),
            QuickLink("YouTube", "https://www.youtube.com"),
            QuickLink("ಪ್ರಜಾವಾಣಿ", "https://www.prajavani.net"),
            QuickLink("OpenStreetMap", "https://www.openstreetmap.org"),
        )

        private val DIFF = object : DiffUtil.ItemCallback<QuickLink>() {
            override fun areItemsTheSame(oldItem: QuickLink, newItem: QuickLink) = oldItem.url == newItem.url
            override fun areContentsTheSame(oldItem: QuickLink, newItem: QuickLink) = oldItem == newItem
        }
    }
}
