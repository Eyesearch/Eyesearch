package com.eyesearch.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.eyesearch.app.core.network.SearchApiClient
import com.eyesearch.app.core.network.SearchResultItem
import com.eyesearch.app.home.feedcards.FeedItem
import com.eyesearch.app.home.feedcards.HomeFeedAdapter
import com.eyesearch.app.home.mediatools.CameraSearchHelper
import com.eyesearch.app.home.mediatools.VoiceSearchHelper
import com.eyesearch.app.home.quicklinks.QuickLink
import com.eyesearch.app.home.quicklinks.QuickLinksAdapter
import com.eyesearch.app.home.searchbar.ResultsTab
import com.eyesearch.app.home.searchbar.SearchBarView
import com.eyesearch.app.home.searchbar.SearchBarViewModel
import com.eyesearch.app.home.searchbar.SearchStatus
import com.eyesearch.app.home.searchbar.SearchUiState
import com.eyesearch.app.menu.language.LocaleHelper
import com.eyesearch.app.menu.theme.ThemePreferences
import com.eyesearch.app.profile.history.HistoryRepository
import com.eyesearch.app.results.metainfo.LatencyIndicatorView
import com.eyesearch.app.results.resultcards.ResultsAdapter
import com.eyesearch.app.results.tabs.ResultsTabRow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Android composition root — the counterpart of web/app.js.
 *
 * It builds the four modules' views, wires them to [SearchBarViewModel], and
 * owns the small amount of glue: history recording, deep links, the theme and
 * language switches, and the home feed (weather + headlines).
 */
class MainActivity : AppCompatActivity() {

    private val viewModel: SearchBarViewModel by viewModels()
    private lateinit var history: HistoryRepository
    private lateinit var themePreferences: ThemePreferences

