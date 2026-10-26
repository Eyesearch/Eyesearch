# EyeSearch — Android

Kotlin / Jetpack scaffold for the EyeSearch app. Same four modules as the web
client, one class per responsibility, talking to the same gateway.

```
app/src/main/java/com/eyesearch/app/
├── MainActivity.kt                 composition root (counterpart of web/app.js)
├── core/network/SearchApiClient.kt OkHttp + org.json, typed SearchError
├── home/searchbar/                 SearchBarView (debounced) + SearchBarViewModel (StateFlow)
├── home/mediatools/                VoiceSearchHelper (RecognizerIntent), CameraSearchHelper (FileProvider)
├── home/quicklinks/                QuickLinksAdapter
├── home/feedcards/                 HomeFeedAdapter (weather + headlines)
├── menu/theme/ThemePreferences.kt  System / Light / Dark via AppCompatDelegate
├── menu/language/LocaleHelper.kt   Kannada / English via per-app locales
├── profile/auth/AccountPlaceholder.kt
├── profile/history/                LocalHistoryDao (Room) + HistoryRepository
├── results/tabs/ResultsTabRow.kt   ALL / AI
├── results/resultcards/            ResultsAdapter + ResultCardViewHolder
└── results/metainfo/LatencyIndicatorView.kt
```

Build: `./gradlew :app:assembleDebug` — Gradle 8.9 wrapper committed, AGP 8.7.3,
Kotlin 2.0.21, KSP 2.0.21-1.0.28, compileSdk 34, targetSdk 34, minSdk 24, JVM 17.
The gateway URL is a `buildConfigField` in `app/build.gradle.kts`.

Resources: `res/mipmap-anydpi-v26/` holds the adaptive launcher icon,
`res/mipmap-anydpi/` the layer-list fallback for API 24–25, both composed from
`res/drawable/ic_launcher_{background,foreground}.xml` (vectors only).

CI: `.github/workflows/android-build.yml` at the repository root builds and
uploads the debug APK as the `EyeSearch-Debug-APK` artifact.

Two behaviours are deliberately honest rather than faked: voice search needs a
system recogniser (`isAvailable()` is checked before the button is offered), and
camera capture stops at handing back a real image `Uri` — the gateway has no
vision endpoint, so the app says so instead of pretending to search by picture.
