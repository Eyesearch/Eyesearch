package com.eyesearch.app.profile.history

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/** One stored search. Device-local only — nothing leaves the phone. */
@Entity(tableName = "search_history")
data class HistoryEntry(
    @PrimaryKey val queryKey: String,
    val query: String,
    val createdAt: Long,
)

@Dao
interface LocalHistoryDao {

    @Query("SELECT * FROM search_history ORDER BY createdAt DESC LIMIT :limit")
    fun recent(limit: Int = 40): Flow<List<HistoryEntry>>

    @Query("SELECT * FROM search_history ORDER BY createdAt DESC LIMIT :limit")
    suspend fun recentOnce(limit: Int = 40): List<HistoryEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: HistoryEntry)

    @Query("DELETE FROM search_history WHERE queryKey = :queryKey")
    suspend fun deleteByKey(queryKey: String)

    @Query("DELETE FROM search_history")
    suspend fun clear()

    @Query("SELECT COUNT(*) FROM search_history")
    suspend fun count(): Int
}

@Database(entities = [HistoryEntry::class], version = 1, exportSchema = false)
abstract class EyeSearchDatabase : RoomDatabase() {

    abstract fun historyDao(): LocalHistoryDao

    companion object {
        @Volatile
        private var instance: EyeSearchDatabase? = null

        fun get(context: Context): EyeSearchDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    EyeSearchDatabase::class.java,
                    "eyesearch.db",
                ).fallbackToDestructiveMigration().build().also { instance = it }
            }
    }
}
