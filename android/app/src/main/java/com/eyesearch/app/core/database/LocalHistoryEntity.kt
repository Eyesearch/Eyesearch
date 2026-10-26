package com.eyesearch.app.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One stored search. Device-local only — nothing leaves the phone, and clearing
 * history is a real delete.
 *
 * `queryKey` is the lower-cased query and is the primary key, so typing the same
 * search twice replaces the row instead of duplicating it.
 */
@Entity(tableName = "search_history")
data class LocalHistoryEntity(
    @PrimaryKey val queryKey: String,
    val query: String,
    val createdAt: Long,
)
