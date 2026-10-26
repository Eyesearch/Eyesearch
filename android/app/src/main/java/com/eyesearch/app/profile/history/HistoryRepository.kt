package com.eyesearch.app.profile.history

import android.content.Context
import com.eyesearch.app.core.database.AppDatabase
import com.eyesearch.app.core.database.LocalHistoryDao
import com.eyesearch.app.core.database.LocalHistoryEntity
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.TimeUnit

/** Time ranges offered by the history screen. */
enum class HistoryRange(val label: String, val windowMs: Long?) {
    LAST_24_HOURS("Last 24 Hours", TimeUnit.HOURS.toMillis(24)),
    LAST_WEEK("Last 1 Week", TimeUnit.DAYS.toMillis(7)),
    LAST_MONTH("Last 1 Month", TimeUnit.DAYS.toMillis(30)),
    LAST_YEAR("Last 1 Year", TimeUnit.DAYS.toMillis(365)),
    ALL("All Time (Clear All)", null),
}

/**
 * Search history, on device only.
 *
 * De-duplicates case-insensitively, keeps the newest 200, and supports deleting
 * a whole time range — the same five actions the web client offers.
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

    /** How many entries a range would delete, so the UI can confirm first. */
    suspend fun countIn(range: HistoryRange): Int = when (val window = range.windowMs) {
        null -> dao.count()
        else -> dao.countOlderThan(System.currentTimeMillis() - window)
    }

    /** @return number of deleted rows */
    suspend fun clearRange(range: HistoryRange): Int = when (val window = range.windowMs) {
        null -> {
            val count = dao.count()
            dao.clear()
            count
        }
        else -> dao.deleteOlderThan(System.currentTimeMillis() - window)
    }

    suspend fun clear() = dao.clear()

    suspend fun count(): Int = dao.count()

    companion object {
        const val DEFAULT_LIMIT = 200
    }
}
