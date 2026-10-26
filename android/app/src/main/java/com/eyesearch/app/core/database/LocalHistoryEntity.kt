package com.eyesearch.app.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One stored search, with a Unix timestamp in milliseconds.
 *
 * Device-local only — nothing leaves the phone, and clearing is a real delete.
 * `queryKey` (the lower-cased query) is the primary key, so re-running a search
 * refreshes its timestamp instead of duplicating the row.
 */
@Entity(tableName = "search_history")
data class LocalHistoryEntity(
    @PrimaryKey val queryKey: String,
    val query: String,
    val createdAt: Long,
)
