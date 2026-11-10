# IPTV synchronization — current implementation and limits

## Implemented: durable full-export metadata imports

`XtreamCatalogSyncService` is registered in AdminModule. The existing same-origin admin proxy accepts its path segments; no proxy configuration or public UI changes are needed.

- `POST /admin/xtream-servers/:id/catalog-sync`: import an operator-supplied authorized full export.
- `GET /admin/xtream-servers/:id/catalog-sync`: safe counts, revision, lastSuccessAt, lastFailureAt, last 20 outcomes.
- Both routes: AdminJwtGuard + xtream:manage permission; UUID validation; server-side tenant scope; no-store. Global main.ts limiter applies in normal production bootstrap.
- Write body: `{ authorizationConfirmed: true, catalog: { live: [], movie: [], series: [], liveCategory: [], movieCategory: [], seriesCategory: [] } }`.
- Rows: `{ id: string|integer, name: string, categoryId?: string|integer }`. These are normalized-export fields, NOT a claim that arbitrary raw Xtream responses use this shape. An online adapter is still needed.
- All six arrays required. A malformed/partial source is a failure, never a successful empty catalog. Empty complete export deliberately removes all staged metadata; caller must supply the authorization acknowledgement. This does not delete Titles, subscriptions, favorites, or production rows.
- Item identifiers are scoped to server and content kind. Equal provider IDs never imply the same content across providers. No automatic cross-provider playback failover is attempted.
- Maximum 10,000 items and 1 MiB normalized JSON; names/identifiers validated; unknown fields discarded. Never stores or returns provider passwords, usernames, raw URLs or playback links from input fields. Do not include secrets in metadata names: arbitrary text cannot prove provenance or licensing.
- Database transaction uses pg_try_advisory_xact_lock(hashtext(serverId)); competing imports on the same provider return 409, including across application processes. No network request occurs while holding a transaction. Hash collisions conservatively serialize unrelated servers.
- Atomic state update: catalog + revision + success timestamp + diff counts + bounded history. Failed normalization commits a FAILED event/timestamp while retaining the last valid catalog, then responds 400.
- Disabled/missing/cross-tenant servers rejected. A retry is an explicit repeat import; no unbounded automatic retry loop.

## Storage and migration

Adds Prisma model/table `XtreamCatalogSnapshot` (33 total models). It belongs to XtreamServer via a cascading foreign key, not a separate database. JSON snapshots are staging metadata, not duplicated canonical Titles or an invented production catalog.

Migration `20261108010000_xtream_catalog_snapshot` is additive, enables RLS, revokes PUBLIC access, and creates no direct-browser policies. Existing Supabase role/default-privilege grants must be reviewed before production apply; RLS denies non-bypass roles without policies. The backend needs a reviewed privileged connection. Rollback drops only the new staging table/history and therefore requires explicit approval and a backup; it preserves provider rows. **Not applied to production.**

## Executed evidence

- 15 unit/fixture service checks cover normalization, duplicate/malformed/size limits, diffs, source scope, acknowledgement, lock conflict, failure preservation and bounded history.
- Real isolated PG17 checks exercise persistence across two providers with equal IDs, added/changed/removed deltas, failed history preserving last success, tenant escape, cross-connection advisory locking, and rollback/reapply preserving providers.
- Real Nest HTTP + real PG + real signed admin JWT/DB roles: missing auth 401, missing permission 403 even with forged token permission, other-tenant staff 404, authorized import/status succeed. Not Supabase admin consolidation or a deployed admin UI test.
- Entire real-PG runner now has 20 checks; WASM engine, clearly separate from blocked native verification.

## NOT IMPLEMENTED / BLOCKED

- Direct authenticated provider catalog pulling and raw Xtream normalization adapter.
- Scheduled synchronization, durable job retries, distributed worker queue, failure notifications.
- Admin import/status controls in the visible panel (API exists; no UI redesign added).
- Seasons/episodes enrichment and playable stream resolution from staged imports.
- Real-provider verification/rights validation and live playback.

`redchicks.xyz` remains **BLOCKED — ORIGIN UNAVAILABLE / AUTHORIZATION UNVERIFIED**. This phase never contacts it. No scheduler or automatic remote probe was enabled. Existing server configuration/priority/default controls and health monitoring remain intact.

## Health hardening in this phase

Provider checks now reject private/reserved IPv4 and non-global/transition IPv6, preflight all DNS answers with a 2s deadline, and consume success responses with a 64 KiB byte cap while streaming (including undeclared/chunked bodies). Redirects remain refused; failures cancel bodies. Unit fixtures validate DNS/private address rejection. Fetch still performs its own DNS resolution: a rebinding window remains, so egress isolation or pinned connection lookup is still required for fully hostile-provider safety. Existing HTTP opt-in is legacy compatibility, not secure transport verification; no HTTP fallback was introduced.
