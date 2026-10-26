# EyeSearch — Web UI

The search front end for the EyeSearch gateway: a minimal, fast, dependency-free
single page that talks to `GET /v1/search` and renders result cards.

- Backend / API: https://github.com/Eyesearch/Eyesearch-Backend
- Gateway this build points at: `https://eyesearch-backend.onrender.com`

There is no build step and no `node_modules`. `index.html`, `assets/` and the
deploy configs are the whole application, so it deploys unchanged to Vercel,
Netlify, Cloudflare Pages, GitHub Pages, or any static host — including
`python3 -m http.server`.

## What it does

- **Central search bar**, Google/Perplexity-like: pill shape, clear button,
  visible focus ring, `Enter` to search, `/` to focus, `Esc` to clear.
- **Search-as-you-type** with a 320 ms debounce and a 2-character minimum, so a
  keystroke never costs a request. In-flight requests are aborted when the query
  changes, so a slow response cannot overwrite a newer one.
- **Result cards**: clickable title, domain breadcrumb (host + up to two path
  segments), snippet with the query terms highlighted, favicon with a two-step
  fallback and finally a letter tile, media thumbnail when the API supplies a
  `thumbnail_url`/`poster_url`, and a content-kind chip (Video, News, PDF…).
- **Latency indicator**: `10 results · found in 0.42s`, taken from the API's
  `took_ms`.
- **Honest partial results**: when the gateway reports `degraded`, a badge names
  the providers that failed. `cache_hit` shows as a `Cached` badge.
- **Loading skeletons** instead of a spinner, **empty state** with the query
  echoed back, and an **error state** that maps the gateway's error codes
  (`provider_unavailable`, `rate_limited`, `bad_request`…) to plain language and
  offers a retry.
- **Kannada and English**: Inter for Latin text, Noto Sans Kannada for Kannada,
  with `lang="kn"` applied automatically to any Kannada title or snippet so the
  browser picks the right face and screen readers switch voice.
- **Shareable URLs**: `?q=` is kept in sync with `pushState`, and back/forward
  work.
- **Responsive and accessible**: mobile-first layout, skip link, `aria-live`
  status, `aria-busy` on the result list, keyboard-only operation,
  `prefers-reduced-motion` and `prefers-contrast` support, and a dark theme that
  follows the OS.

## Configuration

Everything runtime-configurable lives in `assets/config.js`:

```js
window.EYESEARCH_CONFIG = {
  apiBase: "https://eyesearch-backend.onrender.com", // "" = same origin
  limit: 10,        // 1-50, server caps it
  debounce: 320,    // ms after the last keystroke
  minChars: 2,      // shortest query that triggers a search
};
```

Point `apiBase` at your own deployment, or set it to `""` when the UI is served
from the same origin as the API. No rebuild is needed — edit the file and
redeploy the static bundle.

The gateway already allows all origins (CORS `*`), so no proxy is required.
Because Render's free tier sleeps when idle, the very first search after a quiet
period can take several seconds while the instance wakes; the UI shows skeletons
for as long as that takes and then renders normally.

## Run locally

```bash
python3 -m http.server 5173
# open http://localhost:5173
```

To search against a local backend instead, set `apiBase` to
`http://localhost:8000` in `assets/config.js`.

## Deploy

| Host | How |
| --- | --- |
| Vercel | Import the repo. Framework preset: **Other**. No build command, output directory `.` (honoured by `vercel.json`). |
| Netlify | Import the repo, or `netlify deploy --prod`. `netlify.toml` sets publish `.` and no build. |
| Cloudflare Pages | Connect the repo. Build command: none. Output directory: `/`. `_headers` applies the security and cache policy. |
| GitHub Pages | Settings → Pages → deploy from branch `main`, folder `/ (root)`. |
| Any static host | Upload `index.html`, `assets/`, `robots.txt`. |

`index.html` and the assets carry cache headers that force revalidation of the
HTML, so a deploy is picked up immediately, while `assets/` may be cached for an
hour.

## API contract used

```
GET {apiBase}/v1/search?q={query}&limit={limit}
```

```json
{
  "query": "isro",
  "page": 1,
  "limit": 10,
  "total_estimate": 24,
  "took_ms": 412,
  "degraded": false,
  "cache_hit": false,
  "providers": { "duckduckgo": 8, "bing": 2 },
  "results": [
    {
      "id": "duckduckgo:8f2a1c9d04",
      "title": "Indian Space Research Organisation",
      "url": "https://www.isro.gov.in/",
      "snippet": "The space agency of India…",
      "source": "duckduckgo",
      "kind": "web",
      "poster_url": null,
      "thumbnail_url": null,
      "published_at": null,
      "score": 1.0
    }
  ]
}
```

Errors arrive as `{"error": {"code": "...", "message": "...", "retryable": true}}`
with `code` in `bad_request`, `rate_limited`, `provider_unavailable`,
`database_error`, `not_found`, `internal`.

Fields the UI tolerates being absent: `degraded`, `cache_hit`, `providers`,
`kind`, `thumbnail_url`, `poster_url`, `took_ms`. Only `results[].url` is
required for a card to render; a result without a title falls back to its URL.

## Files

```
index.html            markup, templates for result cards and skeletons
assets/styles.css     design tokens, light/dark, layout, skeletons
assets/app.js         search state, fetch/abort, rendering, URL sync
assets/config.js      apiBase, limit, debounce, minChars
assets/favicon.svg    icon
netlify.toml · vercel.json · _headers   deploy and cache policy
robots.txt
```

`window.EyeSearchUI.search("query")` is exposed so the page can be driven from
other scripts or a test harness.
