package com.eyesearch.app.home.feedcards

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.eyesearch.app.R
import java.util.Locale

/**
 * The weather card on the home feed.
 *
 * Data comes from Open-Meteo (no API key, CORS-friendly), loaded by
 * [com.eyesearch.app.home.HomeViewModel]; this view only renders state, including
 * the honest "unavailable" case.
 */
class WeatherCardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : LinearLayout(context, attrs, defStyleAttr) {

    data class State(
        val temperatureC: Int? = null,
        val condition: String = "",
        val place: String = "Bengaluru",
        val error: String? = null,
        val loading: Boolean = false,
    )

    private val title: TextView
    private val temperature: TextView
    private val condition: TextView

    init {
        orientation = VERTICAL
        setPadding(dp(16), dp(14), dp(16), dp(14))
        setBackgroundColor(ContextCompat.getColor(context, R.color.card_surface))

        title = TextView(context).apply {
            text = "Weather"
            textSize = 12f
            setTextColor(ContextCompat.getColor(context, R.color.text_muted))
        }
        temperature = TextView(context).apply {
            textSize = 30f
            gravity = Gravity.START
        }
        condition = TextView(context).apply {
            textSize = 13f
            setTextColor(ContextCompat.getColor(context, R.color.text_muted))
        }
        addView(title)
        addView(temperature)
        addView(condition)
        bind(State(loading = true))
    }

    fun bind(state: State) {
        when {
            state.loading -> {
                temperature.text = "—"
                condition.text = "Loading weather…"
            }
            state.error != null -> {
                temperature.text = "—"
                condition.text = state.error
            }
            state.temperatureC != null -> {
                temperature.text = String.format(Locale.US, "%d°C", state.temperatureC)
                condition.text = "${state.condition} · ${state.place}"
            }
            else -> {
                temperature.text = "—"
                condition.text = "Weather unavailable"
            }
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
