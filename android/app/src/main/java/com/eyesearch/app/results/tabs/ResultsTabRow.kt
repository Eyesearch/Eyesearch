package com.eyesearch.app.results.tabs

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.eyesearch.app.home.searchbar.ResultsTab

/**
 * ALL / AI selector. Two equal-width tabs with a selected state; the AI tab
 * renders the same query through /v1/retrieve, which is the payload an LLM
 * client would get.
 */
class ResultsTabRow @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : LinearLayout(context, attrs, defStyleAttr) {

    var onTabSelected: ((ResultsTab) -> Unit)? = null

    private var active: ResultsTab = ResultsTab.ALL

    private val allTab = buildTab("All") { select(ResultsTab.ALL) }
    private val aiTab = buildTab("AI") { select(ResultsTab.AI) }

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        addView(allTab, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
        addView(aiTab, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
        render()
    }

    fun select(tab: ResultsTab) {
        if (tab == active) return
        active = tab
        render()
        onTabSelected?.invoke(tab)
    }

    fun activeTab(): ResultsTab = active

    private fun buildTab(label: String, onClick: () -> Unit): TextView =
        TextView(context).apply {
            text = label
            gravity = Gravity.CENTER
            textSize = 13f
            setPadding(16, 18, 16, 18)
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }

    private fun render() {
        applyState(allTab, active == ResultsTab.ALL)
        applyState(aiTab, active == ResultsTab.AI)
    }

    private fun applyState(view: TextView, selected: Boolean) {
        view.alpha = if (selected) 1f else 0.55f
        view.isSelected = selected
        view.contentDescription = view.text.toString() + if (selected) ", selected" else ""
    }
}
