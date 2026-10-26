package com.eyesearch.app.results.resultcards

import android.content.Context
import android.text.SpannableString
import android.text.Spanned
import android.text.style.BackgroundColorSpan
import android.util.TypedValue
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.eyesearch.app.core.network.SearchResultItem

/**
 * One result card, built in code: breadcrumb (host › path), title, snippet.
 *
 * Snippets are plain [TextView] text with a highlight span — never parsed as
 * HTML — so a hostile title cannot inject anything into the view hierarchy.
 */
class ResultCardViewHolder(
    private val root: LinearLayout,
    private val breadcrumb: TextView,
    private val title: TextView,
    private val snippet: TextView,
) : RecyclerView.ViewHolder(root) {

    fun bind(item: SearchResultItem, terms: List<String>, onClick: (SearchResultItem) -> Unit) {
        breadcrumb.text = breadcrumbFor(item.url)
        title.text = item.title
        snippet.text = highlight(item.snippet, terms)
        snippet.visibility = if (item.snippet.isBlank()) android.view.View.GONE else android.view.View.VISIBLE
        root.setOnClickListener { onClick(item) }
        root.contentDescription = "${item.title}. ${breadcrumbFor(item.url)}"
    }

    private fun highlight(text: String, terms: List<String>): CharSequence {
        if (text.isBlank() || terms.isEmpty()) return text
        val spannable = SpannableString(text)
        val colour = resolveHighlight()
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

    private fun resolveHighlight(): Int {
        val value = TypedValue()
        val resolved = root.context.theme.resolveAttribute(android.R.attr.textColorHighlight, value, true)
        return if (resolved) value.data else 0x33FFC107
    }

    companion object {
        fun create(context: Context): ResultCardViewHolder {
            val column = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(28, 22, 28, 22)
            }
            val breadcrumb = TextView(context).apply {
                textSize = 12f
                alpha = 0.7f
            }
            val title = TextView(context).apply {
                textSize = 17f
                setPadding(0, 4, 0, 4)
            }
            val snippet = TextView(context).apply {
                textSize = 14f
                alpha = 0.85f
                maxLines = 3
            }
            column.addView(breadcrumb)
            column.addView(title)
            column.addView(snippet)
            return ResultCardViewHolder(column, breadcrumb, title, snippet)
        }

        fun breadcrumbFor(url: String): String {
            return try {
                val parsed = java.net.URI(url)
                val host = parsed.host?.removePrefix("www.").orEmpty()
                val segments = parsed.path.orEmpty().split("/").filter { it.isNotBlank() }.take(2)
                (listOf(host) + segments.map { it.replace(Regex("\\.(html?|php|aspx?)$"), "").replace('-', ' ') })
                    .filter { it.isNotBlank() }
                    .joinToString(" › ")
            } catch (error: Exception) {
                url
            }
        }
    }
}
