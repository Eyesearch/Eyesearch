package com.eyesearch.app.home.mediatools

import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import java.io.File

/**
 * Camera / gallery input.
 *
 * The gateway has no vision endpoint yet, so this helper's job stops at handing
 * back a real image [Uri] and its [File]; the UI decides what to say about it
 * rather than pretending an image search happened.
 */
class CameraSearchHelper(
    private val activity: ComponentActivity,
    private val onImageReady: (Uri, File) -> Unit,
    private val onCancelled: () -> Unit,
    private val onFailed: (String) -> Unit,
) {

    private var currentFile: File? = null
    private var currentUri: Uri? = null

    private val captureLauncher: ActivityResultLauncher<Uri> =
        activity.registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            val file = currentFile
            val uri = currentUri
            if (success && file != null && uri != null) onImageReady(uri, file) else onCancelled()
        }

    fun isAvailable(): Boolean {
        val intent = android.content.Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE)
        return intent.resolveActivity(activity.packageManager) != null
    }

    /** Launches the camera, writing into the app cache through a FileProvider. */
    fun capture() {
        if (!isAvailable()) {
            onFailed("This device has no camera app.")
            return
        }
        try {
            val directory = File(activity.cacheDir, "captures").apply { mkdirs() }
            val file = File(directory, "capture-${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                file,
            )
            currentFile = file
            currentUri = uri
            captureLauncher.launch(uri)
        } catch (error: Exception) {
            onFailed(error.message ?: "The camera could not be opened.")
        }
    }
}
