package com.eyesearch.app.core.api

/**
 * Every network call returns one of these, so callers handle failure explicitly
 * instead of catching exceptions at the call site.
 */
sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>
    data class Failure(val error: ApiError) : ApiResult<Nothing>

    val isSuccess: Boolean get() = this is Success

    fun dataOrNull(): T? = (this as? Success)?.data
}

/** A typed, user-presentable failure. `retryable` drives the retry affordance. */
data class ApiError(
    val code: String,
    val message: String,
    val retryable: Boolean = true,
) {
    val userMessage: String
        get() = when (code) {
            "provider_unavailable" -> "The search providers are not responding."
            "rate_limited" -> "Too many searches right now."
            "database_error" -> "The search index is unavailable."
            "bad_request" -> "That query could not be understood."
            "network" -> "Can't reach the search gateway. Check your connection."
            else -> "The search could not be completed."
        }

    companion object {
        fun fromCode(code: String?, message: String, retryable: Boolean): ApiError =
            ApiError(code = code ?: "internal", message = message, retryable = retryable)

        fun network(message: String) = ApiError("network", message, retryable = true)
    }
}
