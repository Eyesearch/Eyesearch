package com.eyesearch.app.home.mediatools

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import java.util.Locale

/**
 * Voice search via the system recogniser (RecognizerIntent).
 *
 * Using the platform intent means no bundled speech model and no extra
 * dependency; the trade-off is that a device without a recognition service
 * simply cannot do it, which [isAvailable] reports so the button can be hidden.
 */
class VoiceSearchHelper(
    private val activity: ComponentActivity,
    private val onTranscript: (String) -> Unit,
    private val onUnavailable: (String) -> Unit,
) {

    private val speechLauncher: ActivityResultLauncher<Intent> =
        activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode != Activity.RESULT_OK) {
                onUnavailable("Voice search was cancelled.")
                return@registerForActivityResult
            }
            val spoken = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
                ?.trim()
                .orEmpty()
            if (spoken.isNotBlank()) onTranscript(spoken) else onUnavailable("Nothing was recognised.")
        }

    private val permissionLauncher: ActivityResultLauncher<String> =
        activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) launchRecogniser() else onUnavailable("Microphone permission was denied.")
        }

    /** True when the device has a speech recognition service. */
    fun isAvailable(): Boolean {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
        return intent.resolveActivity(activity.packageManager) != null
    }

    fun start(languageTag: String = Locale.getDefault().toLanguageTag()) {
        if (!isAvailable()) {
            onUnavailable("This device has no speech recognition service.")
            return
        }
        val granted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) launchRecogniser(languageTag) else permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }

    private fun launchRecogniser(languageTag: String = Locale.getDefault().toLanguageTag()) {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your search")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        try {
            speechLauncher.launch(intent)
        } catch (error: Exception) {
            onUnavailable(error.message ?: "Voice search could not start.")
        }
    }
}
