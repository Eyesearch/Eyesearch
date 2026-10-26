package com.eyesearch.app.profile.history

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * History queries, including the time-range deletes used by the history screen:
 * last 24 hours, last week, last month, last year, and everything.
 */
@Dao
interface LocalHistoryDao {

    @Query("SELECT * FROM search_history ORDER BY createdAt DESC LIMIT :limit")
    fun recent(limit: Int = 200): Flow<List<LocalHistoryEntity>>

    @Query("SELECT * FROM search_history ORDER BY createdAt DESC LIMIT :limit")
    suspend fun recentOnce(limit: Int = 200): List<LocalHistoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: LocalHistoryEntity)

    @Query("DELETE FROM search_history WHERE queryKey = :queryKey")
    suspend fun deleteByKey(queryKey: String)

    @Query("DELETE FROM search_history")
    suspend fun clear()

    /** Deletes everything older than [cutoff] (a Unix ms timestamp). */
    @Query("DELETE FROM search_history WHERE createdAt < :cutoff")
    suspend fun deleteOlderThan(cutoff: Long): Int

    @Query("SELECT COUNT(*) FROM search_history")
    suspend fun count(): Int

    @Query("SELECT COUNT(*) FROM search_history WHERE createdAt < :cutoff")
    suspend fun countOlderThan(cutoff: Long): Int
}
