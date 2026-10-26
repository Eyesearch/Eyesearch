package com.eyesearch.app.home.quicklinks

/** A curated shortcut on the home screen. India-first, matching the web client. */
data class QuickLinkModel(
    val id: String,
    val label: String,
    val url: String,
    val tile: String,
    val tint: Int,
) {
    companion object {
        val DEFAULT_LINKS: List<QuickLinkModel> = listOf(
            QuickLinkModel("wiki", "Wikipedia", "https://en.wikipedia.org", "W", 0xFF4A5568.toInt()),
            QuickLinkModel("knwiki", "ಕನ್ನಡ ವಿಕಿಪೀಡಿಯ", "https://kn.wikipedia.org", "ಕ", 0xFF7A5AF8.toInt()),
            QuickLinkModel("metro", "Namma Metro", "https://english.bmrc.co.in", "M", 0xFF0F9D58.toInt()),
            QuickLinkModel("irctc", "IRCTC", "https://www.irctc.co.in", "I", 0xFFC2410C.toInt()),
            QuickLinkModel("github", "GitHub", "https://github.com/Eyesearch", "G", 0xFF24292F.toInt()),
            QuickLinkModel("youtube", "YouTube", "https://www.youtube.com", "Y", 0xFFCC0000.toInt()),
            QuickLinkModel("prajavani", "ಪ್ರಜಾವಾಣಿ", "https://www.prajavani.net", "P", 0xFF1D4ED8.toInt()),
            QuickLinkModel("osm", "OpenStreetMap", "https://www.openstreetmap.org", "O", 0xFF0B7A75.toInt()),
        )
    }
}
