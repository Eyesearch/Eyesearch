package com.eyesearch.app

import android.app.SearchManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.fragment.app.FragmentManager
import com.eyesearch.app.databinding.ActivityMainBinding
import com.eyesearch.app.menu.theme.ThemePreferences
import com.eyesearch.app.profile.ProfileFragment
import com.eyesearch.app.profile.history.HistoryActivity
import com.eyesearch.app.results.ResultsFragment
import com.eyesearch.app.home.HomeFragment
import com.eyesearch.app.webbridge.EyeSearchWebView

/**
 * Host activity. Owns the fragment container, the edge-to-edge insets, the theme
 * switch, the embedded web client, and the system search intents.
 *
 * Home and results are fragments; history is its own activity; the profile is a
 * dialog fragment. Navigation is a plain back stack, so hardware/gesture back
 * always unwinds the same way the UI does.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var themePreferences: ThemePreferences
    private lateinit var webView: EyeSearchWebView

    override fun onCreate(savedInstanceState: Bundle?) {
        themePreferences = ThemePreferences(this)
        themePreferences.apply()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        applyWindowInsets()

        webView = EyeSearchWebView(this).apply { visibility = View.GONE }
        binding.root.addView(
            webView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, HomeFragment())
                .commit()
        }

        installBackHandling()
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    // ------------------------------------------------------------ navigation

    /** Show the results screen for [query], on top of home. */
    fun showResults(query: String) {
        val cleaned = query.trim()
        if (cleaned.isEmpty()) return
        closeWebApp()
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, ResultsFragment.newInstance(cleaned))
            .addToBackStack(null)
            .commit()
    }

    /** Return to the home hero, clearing the results back stack. */
    fun showHome() {
        closeWebApp()
        supportFragmentManager.popBackStack(null, FragmentManager.POP_BACK_STACK_INCLUSIVE)
    }

    fun openProfile() {
        if (supportFragmentManager.findFragmentByTag(PROFILE_TAG) == null) {
            ProfileFragment().show(supportFragmentManager, PROFILE_TAG)
        }
    }

    fun openHistory() {
        startActivity(Intent(this, HistoryActivity::class.java))
    }

    fun openWebApp(query: String? = null) {
        webView.visibility = View.VISIBLE
        if (query.isNullOrBlank()) webView.loadApp() else webView.loadSearch(query = query)
    }

    fun closeWebApp() {
        if (::webView.isInitialized && webView.visibility == View.VISIBLE) {
            webView.visibility = View.GONE
            webView.stopLoading()
        }
    }

    fun toggleTheme() {
        val next = when (themePreferences.current()) {
            ThemePreferences.Mode.SYSTEM -> ThemePreferences.Mode.LIGHT
            ThemePreferences.Mode.LIGHT -> ThemePreferences.Mode.DARK
            ThemePreferences.Mode.DARK -> ThemePreferences.Mode.SYSTEM
        }
        themePreferences.set(next)
    }

    // -------------------------------------------------------------- intents

    /**
     * The launcher, the system search intents (WEB_SEARCH / SEARCH, query in
     * [SearchManager.QUERY]) and the eyesearch://search?q= deep link all land here.
     */
    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        val query = when (intent.action) {
            Intent.ACTION_SEARCH, Intent.ACTION_WEB_SEARCH -> intent.getStringExtra(SearchManager.QUERY)
            Intent.ACTION_VIEW -> intent.data?.takeIf { it.scheme == "eyesearch" }?.getQueryParameter("q")
            else -> null
        }.orEmpty().trim()

        if (query.isNotEmpty()) showResults(query)
    }

    // ---------------------------------------------------------------- insets

    private fun applyWindowInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            view.updatePadding(top = bars.top, bottom = bars.bottom, left = bars.left, right = bars.right)
            insets
        }
    }

    private fun installBackHandling() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (::webView.isInitialized && webView.visibility == View.VISIBLE) {
                        closeWebApp()
                        return
                    }
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            },
        )
    }

    override fun onDestroy() {
        if (::webView.isInitialized) webView.destroySafely()
        super.onDestroy()
    }

    companion object {
        private const val PROFILE_TAG = "profile"
    }
}
