package com.eyesearch.app.profile

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.eyesearch.app.databinding.FragmentProfileBinding
import com.eyesearch.app.profile.history.HistoryActivity
import com.eyesearch.app.profile.history.HistoryRepository
import kotlinx.coroutines.launch

/**
 * Profile popover: the account placeholder (auth does not exist on the gateway
 * yet) plus the entry point to the full history screen.
 */
class ProfileFragment : DialogFragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val repository = HistoryRepository(requireContext())

        binding.btnHistory.setOnClickListener {
            startActivity(Intent(requireContext(), HistoryActivity::class.java))
            dismiss()
        }

        binding.btnClearHistory.setOnClickListener {
            lifecycleScope.launch {
                val count = repository.count()
                if (count == 0) {
                    dismiss()
                    return@launch
                }
                AlertDialog.Builder(requireContext())
                    .setTitle("Clear all history")
                    .setMessage("Clear all $count searches? This cannot be undone.")
                    .setNegativeButton(android.R.string.cancel, null)
                    .setPositiveButton(android.R.string.ok) { _, _ ->
                        lifecycleScope.launch { repository.clear() }
                    }
                    .show()
            }
        }

        binding.btnClose.setOnClickListener { dismiss() }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
