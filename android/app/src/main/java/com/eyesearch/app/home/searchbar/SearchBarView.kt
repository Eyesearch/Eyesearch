package com.eyesearch.app.home.searchbar

import android.content.Context
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
    var onVoice: (() -> Unit)? = null
    var onCamera: (() -> Unit)? = null

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

    private val mic = ImageButton(context).apply {
        contentDescription = "Voice search"
        setImageResource(android.R.drawable.ic_btn_speak_now)
        background = null
        visibility = GONE
        setOnClickListener { onVoice?.invoke() }
    }

    private val camera = ImageButton(context).apply {
        contentDescription = "Search by image"
        setImageResource(android.R.drawable.ic_menu_camera)
        background = null
        setOnClickListener { onCamera?.invoke() }
    }

    init {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(6), dp(8), dp(6))
        }
        row.addView(input, LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
        row.addView(clear, LinearLayout.LayoutParams(dp(36), dp(36)))
        // Voice and camera live inside the bar, before the search button.
        row.addView(mic, LinearLayout.LayoutParams(dp(40), dp(40)))
        row.addView(camera, LinearLayout.LayoutParams(dp(40), dp(40)))
        row.addView(submit, LinearLayout.LayoutParams(dp(44), dp(44)))
        addView(row, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

        input.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                clear.visibility = if (s.isNullOrEmpty()) GONE else VISIBLE
                onQueryChanged?.invoke(s?.toString().orEmpty())
                // No search-as-you-type: a search runs only on Enter or a tap
                // on the search button (see commit()).
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
        val query = input.text?.toString()?.trim().orEmpty()
        if (query.isNotEmpty()) onSearch?.invoke(query)
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    /** Hides the mic when the device has no recogniser; call after wiring. */
    fun setVoiceAvailable(available: Boolean) {
        mic.visibility = if (available) VISIBLE else GONE
    }
}
