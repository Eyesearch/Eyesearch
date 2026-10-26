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

Build: `./gradlew :app:assembleDebug` (AGP 8.7.3, Kotlin 2.0.21, compileSdk 35,
minSdk 24). The gateway URL is a `buildConfigField` in `app/build.gradle.kts`.

Two behaviours are deliberately honest rather than faked: voice search needs a
system recogniser (`isAvailable()` is checked before the button is offered), and
camera capture stops at handing back a real image `Uri` — the gateway has no
vision endpoint, so the app says so instead of pretending to search by picture.
