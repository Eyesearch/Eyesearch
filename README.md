# EyeSearch

Two clients, one gateway. The repository is split strictly into `web/` and
`android/`, and each side repeats the same four modules so a change in one is
easy to mirror in the other.

```
web/                                   android/ (app/src/main/java/com/eyesearch/app/)
├── index.html                         ├── MainActivity.kt
├── app.js            composition root ├── core/network/SearchApiClient.kt
├── core/database/AppDatabase.kt, LocalHistoryEntity.kt
├── webbridge/EyeSearchWebView.kt
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
| home / search-input | `search-input.js` + `.css` | `SearchBarView.kt` | Explicit search only (Enter or the button), inline mic/lens, clear, `/` and `Esc` shortcuts |
| home / media-tools | `mic-handler.js`, `lens-handler.js` | `VoiceSearchHelper.kt`, `CameraSearchHelper.kt` | Voice input; camera capture |
| home / quick-links | `quick-links.js` | `QuickLinksAdapter.kt` | Curated shortcut grid, India-first |
| home / feed-cards | `weather-card.js`, `news-card.js` | `WeatherCardView.kt`, `NewsFeedAdapter.kt` | Live weather (Open-Meteo, keyless) and headlines from our own gateway |
| menu / theme-selector | `theme-toggle.js` | `ThemePreferences.kt` | One toggle button, system default, persisted |
| menu / language-selector | `lang-switcher.js` | `LocaleHelper.kt` | English-only copy table (the switcher is gone; Kannada text still renders) |
| profile / account | `auth-placeholder.js` | `AccountPlaceholder.kt` | States plainly that auth does not exist yet |
| profile / local-history | `history-manager.js`, `clear-history.js`, `history-view.js` | `HistoryActivity.kt`, `HistoryAdapter.kt`, `LocalHistoryDao.kt`, `HistoryRepository.kt` | Timestamped device-only history: relative times, per-row delete, five time-range clears |
| results / nav-tabs | `tab-switcher.js` | `ResultsTabRow.kt` | ALL vs AI (AI = `/v1/retrieve`, the token-optimised payload) |
| results / result-cards | `web-card.js` + `card-renderer.css` | `ResultsAdapter.kt`, `ResultCardViewHolder.kt` | 4-sided cards: breadcrumb + favicon, clickable title, highlighted snippet, media |
| results / meta-info | `latency-badge.js` | `LatencyIndicatorView.kt` | `5 results · found in 0.43s`, degraded and cached badges, provider names |

Two files sit outside the module tree because they are wiring, not features:
`web/app.js` (composition root, the counterpart of `MainActivity.kt`) and
`web/base.css` (design tokens and shared layout, the counterpart of the Android
theme attributes). Two module-level stylesheets live beside their module:
`home/search-input/search-input.css` and `results/result-cards/card-renderer.css`.

## Web behaviour

- **Results header**: back arrow at the left, the `eyesearch` wordmark centred,
  theme toggle and profile at the right. Below it a full search bar carrying the
  current query (editable, with clear, inline mic/lens and the search button),
  then the `All` / `AI` tabs, then the latency and provider line.
- **4-sided result cards**: each result is its own box — `border: 1px solid`,
  `border-radius: 12px`, `padding: 16px`, `margin-bottom: 16px`, its own
  background — with favicon + domain breadcrumb, clickable title and snippet.
- **Full history screen**: opened from the profile popover, with a back arrow,
  five time-range clears (last 24 hours, last week, last month, last year, all
  time), per-row relative time ("2 hours ago") and a delete button. Entries are
  stored in `localStorage` as `{ query, at }` with `at` a Unix timestamp in ms.

## Own index (crawler + indexer)

The gateway now answers from its own FTS5 index before touching any external
provider, and queues the queries it could not answer for the crawler. That engine
lives in the gateway repository — see `backend/README.md` here for the schema,
the crawl policy and the routing contract, or go straight to
https://github.com/Eyesearch/Eyesearch-Backend (`app/engine/`, `app/crawler/`,
`app/indexer/`).

## Gateway

Both clients talk to the same backend — https://github.com/Eyesearch/Eyesearch-Backend
— deployed on the VM at `https://eyesearch.duckdns.org`:

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

Deploy: `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on every
push that touches it, so `https://eyesearch.github.io/Eyesearch/` serves the
search UI directly. Netlify and Vercel configs at the repository root also point
at `web/`; Cloudflare Pages and any static host need the `web/` directory as the
site root (`web/_headers` carries the security and cache policy). A root
`index.html` redirects to `./web/` for hosts that serve the repository root
instead of the app directory.

### Installable app (PWA)

`web/manifest.json` declares the standalone app (name, `./index.html` start URL,
`#121212` theme and background, the vector eye icon as `any maskable`).
`web/sw.js` precaches the shell and every module (23 entries), serves static
assets cache-first, uses network-first for navigations with an offline shell
fallback, and never touches `/v1/*` — search results are always live. The worker
is registered from `app.js` on `load`, guarded by a `serviceWorker` check, so the
app works normally without it. Every path in the shell is relative (`./`), which
is what lets the whole thing run under the Pages subpath `/Eyesearch/web/`.

### Native architecture

Fragments over one activity, with real XML layouts:

```
home/     HomeFragment, HomeViewModel, searchbar/SearchBarView,
          quicklinks/(QuickLinkModel, QuickLinksAdapter), feedcards/(WeatherCardView, NewsFeedAdapter)
results/  ResultsFragment, ResultsViewModel, tabs/ResultsTabRow,
          resultcards/(SearchResultItem, ResultsAdapter, ResultCardViewHolder), metainfo/LatencyIndicatorView
profile/  ProfileFragment, history/(HistoryActivity, HistoryAdapter, LocalHistoryEntity,
          LocalHistoryDao, HistoryRepository)
menu/     theme/ThemePreferences
core/     api/SearchApiClient, database/AppDatabase
```

Layouts: `fragment_home.xml`, `fragment_results.xml` (back arrow, centred
wordmark, search bar, All/AI tabs, RecyclerView), `item_search_result.xml`
(MaterialCardView, `cardCornerRadius="12dp"`, `strokeWidth="1dp"`),
`activity_history.xml` (five range chips + list), plus `activity_main.xml`,
`fragment_profile.xml`, `item_history.xml`, `item_news.xml`, `item_quick_link.xml`.

### Native behaviour

`MainActivity` is edge-to-edge (inset-aware padding, no title bar) and handles
home ↔ results navigation itself: hardware/gesture back returns to the hero from
results, and from the hero it exits. It also answers `android.intent.action.WEB_SEARCH`
and `ACTION_SEARCH` (query in `SearchManager.QUERY`), plus the
`eyesearch://search?q=` deep link, so the app can act as the device's search
target. `webbridge/EyeSearchWebView.kt` embeds the hosted web client behind a
toolbar action, opening any third-party link in the user's browser.

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

`.github/workflows/android-build.yml` builds **both** APKs on every push to
`main` that touches `android/**` (and on manual dispatch): JDK 17 Temurin,
`chmod +x gradlew`, `./gradlew :app:assembleDebug`, then
`./gradlew :app:assembleRelease`. It uploads `app-debug.apk` as
**EyeSearch-Debug-APK** and the unsigned release APK as
**EyeSearch-Release-APK**, both downloadable from the run's summary page.

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
