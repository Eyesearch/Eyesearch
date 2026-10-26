# backend/ — where the search engine lives

The proprietary indexing and crawler engine described in this phase is **not**
duplicated here. It is implemented in the gateway repository, which is the
service that actually runs it:

**https://github.com/Eyesearch/Eyesearch-Backend**

```
app/engine/     schema, HTML extraction, ranking, index store
app/crawler/    targeted crawler for Indian and regional domains
app/indexer/    ingestion pipeline + CLI
app/services/search_service.py   index-first routing
```

This repository (`Eyesearch/Eyesearch`) holds the two clients — `web/` and
`android/` — plus this pointer. Keeping one copy is deliberate: a second copy of
a crawler and an index drifts the moment either side is touched, and the gateway
is where the schema, the Turso credentials and the request path already live.

## What the engine does

**Schema** — created at gateway startup alongside the existing tables:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    url, title, snippet, content, language, updated_at UNINDEXED
);
```

with a `documents` row store (canonical URL, domain, title, snippet, clean body,
language, favicon, timestamps), `crawl_backlog` for queries the index could not
answer, and `crawl_queue` for URLs still to fetch.

**Crawler** — targeted rather than general: a seed list of Indian and regional
domains (`.gov.in`, `.nic.in`, Karnataka government, BMRC, ISRO, Kannada
Wikipedia, Prajavani, Deccan Herald, The Hindu Karnataka), robots.txt honoured,
one request at a time per host with a delay, a byte cap per page, a page budget
per seed, same-host links only, and a guard that refuses link-local hosts.

**Extraction** — title (falling back to `<h1>`), meta description, canonical URL,
favicon, and clean body text with navigation, footers, scripts and forms
removed. Kannada and Devanagari are detected by script.

**Ranking** — SQLite `bm25()` normalised to higher-is-better, blended with
exponential freshness decay (30-day half-life) and a host-trust term that
favours official and regional domains.

**Routing** — the index answers first:

```
documents_fts → (≥ INDEX_THRESHOLD) → source: "index"
             → (sparse) → Turso cache → external providers → source: "live"
                                    ↘ queue the query in crawl_backlog
```

Both `/v1/search` and `/v1/retrieve` now report `source` (`index` | `cache` |
`live`) and `index_hits`, and `/health` reports `index: {documents, backlog}`.

## Running it

```bash
# in the gateway repository
python -m app.indexer.pipeline --stats
python -m app.indexer.pipeline --seeds
python -m app.indexer.pipeline --query "namma metro timings"
python -m app.indexer.pipeline --backlog
```

Tuning is by environment variable: `INDEX_THRESHOLD`, `INDEX_FRESHNESS_WEIGHT`,
`CRAWL_ENABLED`, `CRAWL_MAX_PAGES_PER_SEED`, `CRAWL_MAX_DEPTH`,
`CRAWL_CONCURRENCY`, `CRAWL_DELAY_SECONDS`, `CRAWL_MAX_BYTES`,
`CRAWL_RESPECT_ROBOTS`, `INDEX_MAX_CONTENT_CHARS`.
