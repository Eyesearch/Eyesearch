package com.eyesearch.app.home.searchbar

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.AttributeSet
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout

/**
 * The search field: rounded container, magnifier submit button, clear button and
 * a debounced text watcher. It reports intent only — [onSearch] for a committed
 * query and [onQueryChanged] for keystrokes.
 */
class SearchBarView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    var onSearch: ((String) -> Unit)? = null
    var onQueryChanged: ((String) -> Unit)? = null
    var onCleared: (() -> Unit)? = null

    private val handler = Handler(Looper.getMainLooper())
    private var pending: Runnable? = null

    private val input = EditText(context).apply {
        hint = "Search the web…"
        isSingleLine = true
        imeOptions = EditorInfo.IME_ACTION_SEARCH
        background = null
        setPadding(dp(4), 0, dp(4), 0)
    }

    private val submit = ImageButton(context).apply {
        contentDescription = "Search"
        setImageResource(android.R.drawable.ic_menu_search)
        background = null
        setOnClickListener { commit() }
    }

    private val clear = ImageButton(context).apply {
        contentDescription = "Clear search"
        setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
        background = null
        visibility = GONE
        setOnClickListener {
            input.setText("")
            visibility = GONE
            onCleared?.invoke()
        }
    }

    init {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(6), dp(8), dp(6))
        }
        row.addView(input, LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
        row.addView(clear, LinearLayout.LayoutParams(dp(36), dp(36)))
        row.addView(submit, LinearLayout.LayoutParams(dp(44), dp(44)))
        addView(row, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

        input.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                clear.visibility = if (s.isNullOrEmpty()) GONE else VISIBLE
                onQueryChanged?.invoke(s?.toString().orEmpty())
                scheduleDebouncedSearch(s?.toString().orEmpty())
            }
        })

        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                commit()
                true
            } else {
                false
            }
        }
    }

    fun setText(value: String) {
        input.setText(value)
        input.setSelection(input.text.length)
    }

    fun text(): String = input.text?.toString().orEmpty()

    fun focusInput() {
        input.requestFocus()
    }

    private fun commit() {
        pending?.let(handler::removeCallbacks)
        val query = input.text?.toString()?.trim().orEmpty()
        if (query.isNotEmpty()) onSearch?.invoke(query)
    }

    private fun scheduleDebouncedSearch(query: String) {
        pending?.let(handler::removeCallbacks)
        val trimmed = query.trim()
        if (trimmed.length < SearchBarViewModel.MIN_CHARS) return
        val runnable = Runnable { onSearch?.invoke(trimmed) }
        pending = runnable
        handler.postDelayed(runnable, DEBOUNCE_MS)
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    companion object {
        const val DEBOUNCE_MS = 320L
    }
}
