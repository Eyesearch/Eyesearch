package com.eyesearch.app.home

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.eyesearch.app.MainActivity
import com.eyesearch.app.databinding.FragmentHomeBinding
import com.eyesearch.app.home.feedcards.NewsFeedAdapter
import com.eyesearch.app.home.mediatools.CameraSearchHelper
import com.eyesearch.app.home.mediatools.VoiceSearchHelper
import com.eyesearch.app.home.quicklinks.QuickLinkModel
import com.eyesearch.app.home.quicklinks.QuickLinksAdapter
import kotlinx.coroutines.launch

/**
 * The home hero: search bar (with inline voice and camera), quick links, live
 * weather and live headlines. A search hands off to the results screen.
 */
class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    private val viewModel: HomeViewModel by viewModels()
    private lateinit var quickLinksAdapter: QuickLinksAdapter
    private lateinit var newsAdapter: NewsFeedAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val activity = requireActivity() as MainActivity

        quickLinksAdapter = QuickLinksAdapter { link -> openUrl(link.url) }
        binding.quickLinks.layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.quickLinks.adapter = quickLinksAdapter
        quickLinksAdapter.submitList(QuickLinkModel.DEFAULT_LINKS)

        newsAdapter = NewsFeedAdapter { item -> openUrl(item.url) }
        binding.newsList.layoutManager = LinearLayoutManager(requireContext())
        binding.newsList.adapter = newsAdapter
        binding.newsList.isNestedScrollingEnabled = false

        binding.searchBar.onSearch = { query -> activity.showResults(query) }
        binding.searchBar.onVoice = { voiceHelper.start("en-IN") }
        binding.searchBar.onCamera = { cameraHelper.capture() }
        binding.searchBar.setVoiceAvailable(voiceHelper.isAvailable())

        binding.btnTheme.setOnClickListener { activity.toggleTheme() }
        binding.btnProfile.setOnClickListener { activity.openProfile() }
        binding.btnWeb.setOnClickListener { activity.openWebApp() }

        lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    binding.weatherCard.bind(state.weather)
                    newsAdapter.submitList(state.headlines)
                }
            }
        }

        viewModel.load()
    }

    private val voiceHelper: VoiceSearchHelper by lazy {
        VoiceSearchHelper(
            activity = requireActivity() as ComponentActivity,
            onTranscript = { text ->
                binding.searchBar.setText(text)
                (requireActivity() as MainActivity).showResults(text)
            },
            onUnavailable = { message -> toast(message) },
        )
    }

    private val cameraHelper: CameraSearchHelper by lazy {
        CameraSearchHelper(
            activity = requireActivity() as ComponentActivity,
            onImageReady = { _, file ->
                toast("“${file.name}” captured. Visual search needs a vision endpoint the gateway does not have yet.")
            },
            onCancelled = {},
            onFailed = { message -> toast(message) },
        )
    }

    private fun openUrl(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (error: ActivityNotFoundException) {
            toast("No app can open that link.")
        }
    }

    private fun toast(message: String) {
        android.widget.Toast.makeText(requireContext(), message, android.widget.Toast.LENGTH_LONG).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
