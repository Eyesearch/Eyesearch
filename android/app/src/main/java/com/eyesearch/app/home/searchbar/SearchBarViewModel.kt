package com.eyesearch.app.home.searchbar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eyesearch.app.core.network.SearchApiClient
import com.eyesearch.app.core.network.SearchError
import com.eyesearch.app.core.network.SearchPayload
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Which view of the results is showing. Mirrors the web UI's ALL / AI tabs. */
enum class ResultsTab { ALL, AI }

/**
 * Owns the search lifecycle: one in-flight request at a time, a monotonic token
 * so a slow response can never overwrite a newer one, and explicit loading /
 * empty / error states for the UI to render.
 */
class SearchBarViewModel(
    private val api: SearchApiClient = SearchApiClient(),
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private var inFlight: Job? = null
    private var token = 0

    fun onQueryChanged(query: String) {
        _state.value = _state.value.copy(query = query)
    }

    fun setTab(tab: ResultsTab) {
        val current = _state.value
        if (current.tab == tab) return
        _state.value = current.copy(tab = tab)
        if (current.query.isNotBlank() && current.status !is SearchStatus.Idle) {
            search(current.query, tab)
        }
    }

    fun search(query: String = _state.value.query, tab: ResultsTab = _state.value.tab) {
        val cleaned = query.trim().replace(Regex("\\s+"), " ")
        if (cleaned.length < MIN_CHARS) {
            _state.value = _state.value.copy(status = SearchStatus.Idle, payload = null)
            return
        }

        inFlight?.cancel()
        token += 1
        val myToken = token
        _state.value = _state.value.copy(query = cleaned, tab = tab, status = SearchStatus.Loading)

        inFlight = viewModelScope.launch {
            try {
                val payload = if (tab == ResultsTab.AI) api.retrieve(cleaned) else api.search(cleaned)
                if (myToken != token) return@launch
                val status = if (payload.results.isEmpty()) SearchStatus.Empty else SearchStatus.Success
                _state.value = _state.value.copy(status = status, payload = payload, error = null)
            } catch (error: SearchError) {
                if (myToken != token) return@launch
                _state.value = _state.value.copy(status = SearchStatus.Failed, error = error)
            }
        }
    }

    fun clear() {
        inFlight?.cancel()
        token += 1
        _state.value = SearchUiState()
    }

    companion object {
        const val MIN_CHARS = 2
    }
}

sealed interface SearchStatus {
    data object Idle : SearchStatus
    data object Loading : SearchStatus
    data object Success : SearchStatus
    data object Empty : SearchStatus
    data object Failed : SearchStatus
}

data class SearchUiState(
    val query: String = "",
    val tab: ResultsTab = ResultsTab.ALL,
    val status: SearchStatus = SearchStatus.Idle,
    val payload: SearchPayload? = null,
    val error: SearchError? = null,
) {
    val isLoading: Boolean get() = status is SearchStatus.Loading
}
