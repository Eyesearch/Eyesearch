package com.eyesearch.app.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * The only place in the app that knows the EyeSearch gateway exists.
 *
 * Two contracts, exactly like the web client:
 *   GET  /v1/search?q=&limit=   structured cards
 *   POST /v1/retrieve           token-optimised context (AI tab)
 *
 * Every call is a suspend function on Dispatchers.IO, has a timeout, and turns
 * transport and gateway errors into a typed [SearchError] so the UI can show
 * something honest instead of a stack trace.
 */
class SearchApiClient(
    private val baseUrl: String = DEFAULT_BASE_URL,
    private val client: OkHttpClient = defaultClient(),
) {

    private val normalizedBase = baseUrl.trimEnd('/')

    /** @throws SearchError */
    suspend fun search(query: String, limit: Int = DEFAULT_LIMIT): SearchPayload =
        withContext(Dispatchers.IO) {
            val url = "$normalizedBase/v1/search?q=${encode(query)}&limit=${limit.coerceIn(1, MAX_LIMIT)}"
            val request = Request.Builder()
                .url(url)
                .get()
                .header("Accept", "application/json")
                .build()
            execute(request, query)
        }

    /** @throws SearchError */
    suspend fun retrieve(query: String, limit: Int = DEFAULT_LIMIT): SearchPayload =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("query", query)
                .put("format", "json")
                .put("limit", limit.coerceIn(1, MAX_LIMIT))
                .toString()
                .toRequestBody(JSON)
            val request = Request.Builder()
                .url("$normalizedBase/v1/retrieve")
                .post(body)
                .header("Accept", "application/json")
                .build()
            execute(request, query)
        }

    private fun execute(request: Request, fallbackQuery: String): SearchPayload {
        val response = try {
            client.newCall(request).execute()
        } catch (error: IOException) {
            throw SearchError.Network(error.message ?: "network unavailable")
        }

        response.use { result ->
            val raw = result.body?.string().orEmpty()
            val json = try {
                if (raw.isBlank()) JSONObject() else JSONObject(raw)
            } catch (error: Exception) {
                throw SearchError.Unknown("gateway returned malformed JSON (HTTP ${result.code})")
            }

            if (!result.isSuccessful || json.has("error")) {
                val detail = json.optJSONObject("error")
                throw SearchError.fromCode(
                    code = detail?.optString("code"),
                    message = detail?.optString("message")?.takeIf { it.isNotBlank() }
                        ?: "HTTP ${result.code}",
                    retryable = detail?.optBoolean("retryable", true) ?: true,
                )
            }

            return parsePayload(json, fallbackQuery)
        }
    }

    private fun parsePayload(json: JSONObject, fallbackQuery: String): SearchPayload {
        val results = mutableListOf<SearchResultItem>()
        val array: JSONArray = json.optJSONArray("results") ?: JSONArray()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            val url = item.optString("url").orEmpty()
            if (url.isBlank()) continue
            results += SearchResultItem(
                id = item.optString("id").ifBlank { "result:$index" },
                title = item.optString("title").ifBlank { url },
                url = url,
                snippet = item.optString("snippet").orEmpty(),
                source = item.optString("source").ifBlank { "unknown" },
                kind = item.optString("kind").ifBlank { "web" },
                thumbnailUrl = item.optString("thumbnail_url").takeIf { it.isNotBlank() && it != "null" },
                posterUrl = item.optString("poster_url").takeIf { it.isNotBlank() && it != "null" },
            )
        }

        val providers = mutableMapOf<String, Int>()
        json.optJSONObject("providers")?.let { map ->
            map.keys().forEach { key -> providers[key] = map.optInt(key, 0) }
        }
        val failed = mutableListOf<String>()
        json.optJSONArray("failed_providers")?.let { list ->
            for (index in 0 until list.length()) {
                list.optString(index).takeIf { it.isNotBlank() }?.let(failed::add)
            }
        }

        val meta = SearchMeta(
            query = json.optString("query").ifBlank { fallbackQuery },
            tookMs = json.optLong("took_ms", -1L).takeIf { it >= 0 },
            degraded = json.optBoolean("degraded", false),
            cacheHit = json.optBoolean("cache_hit", false),
            providers = providers,
            failedProviders = failed,
            totalEstimate = json.optInt("total_estimate", -1).takeIf { it >= 0 },
        )
        return SearchPayload(meta = meta, results = results)
    }

    private fun encode(value: String): String =
        java.net.URLEncoder.encode(value, Charsets.UTF_8.name())

    companion object {
        const val DEFAULT_BASE_URL = "https://eyesearch-backend.onrender.com"
        const val DEFAULT_LIMIT = 10
        const val MAX_LIMIT = 50
        private val JSON = "application/json; charset=utf-8".toMediaType()

        private fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(14, TimeUnit.SECONDS)
            .callTimeout(16, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }
}

data class SearchResultItem(
    val id: String,
    val title: String,
    val url: String,
    val snippet: String,
    val source: String,
    val kind: String,
    val thumbnailUrl: String? = null,
    val posterUrl: String? = null,
)

data class SearchMeta(
    val query: String,
    val tookMs: Long? = null,
    val degraded: Boolean = false,
    val cacheHit: Boolean = false,
    val providers: Map<String, Int> = emptyMap(),
    val failedProviders: List<String> = emptyList(),
    val totalEstimate: Int? = null,
)

data class SearchPayload(
    val meta: SearchMeta,
    val results: List<SearchResultItem>,
)

/** Typed failures. `retryable` drives whether the UI offers a retry button. */
sealed class SearchError(message: String, val retryable: Boolean) : Exception(message) {
    class BadRequest(message: String) : SearchError(message, false)
    class RateLimited(message: String) : SearchError(message, true)
    class ProviderUnavailable(message: String) : SearchError(message, true)
    class Database(message: String) : SearchError(message, true)
    class Network(message: String) : SearchError(message, true)
    class Unknown(message: String) : SearchError(message, true)

    companion object {
        fun fromCode(code: String?, message: String, retryable: Boolean): SearchError = when (code) {
            "bad_request" -> BadRequest(message)
            "rate_limited" -> RateLimited(message)
            "provider_unavailable" -> ProviderUnavailable(message)
            "database_error" -> Database(message)
            "not_found" -> BadRequest(message)
            else -> if (retryable) Unknown(message) else BadRequest(message)
        }
    }
}
