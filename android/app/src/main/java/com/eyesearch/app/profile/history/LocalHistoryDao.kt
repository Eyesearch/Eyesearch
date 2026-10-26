package com.eyesearch.app.profile.history

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.eyesearch.app.core.database.LocalHistoryEntity
import kotlinx.coroutines.flow.Flow

/**
 * History queries. The entity lives in core/database so the DAO and the database
 * agree on one schema definition.
 */
@Dao
interface LocalHistoryDao {

    @Query("SELECT * FROM search_history ORDER BY createdAt DESC LIMIT :limit")
    fun recent(limit: Int = 40): Flow<List<LocalHistoryEntity>>

    @Query("SELECT * FROM search_history ORDER BY createdAt DESC LIMIT :limit")
    suspend fun recentOnce(limit: Int = 40): List<LocalHistoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: LocalHistoryEntity)

    @Query("DELETE FROM search_history WHERE queryKey = :queryKey")
    suspend fun deleteByKey(queryKey: String)

    @Query("DELETE FROM search_history")
    suspend fun clear()

    @Query("SELECT COUNT(*) FROM search_history")
    suspend fun count(): Int
}
