package com.eyesearch.app.results.resultcards

import android.text.TextUtils
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
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
) : RecyclerView.ViewHolder(binding.root) {

    private var expanded = false

    fun bind(card: KnowledgeCard, chips: List<KnowledgeCard> = emptyList()) {
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

        bindChips(chips)
    }

    /**
     * The secondary cards, as pills under the hero.
     *
     * Plain TextViews in a scrolling row rather than a nested RecyclerView or a
     * Material ChipGroup. A scrolling list inside a scrolling list makes both
     * feel broken; and this app's theme is AppCompat, so a Material3 chip style
     * would fail at inflate time — the worse of the two failure modes.
     */
    private fun bindChips(chips: List<KnowledgeCard>) {
        binding.heroChips.removeAllViews()
        val usable = chips.filter {
            it.url.isNotBlank() && (it.title.isNotBlank() || it.label.isNotBlank())
        }
        binding.heroChipsScroll.visibility = if (usable.isEmpty()) View.GONE else View.VISIBLE
        if (usable.isEmpty()) return

        val context = binding.root.context
        val padding = (context.resources.displayMetrics.density * 12).toInt()
        val gap = (context.resources.displayMetrics.density * 8).toInt()

        usable.forEachIndexed { index, chip ->
            val view = TextView(context).apply {
                text = chip.title.ifBlank { chip.label }
                textSize = 13f
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                setPadding(padding, padding / 2, padding, padding / 2)
                background = ContextCompat.getDrawable(context, R.drawable.knowledge_chip_background)
                isClickable = true
                isFocusable = true
                contentDescription = chip.label.ifBlank { chip.source }
                setOnClickListener { onOpen(chip.url) }
                if (index > 0) {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ).apply { marginStart = gap }
                }
            }
            binding.heroChips.addView(view)
        }
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
