# FEATURE_STATUS.md — Cloud Play Iraq

**Date:** 2026-11-08 · **Branch:** `arena/4974524d-cloud-play` · **Base:** `b125cbe` (PR #21, live in production)

Every feature below is classified from **code that was read** and **commands that were actually run** in this
workspace. Nothing here is inferred from a filename, a roadmap, or a previous report.

Classification key:

| Label | Meaning |
|---|---|
| ✅ **Complete + tested** | Implemented, wired into the live site, and covered by a test that was run here |
| 🔌 **Implemented, not integrated** | Real code exists, but the deployed site never calls it |
| 🟡 **Partial** | Works for some cases; named gaps remain |
| 🎨 **UI-only** | Interface exists without a real data source behind it |
| ❌ **Missing** | No implementation |
| 🔒 **Blocked by config** | Code is correct and deliberately refuses to run until an operator supplies config/rights |

---

## 0. The finding that governs everything else

**This repository contains two platforms that are not connected to each other.**

| | Deployed web app | NestJS API |
|---|---|---|
| Location | `apps/web` | `apps/api` |
| Auth | Supabase | Own JWT + Argon2 (`identity` module) |
| Data | 2 Supabase tables with RLS (`cloudplay_favorites`, `cloudplay_progress`) | 32 Prisma models, 4 migrations |
| Hosting | Vercel — **live** | **Not deployed anywhere** |
| Reference from web → API | **Zero.** A repo-wide grep for `API_BASE`, `BACKEND_URL`, `aether-api`, `localhost:4000`, `process.env.API` across `apps/web` returned **no matches** | — |

Consequence: most of Phases 2, 4, 5, 6 and 8 **already exist as backend code that the live site never calls**.
The work is integration, not greenfield construction. Choosing the target architecture is a prerequisite for
those phases and is **still an open decision** (see `IMPLEMENTATION_PLAN.md`, Decision D1).

---

## 1. Feature-by-feature status

### Phase 1 — Multi-server IPTV engine

| Feature | Status | Evidence / gap |
|---|---|---|
| Xtream server CRUD (add/edit/delete/enable) | 🔌 Implemented, not integrated | `apps/api/src/modules/admin/xtream-servers.service.ts` + controller, guarded by `AdminJwtGuard` and `@RequirePermissions('xtream:manage')`; admin panel calls it, but the API is not deployed |
| Credential encryption at rest | ✅ Complete + tested (unit) | AES-256-GCM via `XTREAM_ENCRYPTION_KEY`; `safe()` strips `passwordEncrypted`; covered by `xtream-servers.service.spec.ts` |
| SSRF / private-IP blocking on server URLs | ✅ Complete + tested | Validated in the service; web-side `src/server/safe-fetch.ts` re-checks DNS and every redirect hop |
| Tenant isolation per server | ✅ Complete + tested (unit) | Tenant scoping asserted in the service spec |
| Priority / default server | ❌ Missing | No `priority` or `isDefault` column in `add_xtream_servers` migration |
| Connection test button | ❌ Missing | No test-connection endpoint |
| Sync job + `lastSyncAt` / status | ❌ Missing | No scheduler; `worker-media` is not wired to catalog sync |
| Unified vs per-server mode | ❌ Missing | No mode selector in schema or UI |
| M3U / M3U8 playlist import | ✅ Complete + tested | Owner-only, POST-only, `no-store`; `playlist-import.ts` + 44 checks in `test:playlists` |
| Xtream on the **live** site | 🟡 Partial | Reads **one** server from env (`XTREAM_BASE_URL`), not the multi-server table |
| XMLTV EPG | 🔒 Blocked by config | `licensed-epg.ts` requires `CLOUDPLAY_EPG_RIGHTS_CONFIRMED==='true'`; has DOCTYPE, size and program caps |
| Credentials never reach the browser | ✅ Complete + tested | Opaque proxy URLs (`/api/playlist/stream?t=…`); `test:playlists` asserts no upstream URL leakage |

### Phase 2 — Movies & series library

| Feature | Status | Evidence / gap |
|---|---|---|
| Real, legally-free films | ✅ Complete + tested | **36 films** in `src/server/public-films.ts` (Blender open movies + public-domain archive.org), 36 prerendered `/movies/[id]` pages, 17 checks in `test:films` |
| Film playback | ✅ Complete + tested | Real `<video>` mounts with a real source — asserted in `test:search:browser` |
| Public series (`/series`) | 🎨 **Empty state (intentional)** | `pages/[section].tsx:27` renders an honest empty state — there is no legally-free series catalog to show yet. `Season`/`Episode` Prisma models exist but are unused by the web app. This is **not** the same as Xtream VOD below |
| Xtream VOD (movies/series from user's own server) | 🟡 **Implemented, live playback NOT VERIFIED** | Corrected 2026-11-08 — the earlier "❌ Missing" was wrong. `src/server/xtream-private.ts` implements `get_vod_categories`/`get_vod_streams` (:48), `get_series_categories`/`get_series` (:49) and `get_series_info` → episodes (:233); `PrivatePlayer.tsx` exposes live/movie/series tabs (:305) with episode drill-down (:242). Covered by `test:private` → *"movies and series catalogs work and stay clean"* (`private-player.test.mjs:242`), which also asserts no credential leaks. **Blocked from end-to-end verification only by the provider origin being unavailable (521/500)** — not by missing code |
| No fake titles / placeholders | ✅ Verified | Catalog is real and attributed; no mock entries |

### Phase 3 — Player

| Feature | Status | Evidence / gap |
|---|---|---|
| HLS / DASH / MP4 | ✅ Complete + tested | hls.js + dashjs + native MP4; `test:live` asserts real engine APIs and no fake DRM/reload retry |
| Pop-up player (expand/minimize/restore/Esc/backdrop) | ✅ Complete + tested | 18 checks in `test:popup`, incl. video unmount on close and scroll lock |
| Resume playback | ✅ Complete + tested | Progress in Supabase `cloudplay_progress`; unique-progress migration |
| Bounded retry | ✅ Complete + tested | Asserted in `test:live` |
| Chromecast (web sender) | ✅ Complete + tested | `player/castWeb.ts`; **CSP now explicitly allows its SDK origin**, guarded by a test |
| Chromecast of private streams | ✅ Correctly refused | `isShareableMedia()` rejects credentialled/query-signed/non-HTTPS URLs |
| Subtitles / audio-track / speed / PiP | 🟡 Partial | PiP present; full track-selection UI not verified across engines |
| Codec claims | ✅ Honest | No universal-codec claim is made anywhere |

### Phase 4 — Accounts, profiles, devices, RBAC

| Feature | Status | Evidence / gap |
|---|---|---|
| Sign in / up / out / password reset (live) | ✅ Working | Supabase auth in `src/lib/supabase.ts` |
| Owner-only private area | ✅ Complete + tested | `XTREAM_OWNER_EMAILS` enforced; 23 checks in `test:private` |
| Favorites + progress sync with RLS | ✅ Complete + tested | Supabase migration `20261105000000_cloudplay_free_account_sync.sql`; 19 checks in `test:community` |
| Profiles / avatars / profile editing | 🔌 Implemented, not integrated | `profiles` module in the API; no web UI |
| Device & session management | 🔌 Implemented, not integrated | API models only |
| Server-enforced RBAC | 🔌 Implemented, not integrated | `AdminJwtGuard` + `@RequirePermissions` exist in the API; the web app enforces only the owner-email gate |

### Phase 5 — Admin dashboard

| Feature | Status | Evidence / gap |
|---|---|---|
| Admin app shell + auth | 🟡 Partial | `apps/admin` Pages Router; `lib/auth.ts` verifies HS256 `ADMIN_JWT_SECRET` from `admin_access_token` cookie |
| Xtream servers panel | 🔌 Implemented, not integrated | `components/xtream-servers-panel.tsx` wired to `/api/admin/xtream-servers` — but the API is undeployed |
| The 12 required modules | 🎨 **UI-only** | `pages/index.tsx` is **76 lines**: a list of titles, not functioning modules |

### Phase 6 — Subscriptions & billing

| Feature | Status | Evidence / gap |
|---|---|---|
| Payment activation | 🔒 **Blocked by config — correct as-is** | `billing/payment.adapter.ts` is fail-closed: every method throws `ServiceUnavailableException('No verified sandbox payment provider configured')`. No entitlement can be granted by an unverified payment |
| Card data storage | ✅ Correctly absent | No card fields anywhere |
| Billing models | 🔌 Implemented, not integrated | Prisma models exist; unused by the live site |

### Phase 7 — Live TV & EPG

| Feature | Status | Evidence / gap |
|---|---|---|
| Free/legal live channels | ✅ Complete + tested | **33 channels** in `public-tv.ts`; 13 checks in `test:public` |
| Free-to-air satellite reference | ✅ Complete + tested | Al Kass + Thmanyah tables; 18 checks in `test:fta` (incl. Arabsat vs Nilesat 11919 H distinction) |
| `/live` rights gate | ✅ Intact | `/api/iptv/iraq` returns **503**; `legacySourcesAllowed()===false` |
| EPG grid | 🔒 Blocked by config | Requires `CLOUDPLAY_EPG_RIGHTS_CONFIRMED` |

### Phase 8 — Personalization

| Feature | Status | Evidence / gap |
|---|---|---|
| Continue watching / favorites | ✅ Complete + tested | Driven by real Supabase rows |
| Recommendations from watch history | 🔌 Implemented, not integrated | API-side only |
| Fake statistics / sample histories | ✅ Correctly absent | None present |

### Phase 9 — Unified search

| Feature | Status | Evidence / gap |
|---|---|---|
| Arabic-aware normalization | ✅ **Complete + tested — new this branch** | `src/lib/search-normalize.ts`: folds آ/أ/إ/ٱ→ا, ة→ه, ى→ي, ؤ→و, ئ→ي; strips harakat + tatweel; Arabic-Indic/Persian digits→ASCII; token-AND, order-independent |
| Wired into all 4 search surfaces | ✅ Complete + tested | `PublicTv`, `PrivatePlayer`, `PlaylistImport` (now also matches `channel.group`), `OpenMovies` |
| Real-UI Arabic search | ✅ Complete + tested | 19 Chromium checks in `test:search:browser` against the real catalog |
| Debounce | 🟡 Partial | Filtering is memoized and the list virtualized; no explicit debounce timer |
| Episode / series search | ❌ Missing | No series data to search (see Phase 2) |
| Cross-type unified results page | 🟡 Partial | `/search` searches films only |

### Phase 10 — Security

| Feature | Status | Evidence / gap |
|---|---|---|
| SSRF protection | ✅ Complete + tested | `safe-fetch.ts`: DNS resolution, IPv4/IPv6 private/loopback/link-local rejection, per-hop redirect re-validation |
| Content-Security-Policy | ✅ **Complete + tested — new this branch** | `security-headers.js`; `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors 'self'`; verified in a real browser with **zero violations** |
| HSTS | ✅ **Complete + tested — new this branch** | `max-age=31536000; includeSubDomains`, production only |
| Permissions-Policy | ✅ **Complete + tested — new this branch** | camera/mic/geo/payment denied; fullscreen + PiP allowed for the player |
| `nosniff` / Referrer-Policy / DNS-prefetch off | ✅ Complete + tested | Present in both modes |
| Credential encryption at rest | ✅ Complete + tested (unit) | AES-256-GCM in the API |
| Signed playback tokens | ✅ Complete + tested | `xtream-token.ts`, `playlist-token.ts`, `PLAYLIST_PROXY_SECRET` |
| Rate limiting | 🟡 Partial | `common/rate-limiter` exists in the API; not applied to every web API route |
| **Upstream Xtream over plaintext HTTP** | ⚠️ **Open risk** | Production uses `XTREAM_BASE_URL=http://…:2052` with `XTREAM_ALLOW_HTTP=true`. Credentials cross the network unencrypted. **Fix requires the provider's HTTPS port (usually 2053)** — operator action, not a code change |
| CSP `script-src 'unsafe-inline'` | ⚠️ Known limitation | Required by Next.js inline hydration scripts. Removing it needs a nonce pipeline through `_document`; documented, not silently ignored |

### Phase 11 — Performance & infrastructure

| Feature | Status | Evidence / gap |
|---|---|---|
| Channel list virtualization | ✅ Complete + tested | 7,500 channels → ~16 rows mounted; fling scroll holds frame rate; 23 checks in `test:channels:browser` |
| Responsive / TV viewports | ✅ Complete + tested | 120 checks in `test:layout` across 375/390/820/1440/1920px, no horizontal overflow |
| Serverless suitability | ⚠️ **Real constraint** | No `vercel.json` anywhere; the stream proxy runs with `maxDuration: 60`, which is unsuitable for sustained proxying or background sync. Long-running sync needs a non-serverless host |

### Phase 12 — Preserve UI identity

| Feature | Status | Evidence / gap |
|---|---|---|
| No redesign | ✅ Honored | This branch changed matching logic and response headers only — no markup, CSS, branding, typography or navigation edits |
| Scoped Tailwind | ✅ Complete + tested | `important: '.cp-tw'`, preflight off; `test:channels:browser` asserts existing pages are not restyled |
| Hybrid Pages/App Router | ✅ Complete + tested | Theme + language persist across the boundary; `test:browser` |

### Phase 13 — Device & TV compatibility

| Feature | Status | Evidence / gap |
|---|---|---|
| Responsive web up to 1920×1080 | ✅ Complete + tested | `test:layout` |
| webOS app | 🟡 Partial | `apps/webos` exists; not built or device-tested here |
| Native Android / iOS | 🟡 Unverified | `mobile/{android,ios}` exist; **no native build was run**, so no native-support claim is made |

### Phase 14 — Tests

| Feature | Status | Evidence |
|---|---|---|
| Web test suite | ✅ **400 checks pass, 0 fail, across 15 suites** | Full table below |
| Web type-check | ✅ **0 errors** | `npx tsc --noEmit` |
| Web lint | ✅ **0 errors**, 2 pre-existing `<img>` warnings | `npx eslint` on all touched files |
| Production build | ✅ **Succeeds** | 53 static pages, 36 film pages |
| API type-check | ⚠️ **Unverified** | 18 errors, **every one** a missing generated Prisma type; **zero logic errors** |
| API unit tests | ⚠️ **Partially unverified** | 8 suites pass / 11 fail-to-run; 46 tests pass / 9 fail — all failures share the same Prisma root cause |

### Phase 15 — Deployment

| Feature | Status | Evidence |
|---|---|---|
| Current production | ✅ Live and verified | PR #21 → `b125cbe` → deployment `dpl_9iVRzDSPtJBpyTYF6rJLM5PmefTa` READY/PROMOTED; `/tv-sources` re-fetched and confirmed |
| This branch | ⏸ **Not deployed — awaiting approval** | No deploy or promotion was performed |

---

## 2. Verified test results (actually executed on 2026-11-08)

Commands: `npx tsc --noEmit`; `npm run test:<suite>` in `apps/web`, with a production build served by
`next start` on `0.0.0.0:3000` and real Chromium for the browser suites.

| Suite | Result |
|---|---|
| `test:private` | 23 passed, 0 failed |
| `test:public` | 13 passed, 0 failed |
| `test:fta` | 18 passed, 0 failed |
| `test:films` | 17 passed, 0 failed |
| `test:community` | 19 passed, 0 failed |
| `test:playlists` | 44 passed, 0 failed |
| `test:live` | 12 passed, 0 failed |
| `test:browser` | 16 passed, 0 failed (media-decode fixtures skipped — `MEDIA_FIXTURES` unset) |
| `test:layout` | 120 passed, 0 failed |
| `test:channels` | 13 passed, 0 failed |
| `test:channels:browser` | 23 passed, 0 failed |
| `test:popup` | 18 passed, 0 failed |
| `test:xtream-url` | 18 passed, 0 failed |
| **`test:search-security`** (new) | **27 passed, 0 failed** |
| **`test:search:browser`** (new) | **19 passed, 0 failed** |
| **TOTAL** | **400 passed, 0 failed** |

**Regression caught and fixed during this work:** the first CSP draft blocked
`https://www.gstatic.com/cv/js/sender/v1/cast_sender.js`, which silently broke the existing Chromecast button.
The browser suite detected it as a real `securitypolicyviolation`. The origin was added to `script-src`, and a
unit guard now derives required script origins from `castWeb.ts` so this cannot regress silently again.

**Not verified here, and not claimed:** live stream decoding (broadcaster CDNs are unreachable from this
sandbox), native mobile builds, webOS on a real device, and the NestJS API (see below).

---

## 3. Blocked by external configuration — exactly what is missing

| Item | Missing config / action | Effect today |
|---|---|---|
| NestJS API verification | `prisma generate` cannot run: `binaries.prisma.sh` is blocked by this sandbox's network allowlist | API type-check and 11 test suites cannot run. **The API is unverified, not proven broken.** No API code was edited, because any change would be untestable here |
| API hosting | A non-serverless host + `DATABASE_URL` | All 13 modules stay unreachable from the live site |
| EPG | `CLOUDPLAY_EPG_RIGHTS_CONFIRMED=true` **only after rights are secured** | EPG refuses to load |
| Payments | A verified payment provider + credentials | Billing stays fail-closed; no entitlement is ever granted |
| Xtream transport security | Provider HTTPS endpoint (typically port **2053**), then set `XTREAM_ALLOW_HTTP=false` | Credentials currently traverse plaintext HTTP |
| Multi-server on the live site | Architecture decision **D1** + API deployment | Live site reads a single env-configured server |

---

## 4. Honest summary against the required report categories

- **Implemented + tested successfully:** Arabic-aware search across all four surfaces; CSP/HSTS/Permissions-Policy
  with zero browser violations; plus every pre-existing web feature listed ✅ above.
  **Updated 2026-11-08:** the NestJS API now also builds and tests green — `tsc` 0 errors (was 18),
  **25/25 jest suites / 238/238 tests** (was 8/19, 46/55), `eslint` 0 errors, `nest build` exit 0.
  The 18 errors were missing generated Prisma types, not logic defects; see
  `apps/api/scripts/generate-client.cjs`.
  Also newly implemented and unit-verified: Supabase-backed auth guard (50 cases), server-side
  Next.js→NestJS bridge (17 cases), rate limiting on **all 17** web API routes (12 cases, plus a live
  260-request burst proving 240 allowed then 429), multi-server priority/default/bounded failover
  (44 cases), and honest bounded health monitoring (49 cases). The additive priority migration was
  validated on real PostgreSQL 17 with 6 constraint probes and an idempotent, row-preserving rollback,
  all inside rolled-back transactions that left production untouched.
- **Implemented but not tested here:** NestJS **runtime boot and live PostgreSQL queries** — the offline
  Prisma fallback emits types only and ships **no query engine**, so a green build does not prove the API
  runs against a database. Also native mobile and webOS builds.
- **Blocked by external configuration:** EPG, payments, API hosting, Xtream HTTPS, and the Xtream provider
  origin itself (`redchicks.xyz` → 521 on 2053/443, 500 on 2052; **origin unavailable, authorization
  unverified**). Xtream VOD and multi-server code is therefore *implemented but not end-to-end verified*.
- **Not implemented:** a legally-free **public** series catalog (`/series` is a deliberate empty state),
  the catalog sync job, unified-vs-individual server mode, and episode search.
  *(Corrections 2026-11-08: Xtream VOD **is** implemented — see Phase 2. Server priority/default
  selection, health monitoring, and rate limiting on every web API route are now implemented and
  unit-verified; they are listed above, not here. They still need a deployed API and a reachable
  provider for end-to-end verification.)*
- **Awaiting your decision:** deployment approval. **D1 is resolved: Option C — Hybrid** (Supabase Auth +
  Supabase PostgreSQL as sources of truth, NestJS as the business/API layer, Next.js calling NestJS).
