package com.eyesearch.app.results.resultcards

import android.text.SpannableString
import android.text.Spanned
import android.text.style.BackgroundColorSpan
import android.view.View
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.eyesearch.app.R
import com.eyesearch.app.databinding.ItemSearchResultBinding

/**
 * One result inside its own 4-sided card (item_search_result.xml).
 *
 * Snippets are plain text with a highlight span — never parsed as HTML — so a
 * hostile title cannot inject anything into the view hierarchy.
 */
class ResultCardViewHolder(
    private val binding: ItemSearchResultBinding,
) : RecyclerView.ViewHolder(binding.root) {

    fun bind(item: SearchResultItem, terms: List<String>, onClick: (SearchResultItem) -> Unit) {
        // The brand is the site's own name; the breadcrumb is where on the site
        // this page sits. Both come from the server, which knows them better
        // than a hostname does.
        val brand = item.brandName.orEmpty().trim()
        binding.brandName.text = brand
        binding.brandName.visibility = if (brand.isEmpty()) View.GONE else View.VISIBLE
        binding.breadcrumb.text = item.breadcrumb
        binding.faviconTile.text = item.host.take(1).uppercase().ifBlank { "?" }
        binding.resultTitle.text = item.title
        binding.resultSnippet.text = highlight(item.snippet, terms)
        binding.resultSnippet.visibility = if (item.snippet.isBlank()) View.GONE else View.VISIBLE

        val kind = when (item.kind) {
            "video" -> "Video"
            "image" -> "Image"
            "news" -> "News"
            "film" -> "Film"
            "document" -> "PDF"
            else -> ""
        }
        binding.resultKind.text = kind
        binding.resultKind.visibility = if (kind.isBlank()) View.GONE else View.VISIBLE

        val poster = item.thumbnailUrl ?: item.posterUrl
        binding.resultThumb.visibility = if (poster == null) View.GONE else View.VISIBLE

        binding.root.contentDescription = "${item.title}. ${item.breadcrumb}"
        binding.cardRoot.setOnClickListener { onClick(item) }
    }

    private fun highlight(text: String, terms: List<String>): CharSequence {
        if (text.isBlank() || terms.isEmpty()) return text
        val spannable = SpannableString(text)
        val colour = ContextCompat.getColor(binding.root.context, R.color.highlight)
        terms.filter { it.length > 1 }.forEach { term ->
            var start = text.indexOf(term, ignoreCase = true)
            while (start >= 0) {
                spannable.setSpan(
                    BackgroundColorSpan(colour),
                    start,
                    start + term.length,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
                start = text.indexOf(term, start + term.length, ignoreCase = true)
            }
        }
        return spannable
    }
}
