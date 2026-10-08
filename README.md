# BGG App Backend

This service is the data layer behind my BoardGameGeek-powered applications. It handles external API ingestion, persistence, analytics, and the stable interfaces consumed by the front-end apps in this workspace.

## Overview

The backend exists to turn raw BoardGameGeek data into structured, reusable, app-ready payloads. Rather than forcing the client to interact directly with BGG’s XML APIs, the service centralizes the work of fetching, normalizing, storing, and aggregating data.

This keeps the front ends focused on user experience while the backend owns the operational complexity: authentication, network access, data transformation, caching, and derived analytics.

## Supported applications

- 2025 BG Wrapped
  - GitHub: https://github.com/James-Wilkinson-git/2025bgwrapped
  - Consumes play history and analytics endpoints to generate wrapped summaries and personal stats

- bgg-app
  - GitHub: https://github.com/James-Wilkinson-git/bgg-app
  - Consumes collection and discovery endpoints to browse a user’s library and newly indexed titles

## System responsibilities

This backend is responsible for several distinct layers:

- external data acquisition from BoardGameGeek
- XML parsing and schema normalization into application models
- persistence in MongoDB for reuse and performance
- analytics aggregation for display logic in the UI
- secure server-side handling of credentials and image proxies

## API surface

### GET /api/plays/:username

Fetches and stores a user’s plays for the active reporting period, normalizes the XML payload, and returns the structured play history.

This feeds the wrapped analytics experience in 2025 BG Wrapped.

### GET /api/analytics/:username/most-played

Aggregates a user’s play history into most-played titles and associated metadata, including categories, mechanics, designers, publishers, and artists.

This powers the ranking and summary cards in 2025 BG Wrapped.

### GET /api/analytics/:username/stats

Returns summary-level metrics such as total plays, unique games, monthly activity, and weighted age calculations.

This is the data foundation for the stats and summary views in the wrapped app.

### GET /api/analytics/popular-games

Computes community-level popularity metrics from the stored play dataset and returns the most played titles for comparative analysis.

This powers the community context in 2025 BG Wrapped.

### GET /api/bgg/collection/:username

Proxies the BGG collection endpoint through the backend so the client does not need to expose API credentials or interact directly with the raw BGG XML endpoint.

This is the collection-fetch layer used by bgg-app.

### GET /api/proxy-image

Serves remote images through the server to avoid browser-side CORS failures and provide a stable asset path for the apps.

This is used by the front ends when rendering thumbnails and media.

### GET /api/games/2026

Returns newly indexed game data from MongoDB and supports filtered discovery views for recent additions.

This powers the discovery workflow in bgg-app.

## Runnable scripts

The `scripts/` directory contains operational tools for game discovery, data-quality checks, reporting, and collection maintenance. Run commands from the backend directory after installing dependencies. Database scripts use `MONGODB_URI`; scripts that call the BGG XML API also require `BGG_API_KEY`. Scripts that read `.env` expect it in the backend directory.

### Ingestion and data enrichment

- `node scripts/recent.js` scrapes BGG's recent-additions pages and inserts newly seen game IDs with their `dateAdded` into `bgg.recentgames`. Requires `MONGODB_URI`; it makes external requests and writes records.
- `node scripts/scrape.js` runs the 2026 game-discovery scrape. It uses a browser to search BGG, adds unseen IDs to `bgg.2026games`, fetches game details, upserts records in `bgg.games`, and updates `bgg.meta` run metadata. Requires `MONGODB_URI` and `BGG_API_KEY`. `PUPPETEER_HEADLESS=true` requests headless mode; `PUPPETEER_CHANNEL=chrome` selects an installed Chrome browser.
- `node scripts/backfill-missing-thumbnails.js [--dry-run] [--limit=N]` finds games with missing or placeholder thumbnails and fetches replacement images from BGG. Requires `MONGODB_URI` and `BGG_API_KEY`. Use `--dry-run` to inspect without updating records and `--limit=N` to cap processing. The package alias is `npm run backfill-thumbnails -- --dry-run --limit=50`.

### ID migration and duplicate cleanup

These tools modify `bgg.games`. With various different ways of handling deduplication over the course of the project, each one a new one to preserve history.

- `node scripts/migrate-ids.js` converts parseable string `id` values to integers. It does not delete records or rebuild indexes. Requires `MONGODB_URI`.
- `node scripts/normalize-and-dedupe.js` drops the `id_1` index if present, converts parseable string IDs, removes duplicate-ID documents while retaining the oldest document, then attempts to recreate the unique ID index. Requires `MONGODB_URI`.
- `node scripts/remove-duplicates.js` drops `id_1` if present, converts eligible string IDs, deletes duplicate-ID documents while retaining the oldest, then attempts to recreate the unique ID index. Requires `MONGODB_URI`.
- `node scripts/fix-duplicates.js` drops `id_1` if present, deletes duplicate-ID documents while retaining the oldest, then attempts to recreate and verify the unique ID index. It does not normalize IDs. Requires `MONGODB_URI`.
- `node scripts/force-remove.js` drops every index except MongoDB's `_id` index, removes duplicate-ID documents while retaining the oldest, and creates a unique ID index. Requires `MONGODB_URI`. This is the broadest and highest-risk cleanup operation because it removes unrelated indexes and loads the full games collection into memory.

## Data flow

The backend establishes a clean separation of concerns:

1. the front end requests a specific resource from the API
2. the backend fetches and normalizes BoardGameGeek data
3. the result is persisted in MongoDB for reuse and analytics
4. the front end consumes a structured response instead of raw XML or third-party APIs directly

This makes the apps more resilient, easier to reason about, and less coupled to external provider behavior.

## Operational characteristics

This project demonstrates production-minded backend patterns:

- external API integration
- XML parsing and normalization
- database-backed caching and retrieval
- derived analytics generation
- credential handling on the server
- environment-based configuration for deployment
- CORS and asset proxying for client compatibility

## Tech stack

- Node.js
- Express
- MongoDB
- Axios
- xml2js
- CORS
- Render

## Deployment

The service is deployed on Render and uses environment variables for runtime configuration, including database connectivity and external API-related settings.

## Summary

This backend is a reusable data and analytics service supporting my BGG-powered applications. It encapsulates the operational complexity behind the front ends and provides the structured APIs required for collection browsing, trend analysis, and discovery workflows.
