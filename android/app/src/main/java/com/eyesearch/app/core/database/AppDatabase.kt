package com.eyesearch.app.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.eyesearch.app.profile.history.LocalHistoryDao

/**
 * The single Room database for the app.
 *
 * One instance per process, created lazily and reused — opening a database per
 * screen is the classic way to leak cursors and connections on Android.
 */
@Database(entities = [LocalHistoryEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun localHistoryDao(): LocalHistoryDao

    companion object {
        private const val NAME = "eyesearch.db"

        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    NAME,
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
