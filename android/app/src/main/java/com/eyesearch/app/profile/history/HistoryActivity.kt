package com.eyesearch.app.profile.history

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.eyesearch.app.core.database.LocalHistoryEntity
import com.eyesearch.app.databinding.ActivityHistoryBinding
import kotlinx.coroutines.launch

/**
 * Full-screen search history.
 *
 * Every stored search with its relative time and a delete button, plus the five
 * time-range clears. Each destructive action confirms first, because the data is
 * local and there is no undo.
 */
class HistoryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHistoryBinding
    private lateinit var repository: HistoryRepository
    private lateinit var adapter: HistoryAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)
        repository = HistoryRepository(this)

        adapter = HistoryAdapter(
            onPick = { entity -> openSearch(entity.query) },
            onDelete = { entity ->
                lifecycleScope.launch {
                    repository.remove(entity.query)
                    refresh()
                }
            },
        )
        binding.historyList.layoutManager = LinearLayoutManager(this)
        binding.historyList.adapter = adapter
        binding.historyBack.setOnClickListener { finish() }

        buildRangeChips()
        refresh()
    }

    private fun buildRangeChips() {
        binding.rangeRow.removeAllViews()
        HistoryRange.entries.forEach { range ->
            val chip = Button(this).apply {
                text = range.label
                textSize = 12.5f
                isAllCaps = false
                setPadding(dp(16), dp(6), dp(16), dp(6))
                setOnClickListener { confirmClear(range) }
            }
            binding.rangeRow.addView(chip)
        }
    }

    private fun confirmClear(range: HistoryRange) {
        lifecycleScope.launch {
            val affected = repository.countIn(range)
            if (affected == 0) {
                announce("Nothing to clear for ${range.label.lowercase()}.")
                return@launch
            }
            val noun = if (affected == 1) "search" else "searches"
            val message = if (range.windowMs == null) {
                "Clear all $affected $noun? This cannot be undone."
            } else {
                "Clear $affected $noun older than ${range.label.removePrefix("Last ").lowercase()}?"
            }
            AlertDialog.Builder(this@HistoryActivity)
                .setTitle(range.label)
                .setMessage(message)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(android.R.string.ok) { _, _ ->
                    lifecycleScope.launch {
                        val removed = repository.clearRange(range)
                        announce("Cleared $removed ${if (removed == 1) "search" else "searches"}.")
                        refresh()
                    }
                }
                .show()
        }
    }

    private fun refresh() {
        lifecycleScope.launch {
            val entries = repository.recent()
            adapter.submitList(entries)
            binding.historyEmpty.visibility = if (entries.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
            binding.historyList.visibility = if (entries.isEmpty()) android.view.View.GONE else android.view.View.VISIBLE
        }
    }

    private fun announce(message: String) {
        binding.historyStatus.visibility = android.view.View.VISIBLE
        binding.historyStatus.text = message
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun openSearch(query: String) {
        startActivity(
            Intent(this, com.eyesearch.app.MainActivity::class.java)
                .setAction(Intent.ACTION_SEARCH)
                .putExtra(android.app.SearchManager.QUERY, query),
        )
        finish()
    }

    @Suppress("unused")
    private fun openUrl(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
