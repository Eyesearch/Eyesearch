# EyeSearch

Two clients, one gateway. The repository is split strictly into `web/` and
`android/`, and each side repeats the same four modules so a change in one is
easy to mirror in the other.

```
web/                                   android/ (app/src/main/java/com/eyesearch/app/)
├── index.html                         ├── MainActivity.kt
├── app.js            composition root ├── core/network/SearchApiClient.kt
├── base.css                           ├── home/searchbar/
├── config/api-config.js               ├── home/mediatools/
├── home/                              ├── home/quicklinks/
│   ├── search-input/                  ├── home/feedcards/
│   ├── media-tools/                   ├── menu/theme/
│   ├── quick-links/                   ├── menu/language/
│   └── feed-cards/                    ├── profile/auth/
├── menu/                              ├── profile/history/
│   ├── theme-selector/                ├── results/tabs/
│   └── language-selector/             ├── results/resultcards/
├── profile/                           └── results/metainfo/
│   ├── account/
│   └── local-history/
└── results/
    ├── nav-tabs/
    ├── result-cards/
    └── meta-info/
```

## Modules

| Module | Web | Android | What it does |
| --- | --- | --- | --- |
| home / search-input | `search-input.js` + `.css` | `SearchBarView.kt`, `SearchBarViewModel.kt` | Debounced search-as-you-type, Enter to search, clear, `/` and `Esc` shortcuts |
| home / media-tools | `mic-handler.js`, `lens-handler.js` | `VoiceSearchHelper.kt`, `CameraSearchHelper.kt` | Voice input; camera capture |
| home / quick-links | `quick-links.js` | `QuickLinksAdapter.kt` | Curated shortcut grid, India-first |
| home / feed-cards | `weather-card.js`, `news-card.js` | `HomeFeedAdapter.kt` | Live weather (Open-Meteo, keyless) and headlines from our own gateway |
| menu / theme-selector | `theme-toggle.js` | `ThemePreferences.kt` | System / Light / Dark, persisted |
| menu / language-selector | `lang-switcher.js` | `LocaleHelper.kt` | Kannada / English, persisted, `lang="kn"` applied to Kannada text |
| profile / account | `auth-placeholder.js` | `AccountPlaceholder.kt` | States plainly that auth does not exist yet |
| profile / local-history | `history-manager.js`, `clear-history.js` | `LocalHistoryDao.kt`, `HistoryRepository.kt` | Device-only history, de-duplicated, with a confirmed clear |
| results / nav-tabs | `tab-switcher.js` | `ResultsTabRow.kt` | ALL vs AI (AI = `/v1/retrieve`, the token-optimised payload) |
| results / result-cards | `web-card.js` + `card-renderer.css` | `ResultsAdapter.kt`, `ResultCardViewHolder.kt` | Title, breadcrumb, snippet with highlights, favicon fallback, media |
| results / meta-info | `latency-badge.js` | `LatencyIndicatorView.kt` | `5 results · found in 0.43s`, degraded and cached badges, provider names |

Two files sit outside the module tree because they are wiring, not features:
`web/app.js` (composition root, the counterpart of `MainActivity.kt`) and
`web/base.css` (design tokens and shared layout, the counterpart of the Android
theme attributes). Two module-level stylesheets live beside their module:
`home/search-input/search-input.css` and `results/result-cards/card-renderer.css`.

## Gateway

Both clients talk to the same backend — https://github.com/Eyesearch/Eyesearch-Backend
— currently deployed at `https://eyesearch-backend.onrender.com`:

- `GET /v1/search?q=&limit=&page=` — structured cards (web UI, Android results)
- `POST /v1/retrieve {query, format}` — token-optimised context (the AI tab)

Errors arrive as `{"error": {"code", "message", "retryable"}}`; both clients map
the code to a plain-language message and offer a retry only when it is retryable.

## Run the web client

```bash
cd web
python3 -m http.server 5173     # then open http://localhost:5173
```

No build step, no `node_modules`. `web/config/api-config.js` holds the API base
(and honours `window.EYESEARCH_API_BASE`, including `""` for same-origin, which
is how local development and the automated UI test point at a stub).

Deploy: Netlify and Vercel configs at the repository root publish `web/`;
Cloudflare Pages and any static host need the `web/` directory as the site root
(`web/_headers` carries the security and cache policy).

## Build the Android app

```bash
cd android
./gradlew :app:assembleDebug
```

AGP 8.7.3, Kotlin 2.0.21, KSP 2.0.21-1.0.28, compileSdk 34, targetSdk 34,
minSdk 24, JVM target 17. The Gradle wrapper (8.9) is committed, so no local
Gradle install is needed. The API base is a `buildConfigField` in
`android/app/build.gradle.kts`.

Launcher icons are pure vector resources — an adaptive icon for API 26+
(`res/mipmap-anydpi-v26/`) and a layer-list fallback for API 24–25
(`res/mipmap-anydpi/`) built from `res/drawable/ic_launcher_background.xml` and
`ic_launcher_foreground.xml`. No bitmaps, so no density folders to keep in sync.

### Debug APK from CI

`.github/workflows/android-build.yml` builds the debug APK on every push to
`main` that touches `android/**` (and on manual dispatch): JDK 17 Temurin,
`chmod +x gradlew`, `./gradlew :app:assembleDebug --stacktrace`, then uploads
`app-debug.apk` as the **EyeSearch-Debug-APK** artifact, downloadable from the
run's summary page.

## What is real, and what is not

Real: search, both result contracts, degraded/cached/provider reporting, theme
and language persistence, device history with de-duplication and a confirmed
clear, live weather, live headlines, keyboard shortcuts, Kannada rendering.

Not real yet, and said so in the UI rather than faked: **account sign-in** (no
auth endpoints on the gateway) and **visual search** (camera capture returns a
real image, but there is no vision endpoint, so both clients explain that
instead of returning invented results). Voice search depends on the platform:
Chrome/Edge on the web, a system recogniser on Android, and both disable the
control when it is unavailable.

## Verification

`web/` is covered by an integration suite that serves the real files over HTTP
against a stubbed gateway and drives headless Chromium — 41 assertions across the
home view, the results view, error/empty paths, XSS safety, and each module's
behaviour in isolation. The Android sources are a scaffold: they are structurally
complete but were not compiled in this environment (no Android SDK), so treat
`./gradlew assembleDebug` as the first thing to run.
