package com.eyesearch.app.core.api

import com.eyesearch.app.core.util.Constants
import com.eyesearch.app.results.resultcards.SearchResultItem
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
 * The only place in the app that knows the gateway exists.
 *
 *   GET  /v1/search?q=&limit=   structured cards
 *   POST /v1/retrieve           token-optimised context (AI tab)
 *
 * Every call is a suspend function on Dispatchers.IO with a timeout, and returns
 * an [ApiResult] — success carries a [SearchResponse], failure carries an
 * [ApiError] the UI can render. Nothing throws at the call site.
 */
class SearchApiClient(
    private val baseUrl: String = Constants.API_BASE_URL,
    private val client: OkHttpClient = defaultClient(),
) {

    private val normalizedBase = baseUrl.trimEnd('/')

    suspend fun search(query: String, limit: Int = Constants.DEFAULT_LIMIT): ApiResult<SearchResponse> =
        withContext(Dispatchers.IO) {
            val url = "$normalizedBase${Constants.SEARCH_PATH}" +
                "?q=${encode(query)}&limit=${limit.coerceIn(1, Constants.MAX_LIMIT)}"
            execute(
                Request.Builder().url(url).get().header("Accept", "application/json").build(),
                query,
            )
        }

    suspend fun retrieve(query: String, limit: Int = Constants.DEFAULT_LIMIT): ApiResult<SearchResponse> =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("query", query)
                .put("format", "json")
                .put("limit", limit.coerceIn(1, Constants.MAX_LIMIT))
                .toString()
                .toRequestBody(JSON)
            execute(
                Request.Builder()
                    .url("$normalizedBase${Constants.RETRIEVE_PATH}")
                    .post(body)
                    .header("Accept", "application/json")
                    .build(),
                query,
            )
        }

    private fun execute(request: Request, fallbackQuery: String): ApiResult<SearchResponse> {
        val response = try {
            client.newCall(request).execute()
        } catch (error: IOException) {
            return ApiResult.Failure(ApiError.network(error.message ?: "network unavailable"))
        }

        response.use { result ->
            val raw = result.body?.string().orEmpty()
            val json = try {
                if (raw.isBlank()) JSONObject() else JSONObject(raw)
            } catch (error: Exception) {
                return ApiResult.Failure(
                    ApiError("internal", "gateway returned malformed JSON (HTTP ${result.code})"),
                )
            }

            if (!result.isSuccessful || json.has("error")) {
                val detail = json.optJSONObject("error")
                return ApiResult.Failure(
                    ApiError.fromCode(
                        code = detail?.optString("code"),
                        message = detail?.optString("message")?.takeIf { it.isNotBlank() } ?: "HTTP ${result.code}",
                        retryable = detail?.optBoolean("retryable", true) ?: true,
                    ),
                )
            }
            return ApiResult.Success(parseResponse(json, fallbackQuery))
        }
    }

    private fun parseResponse(json: JSONObject, fallbackQuery: String): SearchResponse {
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
        return SearchResponse(meta = meta, results = results)
    }

    private fun encode(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name())

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()

        private fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(Constants.CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(Constants.READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .callTimeout(Constants.CALL_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }
}
