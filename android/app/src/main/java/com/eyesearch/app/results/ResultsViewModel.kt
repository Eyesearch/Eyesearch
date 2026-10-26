package com.eyesearch.app.results

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eyesearch.app.core.api.SearchApiClient
import com.eyesearch.app.core.api.SearchError
import com.eyesearch.app.results.resultcards.SearchPayload
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Which view of the results is showing: the cards, or the AI context payload. */
enum class ResultsTab { ALL, AI }

sealed interface ResultsStatus {
    data object Idle : ResultsStatus
    data object Loading : ResultsStatus
    data object Success : ResultsStatus
    data object Empty : ResultsStatus
    data object Failed : ResultsStatus
}

data class ResultsUiState(
    val query: String = "",
    val tab: ResultsTab = ResultsTab.ALL,
    val status: ResultsStatus = ResultsStatus.Idle,
    val payload: SearchPayload? = null,
    val error: SearchError? = null,
) {
    val isLoading: Boolean get() = status is ResultsStatus.Loading
}

/**
 * Results screen state: one in-flight request at a time, a monotonic token so a
 * slow response can never overwrite a newer one, and explicit loading / empty /
 * error states for the view to render.
 */
class ResultsViewModel(
    private val api: SearchApiClient = SearchApiClient(),
) : ViewModel() {

    private val _state = MutableStateFlow(ResultsUiState())
    val state: StateFlow<ResultsUiState> = _state.asStateFlow()

    private var inFlight: Job? = null
    private var token = 0

    fun setTab(tab: ResultsTab) {
        val current = _state.value
        if (current.tab == tab) return
        _state.value = current.copy(tab = tab)
        if (current.query.isNotBlank() && current.status !is ResultsStatus.Idle) {
            search(current.query, tab)
        }
    }

    fun search(query: String = _state.value.query, tab: ResultsTab = _state.value.tab) {
        val cleaned = query.trim().replace(Regex("\\s+"), " ")
        if (cleaned.length < MIN_CHARS) {
            _state.value = _state.value.copy(status = ResultsStatus.Idle, payload = null)
            return
        }

        inFlight?.cancel()
        token += 1
        val myToken = token
        _state.value = _state.value.copy(query = cleaned, tab = tab, status = ResultsStatus.Loading)

        inFlight = viewModelScope.launch {
            try {
                val payload = if (tab == ResultsTab.AI) api.retrieve(cleaned) else api.search(cleaned)
                if (myToken != token) return@launch
                val status = if (payload.results.isEmpty()) ResultsStatus.Empty else ResultsStatus.Success
                _state.value = _state.value.copy(status = status, payload = payload, error = null)
            } catch (error: SearchError) {
                if (myToken != token) return@launch
                _state.value = _state.value.copy(status = ResultsStatus.Failed, error = error)
            }
        }
    }

    companion object {
        const val MIN_CHARS = 2
    }
}
