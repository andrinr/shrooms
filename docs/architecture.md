# Architecture

> Current release: saved spots use browser local storage with JSON import/export. Account endpoints are retired (HTTP 410). Account implementation details below document the preserved legacy system, not an available user feature.


## One deployable service

Caddy terminates HTTPS and proxies to a Node 24 process. Node serves the packaged frontend, compressed geodata, a shared weather cache and account APIs. SQLite stores users, sessions and private spots in a persistent volume. There are no runtime npm dependencies.

The frontend remains plain JavaScript and Leaflet. It discovers `/api/config`; on static hosts it falls back to bundled script envelopes. Both modes use the same species, scoring and weather modules. Geometry is fetched only for the visible region. Property indexes are loaded per selected canton, with a separate national overview.

Backend data responses use gzip and ETags, with a 64 MB response cache and at most three parsed regional indexes. Zürich's index stays available. The model operates on existing source values; 50 m cells do not imply 50 m weather or calibrated forecasts.

## Weather

One process refreshes all national and Zürich anchors every six hours in bounded provider batches. Concurrent refresh calls share one promise. Only complete snapshots are atomically persisted. Failures retain the previous snapshot and retry after 15 minutes. API reads use the cache; old weather drops out of scoring after 48 hours.

Static deployments can update their bundled snapshots with `npm run weather:refresh`; they do not run a scheduler. Missing national host-tree and canopy values remain null.

## Accounts and privacy

Passwords use salted scrypt. Recovery codes and cookie tokens are hashed before storage. Sessions use HttpOnly cookies, origin checks and CSRF tokens. Queries always scope spots to the authenticated user; account deletion cascades through sessions and spots. Recovery revokes old sessions and rotates the recovery code. The recovery code is the only reset method.

No public profile or shared spot feed is implemented. Private means inaccessible to other application users; the server operator and anyone with database/backup access can read stored notes and locations. There is no end-to-end encryption. Browser exports are user-controlled JSON downloads.

## Future community features

Keep public observations separate from private notebook records. Add explicit per-observation sharing consent, optional location coarsening, moderation/reporting, deletion rules and abuse controls before exposing a feed. Never turn existing private spots public during a migration. UUID user/spot identifiers and a versioned SQLite schema provide a base for this work; a later PostgreSQL migration is possible when concurrency justifies it.

## Operational boundaries

This release targets one modest server. SQLite WAL permits concurrent reads, but writes and spatial queries share a process. Large indexes are synchronous to load and can briefly block requests; cached normal use avoids repeated loads. Scaling beyond a small community should move spatial indexing and background work into dedicated services. Backups and server patching remain operator responsibilities. CI exercises data integrity, authorization, weather failure handling, container startup and database backup integrity.