    private lateinit var searchBar: SearchBarView
    private lateinit var resultsAdapter: ResultsAdapter
    private lateinit var resultsList: RecyclerView
    private lateinit var tabs: ResultsTabRow
    private lateinit var latency: LatencyIndicatorView
    private lateinit var statusView: TextView
    private lateinit var homeSection: View
    private lateinit var resultsSection: View
    private lateinit var feedAdapter: HomeFeedAdapter

    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun onCreate(savedInstanceState: Bundle?) {
        themePreferences = ThemePreferences(this)
        themePreferences.apply()
        super.onCreate(savedInstanceState)
        history = HistoryRepository(this)

        setContentView(buildUi())
        wireSearch()
        observeState()
        loadFeed()
        handleDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    // ------------------------------------------------------------------ UI

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, 0)
        }

        root.addView(buildTopBar())

        val scroll = androidx.core.widget.NestedScrollView(this)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(24))
        }
        scroll.addView(column)

        // home module
        homeSection = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        searchBar = SearchBarView(this)
        (homeSection as LinearLayout).addView(searchBar)

        val mediaRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(12), 0, 0)
        }
        val voiceButton = Button(this).apply { text = "Voice" }
        val cameraButton = Button(this).apply { text = "Camera" }
        mediaRow.addView(voiceButton)
        mediaRow.addView(cameraButton)
        voiceButton.setOnClickListener { voiceHelper.start(localeTag()) }
        cameraButton.setOnClickListener { cameraHelper.capture() }
        (homeSection as LinearLayout).addView(mediaRow)

        val quickLinks = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@MainActivity, RecyclerView.HORIZONTAL, false)
            adapter = QuickLinksAdapter(onOpen = { openUrl(it) }).also {
                it.submitList(QuickLinksAdapter.DEFAULT_LINKS)
            }
            setPadding(0, dp(16), 0, dp(16))
        }
        (homeSection as LinearLayout).addView(quickLinks)

        feedAdapter = HomeFeedAdapter(onHeadlineClick = { item ->
            searchBar.setText(item.title)
            runSearch(item.title)
        })
        val feed = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = feedAdapter
            isNestedScrollingEnabled = false
        }
        (homeSection as LinearLayout).addView(feed)
        column.addView(homeSection)

        // results module
        resultsSection = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
        }
        tabs = ResultsTabRow(this)
        tabs.onTabSelected = { tab -> viewModel.setTab(tab) }
        latency = LatencyIndicatorView(this)
        statusView = TextView(this).apply {
            textSize = 14f
            setPadding(0, dp(24), 0, dp(24))
            visibility = View.GONE
        }
        resultsAdapter = ResultsAdapter(
            terms = { termsFor(viewModel.state.value.query) },
            onClick = { openUrl(it.url) },
        )
        resultsList = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = resultsAdapter
            isNestedScrollingEnabled = false
        }
        (resultsSection as LinearLayout).apply {
            addView(tabs)
            addView(latency)
            addView(statusView)
            addView(resultsList)
        }
        column.addView(resultsSection)

        root.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        return root
    }

    private fun buildTopBar(): View {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(16), dp(10), dp(8), dp(10))
        }
        val title = TextView(this).apply {
            text = "EyeSearch"
            textSize = 18f
        }
        val spacer = View(this)
        bar.addView(title, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(spacer)
        bar.addView(Button(this).apply {
            text = "Aa"
            contentDescription = "Language"
            setOnClickListener {
                val next = if (LocaleHelper.currentLanguage() == LocaleHelper.KANNADA) LocaleHelper.ENGLISH else LocaleHelper.KANNADA
                LocaleHelper.setLanguage(next)
            }
        })
        bar.addView(Button(this).apply {
            text = "◐"
            contentDescription = "Theme"
            setOnClickListener { cycleTheme() }
        })
        return bar
    }

    // --------------------------------------------------------------- wiring

    private fun wireSearch() {
        searchBar.onSearch = { query -> runSearch(query) }
        searchBar.onQueryChanged = { viewModel.onQueryChanged(it) }
        searchBar.onCleared = {
            viewModel.clear()
            resultsSection.visibility = View.GONE
            homeSection.visibility = View.VISIBLE
            latency.clear()
        }
    }

    private val voiceHelper: VoiceSearchHelper by lazy {
        VoiceSearchHelper(
            activity = this,
            onTranscript = { text ->
                searchBar.setText(text)
                runSearch(text)
            },
            onUnavailable = { message -> toast(message) },
        )
    }

    private val cameraHelper: CameraSearchHelper by lazy {
        CameraSearchHelper(
            activity = this,
            onImageReady = { _, file ->
                toast("“${file.name}” captured. Visual search needs a vision endpoint the gateway does not have yet.")
            },
            onCancelled = {},
            onFailed = { message -> toast(message) },
        )
    }

    private fun runSearch(query: String) {
        val cleaned = query.trim()
        if (cleaned.isEmpty()) return
        homeSection.visibility = View.GONE
        resultsSection.visibility = View.VISIBLE
        latency.showLoading()
        lifecycleScope.launch { history.add(cleaned) }
        viewModel.search(cleaned)
    }

    private fun observeState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state -> render(state) }
            }
        }
    }

    private fun render(state: SearchUiState) {
        when (val status = state.status) {
            is SearchStatus.Idle -> {
                resultsSection.visibility = View.GONE
                homeSection.visibility = View.VISIBLE
                statusView.visibility = View.GONE
                latency.clear()
            }

            is SearchStatus.Loading -> {
                resultsSection.visibility = View.VISIBLE
                statusView.visibility = View.GONE
                latency.showLoading()
                resultsAdapter.submitList(emptyList())
            }

            is SearchStatus.Success -> {
                statusView.visibility = View.GONE
                val payload = state.payload ?: return
                latency.update(payload.meta, payload.results.size)
                resultsAdapter.submitList(payload.results)
            }

            is SearchStatus.Empty -> {
                val payload = state.payload
                if (payload != null) latency.update(payload.meta, 0)
                resultsAdapter.submitList(emptyList())
                statusView.visibility = View.VISIBLE
                statusView.text = "No results for “${state.query}”. Try different words."
            }

            is SearchStatus.Failed -> {
                resultsAdapter.submitList(emptyList())
                latency.clear()
                statusView.visibility = View.VISIBLE
                val error = state.error
                statusView.text = when (error) {
                    is com.eyesearch.app.core.network.SearchError.ProviderUnavailable ->
                        "The search providers are not responding. ${error.message}"

                    is com.eyesearch.app.core.network.SearchError.RateLimited ->
                        "Too many searches right now. Try again in a moment."

                    is com.eyesearch.app.core.network.SearchError.Network ->
                        "Can't reach the search gateway. Check your connection."

                    else -> "The search could not be completed. ${error?.message.orEmpty()}"
                }
            }
        }
    }

    // ----------------------------------------------------------------- feed

    private fun loadFeed() {
        lifecycleScope.launch {
            val weather = fetchWeather()
            val headlines = fetchHeadlines()
            feedAdapter.submitList(listOf(weather) + headlines)
        }
    }

    private suspend fun fetchWeather(): FeedItem.Weather = withContext(Dispatchers.IO) {
        val url = "https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946" +
            "&current=temperature_2m,weather_code&timezone=auto"
        try {
            http.newCall(Request.Builder().url(url).build()).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful || body.isBlank()) {
                    return@withContext FeedItem.Weather(null, "", "Bengaluru", error = "Weather unavailable")
                }
                val current = JSONObject(body).optJSONObject("current")
                val temperature = current?.optDouble("temperature_2m", Double.NaN) ?: Double.NaN
                if (temperature.isNaN()) {
                    FeedItem.Weather(null, "", "Bengaluru", error = "Weather unavailable")
                } else {
                    val code = current?.optInt("weather_code", -1) ?: -1
                    FeedItem.Weather(temperature.toInt(), describeWeather(code), "Bengaluru")
                }
            }
        } catch (error: Exception) {
            FeedItem.Weather(null, "", "Bengaluru", error = "Weather unavailable")
        }
    }

    private suspend fun fetchHeadlines(): List<FeedItem.Headline> = try {
        val payload = SearchApiClient().search("top news headlines India today", limit = 4)
        payload.results.map { item ->
            FeedItem.Headline(item.title, item.url, hostOf(item.url))
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

    // ---------------------------------------------------------------- misc

    private fun handleDeepLink(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        if (data.scheme != "eyesearch") return
        val query = data.getQueryParameter("q").orEmpty()
        if (query.isNotBlank()) {
            searchBar.setText(query)
            runSearch(query)
        }
    }

    private fun cycleTheme() {
        val next = when (themePreferences.current()) {
            ThemePreferences.Mode.SYSTEM -> ThemePreferences.Mode.LIGHT
            ThemePreferences.Mode.LIGHT -> ThemePreferences.Mode.DARK
            ThemePreferences.Mode.DARK -> ThemePreferences.Mode.SYSTEM
        }
        themePreferences.set(next)
    }

    private fun localeTag(): String =
        if (LocaleHelper.currentLanguage() == LocaleHelper.KANNADA) "kn-IN" else "en-IN"

    private fun hostOf(url: String): String =
        runCatching { java.net.URI(url).host?.removePrefix("www.").orEmpty() }.getOrDefault("")

    private fun termsFor(query: String): List<String> =
        query.split(Regex("\\s+")).filter { it.length > 1 }.take(6)

    private fun openUrl(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }

    private fun openUrl(item: SearchResultItem) = openUrl(item.url)

    private fun openUrl(link: QuickLink) = openUrl(link.url)

    private fun toast(message: String) {
        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
