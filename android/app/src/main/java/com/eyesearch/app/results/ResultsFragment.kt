package com.eyesearch.app.results

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.eyesearch.app.MainActivity
import com.eyesearch.app.databinding.FragmentResultsBinding
import com.eyesearch.app.home.mediatools.CameraSearchHelper
import com.eyesearch.app.home.mediatools.VoiceSearchHelper
import com.eyesearch.app.profile.history.HistoryRepository
import com.eyesearch.app.results.resultcards.ResultsAdapter
import kotlinx.coroutines.launch

/**
 * The results screen: back arrow, centred wordmark, a full search bar carrying
 * the current query, the All / AI tabs, and the result cards.
 */
class ResultsFragment : Fragment() {

    private var _binding: FragmentResultsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ResultsViewModel by viewModels()
    private lateinit var adapter: ResultsAdapter
    private lateinit var history: HistoryRepository

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentResultsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        history = HistoryRepository(requireContext())
        val query = arguments?.getString(ARG_QUERY).orEmpty()

        adapter = ResultsAdapter(
            terms = { termsFor(viewModel.state.value.query) },
            onClick = { item -> openUrl(item.url) },
        )
        binding.resultsList.layoutManager = LinearLayoutManager(requireContext())
        binding.resultsList.adapter = adapter

        binding.backButton.setOnClickListener { backToHome() }
        binding.brand.text = getString(com.eyesearch.app.R.string.app_name)

        binding.resultsSearchBar.setText(query)
        binding.resultsSearchBar.onSearch = { newQuery ->
            binding.resultsSearchBar.setText(newQuery)
            viewModel.search(newQuery)
            lifecycleScope.launch { history.add(newQuery) }
        }
        binding.resultsSearchBar.onCleared = { backToHome() }
        binding.resultsSearchBar.onVoice = { voiceHelper.start("en-IN") }
        binding.resultsSearchBar.onCamera = { cameraHelper.capture() }
        binding.resultsSearchBar.setVoiceAvailable(voiceHelper.isAvailable())

        binding.resultsTabs.onTabSelected = { tab -> viewModel.setTab(tab) }

        lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state -> render(state) }
            }
        }

        if (savedInstanceState == null && query.isNotBlank()) {
            viewModel.search(query)
            lifecycleScope.launch { history.add(query) }
        }
    }

    private fun render(state: ResultsUiState) {
        when (state.status) {
            is ResultsStatus.Idle -> {
                binding.latency.clear()
                binding.statusText.visibility = View.GONE
            }

            is ResultsStatus.Loading -> {
                binding.latency.showLoading()
                binding.statusText.visibility = View.GONE
                adapter.submitList(emptyList())
            }

            is ResultsStatus.Success -> {
                binding.statusText.visibility = View.GONE
                state.payload?.let { binding.latency.update(it.meta, it.results.size) }
                adapter.submitList(state.payload?.results.orEmpty())
            }

            is ResultsStatus.Empty -> {
                state.payload?.let { binding.latency.update(it.meta, 0) }
                adapter.submitList(emptyList())
                binding.statusText.visibility = View.VISIBLE
                binding.statusText.text = "No results for “${state.query}”. Try different words."
            }

            is ResultsStatus.Failed -> {
                adapter.submitList(emptyList())
                binding.latency.clear()
                binding.statusText.visibility = View.VISIBLE
                val error = state.error
                binding.statusText.text = if (error == null) {
                    "The search could not be completed."
                } else {
                    "${error.userMessage} ${error.message}".trim()
                }
            }
        }
    }

    private fun backToHome() {
        val popped = findNavController().popBackStack()
        if (!popped) (requireActivity() as MainActivity).showHome()
    }

    private val voiceHelper: VoiceSearchHelper by lazy {
        VoiceSearchHelper(
            activity = requireActivity() as ComponentActivity,
            onTranscript = { text ->
                binding.resultsSearchBar.setText(text)
                viewModel.search(text)
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

    private fun termsFor(query: String): List<String> =
        query.split(Regex("\\s+")).filter { it.length > 1 }.take(6)

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

    companion object {
        private const val ARG_QUERY = "query"

        fun newInstance(query: String): ResultsFragment = ResultsFragment().apply {
            arguments = bundleOf(ARG_QUERY to query)
        }
    }
}
