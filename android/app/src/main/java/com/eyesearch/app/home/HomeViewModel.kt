package com.eyesearch.app.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eyesearch.app.core.api.SearchApiClient
import com.eyesearch.app.home.feedcards.NewsItem
import com.eyesearch.app.home.feedcards.WeatherCardView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Home screen state: the weather reading and the live headlines.
 *
 * Weather is fetched from Open-Meteo (keyless) and headlines from our own
 * gateway, so the feed stays live without a second data source.
 */
class HomeViewModel(
    private val api: SearchApiClient = SearchApiClient(),
) : ViewModel() {

    data class FeedState(
        val weather: WeatherCardView.State = WeatherCardView.State(loading = true),
        val headlines: List<NewsItem> = emptyList(),
    )

    private val _state = MutableStateFlow(FeedState())
    val state: StateFlow<FeedState> = _state.asStateFlow()

    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    fun load() {
        viewModelScope.launch {
            val weather = fetchWeather()
            _state.value = _state.value.copy(weather = weather)
            val headlines = fetchHeadlines()
            _state.value = _state.value.copy(headlines = headlines)
        }
    }

    private suspend fun fetchWeather(): WeatherCardView.State = withContext(Dispatchers.IO) {
        val url = "https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946" +
            "&current=temperature_2m,weather_code&timezone=auto"
        try {
            http.newCall(Request.Builder().url(url).build()).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful || body.isBlank()) {
                    return@withContext WeatherCardView.State(error = "Weather unavailable")
                }
                val current = JSONObject(body).optJSONObject("current")
                val temperature = current?.optDouble("temperature_2m", Double.NaN) ?: Double.NaN
                if (temperature.isNaN()) {
                    WeatherCardView.State(error = "Weather unavailable")
                } else {
                    val code = current?.optInt("weather_code", -1) ?: -1
                    WeatherCardView.State(
                        temperatureC = temperature.toInt(),
                        condition = describeWeather(code),
                        place = "Bengaluru",
                    )
                }
            }
        } catch (error: Exception) {
            WeatherCardView.State(error = "Weather unavailable")
        }
    }

    private suspend fun fetchHeadlines(): List<NewsItem> = try {
        api.search(HEADLINE_QUERY, limit = 4).results.map { item ->
            NewsItem(title = item.title, url = item.url, host = item.host)
        }
    } catch (error: Exception) {
        emptyList()
    }

    private fun describeWeather(code: Int): String = when (code) {
        0 -> "Clear sky"
        1, 2 -> "Partly cloudy"
        3 -> "Overcast"
        45, 48 -> "Fog"
        51, 53, 55 -> "Drizzle"
        61, 63, 65 -> "Rain"
        80, 81, 82 -> "Rain showers"
        95, 96, 99 -> "Thunderstorm"
        else -> "Weather"
    }

    companion object {
        const val HEADLINE_QUERY = "top news headlines India today"
    }
}
