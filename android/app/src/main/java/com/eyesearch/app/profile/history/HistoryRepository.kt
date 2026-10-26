package com.eyesearch.app.profile.history

import android.content.Context
import com.eyesearch.app.core.database.AppDatabase
import com.eyesearch.app.core.database.LocalHistoryEntity
import kotlinx.coroutines.flow.Flow

/**
 * Search history, on device only.
 *
 * De-duplicates case-insensitively (the same query typed twice is one entry) and
 * keeps the newest 40. Clearing is a real delete — there is no server copy.
 */
class HistoryRepository(
    private val dao: LocalHistoryDao,
    private val limit: Int = DEFAULT_LIMIT,
) {

    constructor(context: Context) : this(AppDatabase.get(context).localHistoryDao())

    fun observeRecent(): Flow<List<LocalHistoryEntity>> = dao.recent(limit)

    suspend fun recent(): List<LocalHistoryEntity> = dao.recentOnce(limit)

    suspend fun add(query: String) {
        val cleaned = query.trim().replace(Regex("\\s+"), " ")
        if (cleaned.length < 2) return
        dao.upsert(
            LocalHistoryEntity(
                queryKey = cleaned.lowercase(),
                query = cleaned,
                createdAt = System.currentTimeMillis(),
            ),
        )
    }

    suspend fun remove(query: String) = dao.deleteByKey(query.trim().lowercase())

    suspend fun clear() = dao.clear()

    suspend fun count(): Int = dao.count()

    companion object {
        const val DEFAULT_LIMIT = 40
    }
}
