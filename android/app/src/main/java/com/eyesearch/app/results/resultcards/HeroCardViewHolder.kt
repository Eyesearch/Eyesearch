package com.eyesearch.app.results.resultcards

import android.text.SpannableString
import android.text.Spanned
import android.text.method.LinkMovementMethod
import android.text.style.URLSpan
import android.view.View
import com.eyesearch.app.R
import com.eyesearch.app.core.api.KnowledgeCard
import com.eyesearch.app.databinding.ItemHeroCardBinding

/**
 * The hero card: one external answer, above the crawled results.
 *
 * The link is a real link rather than a click listener on the whole card. The
 * card also carries an expandable snippet, and a card that navigates when you
 * tap "More" is a card that fights the reader.
 */
class HeroCardViewHolder(
    private val binding: ItemHeroCardBinding,
    private val onOpen: (String) -> Unit,
) : androidx.recyclerview.widget.RecyclerView.ViewHolder(binding.root) {

    private var expanded = false

    fun bind(card: KnowledgeCard) {
        binding.heroTitle.text = card.title.ifBlank { card.label.ifBlank { card.url } }

        val badge = card.label
        binding.heroBadge.text = badge
        binding.heroBadge.visibility = if (badge.isBlank()) View.GONE else View.VISIBLE

        expanded = false
        binding.heroSnippet.text = card.preview
        binding.heroSnippet.maxLines = PREVIEW_LINES

        val canExpand = card.hasMore && card.full.length > card.preview.length
        binding.heroMore.visibility = if (canExpand) View.VISIBLE else View.GONE
        binding.heroMore.text = binding.root.context.getString(R.string.knowledge_more)
        binding.heroMore.setOnClickListener { toggle(card) }

        binding.heroLink.text = hostOf(card.url)
        binding.heroLink.contentDescription =
            binding.root.context.getString(R.string.knowledge_panel)
        binding.heroLink.setOnClickListener { onOpen(card.url) }

        binding.root.contentDescription = card.title.ifBlank { card.label }
    }

    private fun toggle(card: KnowledgeCard) {
        expanded = !expanded
        val context = binding.root.context
        binding.heroSnippet.text = if (expanded) card.full else card.preview
        binding.heroSnippet.maxLines = if (expanded) Int.MAX_VALUE else PREVIEW_LINES
        binding.heroMore.text =
            context.getString(if (expanded) R.string.knowledge_less else R.string.knowledge_more)
    }

    private fun hostOf(url: String): String =
        runCatching { java.net.URI(url).host }.getOrNull()?.removePrefix("www.") ?: url

    private companion object {
        /** Enough to judge the answer without pushing the results off screen. */
        const val PREVIEW_LINES = 4
    }
}
