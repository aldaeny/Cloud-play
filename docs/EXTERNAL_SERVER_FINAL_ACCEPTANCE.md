# External Server Manager — final implementation acceptance

## Current checkpoint — Protected Playback Phase 2

**PRODUCTION ACCEPTANCE: NOT GRANTED.** This section supersedes older playback,
edge and session statements below; historical evidence is retained unchanged.
Starting commit: `604b43d`. Latest tested runtime: `0259edc76b6cd7299922e5d38c20917406d451eb`.
No deployment, merge, production migration, external streaming-provider probe,
real candidate activation or external report delivery was performed. Only
explicit synthetic fixtures in disposable databases were approved inside tests.

### Implementation and security findings

1. **Session creation is now verified before setting cookies.** Next delegates
   creation/renewal/revocation to Nest under the existing Supabase bearer. The
   backend resolves the active account and tenant; it does not accept browser
   identity/role/tenant fields. A PostgreSQL media lease is an authorization grant,
   not a second login or refresh-token issuer. Lease lifetime is 120 seconds,
   renewal is scheduled at 45 seconds, and absolute lifetime is four hours.
   Supabase SDK refresh-token rotation/locking is retained; refresh tokens never
   enter media cookies or the Nest media API.
2. **Immediate checks and concurrency.** Each manifest/resource requires the
   actual Supabase token, the owning lease, matching channel/tenant, and the
   original Supabase `auth.sessions` row (including `not_after`). Logout can reject
   through Auth (401) or the absent session row (403); either denies playback.
   Lease revocation, account disablement and source/right revocation deny
   subsequent requests. Source/rights, lease and Supabase session are rechecked
   before returning fetched bytes. Previously buffered bytes cannot be recalled.
   Creation uses a per-user PostgreSQL transaction advisory lock across replicas;
   default cap is two leases, configurable 1–10. This is NOT a plan-specific
   subscription/device entitlement implementation or a production load proof.
3. **Trusted request context.** The Next issuer reads only Vercel's ingress-owned
   `x-vercel-ip-country`, requires actual runtime opt-in (`VERCEL=1` plus
   `EXTERNAL_TRUST_VERCEL_GEO=true`), and fails closed otherwise. HMAC assertions
   bind country, web platform, channel, SHA-256 of the bearer, a fresh nonce and a
   maximum 30-second window. Nest validates them; a PostgreSQL unique nonce ledger
   prevents successful replay across workers. Unsigned browser assertions are not
   forwarded. Session mutations require an explicitly configured HTTPS browser
   origin, not a client-controlled Host/Forwarded origin. **Actual Vercel ingress
   provenance/no-bypass behavior remains unverified:** CI uses a clearly labelled
   controlled HTTPS ingress fixture that overwrites the country header. Do not
   enable the trust flag on an arbitrary/custom server. No IP/UA country fallback.
4. **All media objects remain protected.** Master/variant manifests, segments,
   fMP4 initialization, and subtitles use the same authenticated lease/rights
   gates. Opaque encrypted addresses bind user, tenant, channel, source and lease;
   another authenticated user's token, another Supabase session of the same user,
   another channel or another lease cannot reuse them. Addresses live at most to
   the four-hour absolute lease limit; renewing the short lease therefore does not
   strand a long-running stream with five-minute resource URLs. Repeated reads
   within the same authorized live lease are intentionally allowed (HLS retry,
   reload and byte ranges), not advertised as single-use media tokens.
5. **URI/range delivery.** Same-origin relative and absolute HLS references and
   supported DASH templates are rewritten. A per-manifest address cache preserves
   identical URIs for implicit HLS byte-range offsets. Single HTTP byte ranges,
   suffix/open ranges, 206/Content-Range and 416 are implemented over bounded
   buffered resources. No provider redirect is followed. Full objects are still
   fetched from the provider (8 MiB maximum); this is not large-file streaming or
   upstream Range forwarding. Multipart/conditional If-Range and live byte-range
   profiles depending on previous manifest windows are not certified.
6. **Browser lifecycle and failure recovery.** Existing VideoPlayer/MediaViewer
   prepare and renew the session, respond to Supabase refresh/logout and online
   events, serialize lifecycle operations, and release leases on unmount/channel
   change. Retries are bounded; HLS recovery reloads the protected manifest rather
   than repeatedly fetching a stale source ticket. Session POST/PUT/DELETE and
   media errors return safe codes; 401/403/404/416/429 are preserved where relevant,
   and upstream auth/redirect/other failures are not confused with viewer identity
   failures. One shared media cookie/lease is active per browser profile; independent
   browsers can use separate leases up to the backend cap. Concurrent different
   channels in multiple tabs of the same browser are not certified.
7. **Closed a real bundle leakage path.** Home/about previously imported the raw
   curated list to render its length, embedding upstream addresses in browser JS.
   Counts are now calculated in static server props. The actual production build
   is scanned for all curated stream addresses; none were found in 43 JS files.
   Catalog metadata returns only protected addresses. Names, IDs, EPG, favorites,
   categories, themes, navigation and the existing player/UI structure are retained.
8. **Safe observations.** Fixed-vocabulary JSON events record post-auth manifest
   and resource request durations/status, startup, buffering/failures, provider
   failures, source switches, session operations/expiration and auth denials.
   Client observations are untrusted telemetry, not provider-health authority.
   Existing provider-health/failover history and Admin diagnostics remain intact.
   No identities, headers, credentials, signed tickets, raw exceptions or private
   provider URLs are serialized into these events. Next incoming request logging
   is disabled to avoid logging media-ticket query strings. Central retention,
   aggregation, alert routing and operational dashboards still require acceptance.

### Files, schema and rollback

- Nest: `external-playback.controller.ts`, new
  `external-playback-session.service.ts`, `external-media-range.ts`,
  `external-playback-metrics.ts`, existing channels/manifest policy and Auth guard.
- Next: `pages/api/external/session.ts`, `[id]/[action].ts`,
  `src/server/playback-geo.ts`, `protected-live.ts`,
  `src/lib/media-session.ts`, `use-playback-metrics.ts`, existing player and
  Public/Community components, SSR home/about counts. DASH metadata uses the
  protected `manifest.mpd` alias; no component replacement.
- Tests: actual Auth/Nest browser harness
  `apps/api/scripts/test-protected-auth-playback.mjs`, existing isolated Auth/PG
  runners, new session/range/security specs, Web contracts, built asset scanner.
- **One new additive migration file:**
  `202611120004_external_playback_leases/{migration.sql,rollback.sql}`.
  Two backend-only tables (`ExternalPlaybackLease`, `ExternalGeoNonce`), RLS
  default-deny, browser-role grants revoked, tenant/channel/user FKs and index.
  Current inventory: 48 Prisma models / 50 backend tables. Isolated rollback and
  reapply passed; no production migration was executed.
- Production API database role must have reviewed narrow read access to the
  authoritative Supabase session fields used by the read-only query. Missing
  schema/permission fails closed with `AUTH_SESSION_CHECK_UNAVAILABLE` (503).
  CI's disposable database uses its isolated owner role; it does not prove the
  production role is correctly provisioned. No production grant was made.
- Defaults in `.env.example` deny playback. Required server-only settings:
  `EXTERNAL_PUBLIC_ORIGIN`, `EXTERNAL_GEO_SIGNING_KEY`, approved
  `EXTERNAL_CHANNEL_BINDINGS`, optional `EXTERNAL_CHANNEL_FORMATS`, and the
  concurrency limit. Mapping a directory ID is not publication/rights approval.
  The legacy `EXTERNAL_PLAYBACK_CONTEXT_KEY` alone no longer grants access.
- Rollback is by ordinary revert commits on this branch, without resets or history
  deletion. Keep protected Live disabled during rollback; do not re-enable direct
  provider paths. The SQL rollback is for controlled empty fixture state, not
  permission to drop production leases/audit data. No production rollback action
  is currently necessary because nothing was deployed/migrated.

### Exact verification and CI evidence

**Final CI: SUCCESS**, runtime `0259edc76b6cd7299922e5d38c20917406d451eb`:
https://github.com/aldaeny/Cloud-play/actions/runs/42924580153
All four jobs passed: native PostgreSQL Node 22, native PostgreSQL Node 24,
isolated Auth/SMTP/playback, and full application regression. Local tests use only
generated media and disposable PostgreSQL, never a production database.
Actual run/job metadata and sanitized check annotations are retained in
`docs/evidence/protected-playback-phase2-{ci,jobs,auth,native-node22,native-node24}.json`;
local summaries are in `protected-playback-phase2-local.json`. The run SHA and all
four conclusions were programmatically asserted before writing this report.

- `npm run test:postgres:native --workspace aether-api`: **38 checks PASS on each
  of Node 22 and 24**, real native query engine/PrismaService plus disposable PG.
- `node apps/api/scripts/test-auth-recovery.mjs`: **15 real assertion groups PASS**,
  including six authenticated-playback groups below. Exact disposable Auth/SMTP,
  certificate, media and database setup is `.github/workflows/auth-recovery.yml`.
  No fixtures replace identity, business guards or Prisma in this E2E harness.

- `npm run test --workspace aether-api -- --runInBand`: **40 suites / 630 tests PASS**.
- `node scripts/test-web-contracts.mjs`: **260 checks PASS** across all 14 offline
  Web suites, including nine new protected transport/Geo contract groups.
- `npm run test:postgres --workspace aether-api`: **36 checks PASS**, actual
  isolated PostgreSQL using the explicitly labelled WASM/pg adapter, not native
  engine evidence.
- `node apps/web/tests/pinned-fetch.test.mjs`: **19 checks PASS** on local sockets.
- `npm run test:bridge --workspace aether-admin`: **PASS**, existing actual HTTP
  bridge assertion group.
- `npm exec --workspace aether-api -- tsc --noEmit`,
  `npm exec --workspace aether-web -- tsc --noEmit`, API lint: **PASS**.
  Web lint: **0 errors / 3 existing warnings**, not suppressed.
- `DATABASE_URL=postgresql://unused:unused@127.0.0.1:1/unused npm run build --workspaces`:
  **PASS** (build is not substituted for behavior evidence).
- `node scripts/check-protected-media-assets.mjs`: **43 JS files / zero known
  upstream curated stream addresses PASS**.
- `npm audit --omit=dev --json`: **0 production vulnerabilities** at this checkpoint;
  tooling audit remains visible in CI, not suppressed or forcibly upgraded.

Existing browser suites also ran locally against the freshly built isolated
site on port 3003, with an actual Chromium binary and original generated media:

```bash
FFMPEG="$PWD/.cache/phase2-ffmpeg/package/ffmpeg" node scripts/generate-media-fixtures.mjs .cache/phase2-media
export BASE_URL=http://127.0.0.1:3003
export PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/chromium-wrapper
export LD_LIBRARY_PATH=/tmp/al2023/lib FONTCONFIG_PATH=/tmp/fonts
export MEDIA_FIXTURES="$PWD/.cache/phase2-media"
npm run test:browser --workspace aether-web
npm run test:channels:browser --workspace aether-web
npm run test:layout --workspace aether-web
npm run test:search:browser --workspace aether-web
npm run test:popup --workspace aether-web
```

| Browser command | Passed | Failed |
|---|---:|---:|
| `test:browser` | 23 | 0 |
| `test:channels:browser` | 25 | 0 |
| `test:layout` | 120 | 0 |
| `test:search:browser` | 19 | 0 |
| `test:popup` | 18 | 0 |
| **Total** | **205** | **0** |

These five commands also passed in the final CI. The older general browser
suites use explicit synthetic catalog/media interception for UI/decoder regression;
they are **not** substituted for the separate real authenticated E2E harness.
Temporary FFmpeg tooling/media stayed under ignored `.cache`; no package or
lockfile dependency was added for it. Test servers on 3003/3004 were stopped.

`BASE_URL=http://127.0.0.1:3004 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/chromium-wrapper LD_LIBRARY_PATH=/tmp/al2023/lib FONTCONFIG_PATH=/tmp/fonts node apps/web/tests/admin-providers-browser.mjs`:
**PASS**, the actual Admin browser assertion group with explicitly mocked admin
identity/API states and responsive widths 390/820/1280 (not a real Admin Auth E2E).
It also passed in final CI. A first attempt against the old existing preview on
3002 timed out waiting for an alert; that attempt is retained as a failed run,
not counted as success. The fresh current production build on 3004 passed.

Additional final-CI commands, all **PASS**, without external providers:
- `node apps/api/scripts/test-external-tls.mjs` — real local TLS/certificate gates.
- `MEDIA_FIXTURES="$GITHUB_WORKSPACE/.cache/media-fixtures" node apps/api/scripts/test-external-http-protocols.mjs` — generated HLS/DASH/M3U transport group.
- `FFMPEG="$(command -v ffmpeg)" MEDIA_FIXTURES="$GITHUB_WORKSPACE/.cache/media-fixtures" node apps/worker-media/tests/local-media-input.mjs` — real worker input rejection/processing group.
- `npm exec --workspace aether-admin -- tsc --noEmit`, all three workspace lint
  commands and `npm run build --workspaces` — actual CI gates, not skipped.

**Failures found and fixed, not hidden:** initial run
https://github.com/aldaeny/Cloud-play/actions/runs/42921170679 failed after the
player's `use client` directive was displaced by new imports; TypeScript/lint alone
had not caught that Next build error. It was corrected and actual builds rerun.
Intermediate run https://github.com/aldaeny/Cloud-play/actions/runs/42922106464
failed only the final logout status expectation (403 expected, authoritative 401
returned); the assertion now permits 401 or 403, never a successful response.
Initial local PG schema-inventory assertions expected the old model/table counts;
these were updated to 48/50 without removing relationship/RLS assertions.
The browser-bundle scan exposed the count-only raw-directory import leak, now
fixed and tested. The latest full run above is green; intermediate failed runs
are not portrayed as acceptance evidence.

The Auth CI journey is real: browser → existing Next player/session/media routes
→ Nest Supabase guard → disposable GoTrue + native Prisma/PostgreSQL → isolated
TLS transport → original FFmpeg-generated HLS/DASH. Neither Auth, Prisma nor
business guards are replaced in that harness. The only network routing override
maps the explicit synthetic media hostname to its local TLS fixture; production
pinned-transport/private-network denial is unchanged. Existing older PG playback
checks still explicitly use an identity fixture and are not presented as that E2E.

The six authenticated-playback assertion groups cover:
1. Actual cross-user and same-user cross-Supabase-session denial, signed context
   validation/replay, four racing creates under the two-lease cap, renewal,
   expiration and cross-channel denial.
2. HLS decoded video dimensions/currentTime at desktop 1280 px through the actual
   chain; an actual dropped TLS segment connection recovers via bounded retry.
3. Buffered offline/online behavior and lease revocation with cookies retained;
   independent HLS variant/segment/subtitle authorization, real 206 byte ranges,
   repeated-URI byte-range playlist checks, and relative/absolute rewriting.
4. Supported DASH fMP4 initialization/media decoded at mobile viewport 390 px.
5. Actual licence/entitlement revocation blocks subsequent DASH init/media.
6. Actual refresh-token rotation renews the same-session lease; actual GoTrue
   logout denies still-signed JWT playback immediately (401 or 403).

**Format boundary:** unencrypted HLS (tested H.264/AAC MPEG-TS, subtitles), strict
same-origin DASH SegmentTemplate/SegmentList subset (tested H.264/AAC fMP4).
Declared unsupported codecs are denied; absence of codec declarations still
requires browser decode validation. AES-128/SAMPLE-AES HLS, all DRM/key retrieval,
external DASH BaseURL/xlink/clock controls, unsupported templates, RTMP and other
unsupported MIME/protocol profiles are rejected. There are **no supported
protected encryption-key requests** in this release; no key/DRM extraction is
attempted. This does not claim universal HLS/DASH/codec compatibility.

### Remaining production blockers

- Actual approved hosting-ingress trust/no-bypass and signing-key provisioning
  have not been exercised on Vercel. The isolated edge is not hosting evidence.
- Approved production schema/grants, reviewed channel mappings/rights and
  operational configuration remain unapplied; no real provider was contacted.
- Physical/native Safari, Firefox, Android TV and Google TV are untested here.
  Chromium mobile viewport evidence is not a physical mobile/TV certification.
- Four competing creates prove serialization, not sustained throughput, scale,
  latency SLOs or production reliability. No production load/p95 claim is made.
- Per-plan subscription/device restrictions are not attached to ExternalChannel
  leases; existing VOD entitlement paths and their fail-closed delivery remain
  unchanged. A business entitlement decision is required before paid Live use.
- Sender-constrained/DPoP anti-theft tokens are not implemented: stealing both a
  bearer and its same-session cookie/lease remains a bearer-credential compromise.
  Media-address replay within that authorized lease is intentionally permitted.
- Multi-tab different-channel playback, prolonged offline expiration/restart,
  browser-level provider failover/codec continuity, conditional/multipart ranges
  and sliding-window implicit ranges need further device/reliability acceptance.
- Logs/metrics are implemented, but centralized aggregation, alert thresholds,
  retention, routing and production operational health acceptance are not proven.
- The prior real malware scanner/operator quarantine acceptance and any real
  report-recipient setup remain unverified. No reports were sent externally.

**Do not deploy, merge, activate candidates or declare production readiness on the
strength of these isolated tests.**

---

## Decision and safety boundary

**Complete production acceptance is NOT granted.** The multi-provider, rights-gated failover, playback proxy, durable reporting and quarantine implementations below are real and tested in isolation. Production integration still requires trusted country/platform assertions, a real malware scanner, an approved report recipient and authorized provider/media/device acceptance. Unsupported protocol profiles remain denied. Do not interpret this report as approval to deploy, merge, migrate production, publish a source, rotate a key or contact a provider.

Repository preserved: same branch `arena/d4593efb-cloud-play`, clean starting tree at `dbaba49`, origin `https://github.com/aldaeny/Cloud-play.git`, default branch `main`. No resets, force pushes, branch switches, dropped restored files or merged PR edits. No production actions or external provider checks. New sources/channels remain candidate/disabled until explicit per-source and per-channel approval. No automatic publication.

This report supersedes older “NOT IMPLEMENTED multi-provider/failover/report delivery” statements in historical reports. Earlier execution counts and reports are retained, not erased.

## 1. Implemented features and evidence boundary

### Multi-provider groups/channels

- `ProviderGroup`, `ExternalChannel`, `ChannelSource`: tenant-composite foreign keys, unique channel/group names, one source per server per channel, unique ranks and one Primary. Sources start disabled. Two-phase atomic reorder prevents uniqueness conflicts and records exact old/new IDs/ranks. No arbitrary client tenant, actor or review identity is accepted.
- Independent source disable preserves its row/history; enabling requires explicit reviewed publication approval. Candidate server edits invalidate publication/health/attached rights through the existing service.
- Public approval routes require actual DB permissions `xtream:manage`, `rights:manage`, `external:publish`; no permissions were added to production roles. Source approval checks current reviewed rights and recent manifest+segment evidence. Rights review and publication serialize on the licence lock; an endpoint/licence/check compare-and-swap prevents approving a changed server.

### Failover and runtime rights

- PostgreSQL channel advisory lock serializes evaluation across replicas; only new observations increment failure counters. Configurable failure threshold, retry interval, health freshness, hold-down and primary stability window. Initial Primary selection does not impose a fake recovery delay; genuine subsequent switches do.
- Automatic switching is independently disabled by default per channel. An unavailable source is never served while awaiting threshold, retry or hold-down: availability may stop temporarily rather than violate safety. Rights denial always stops serving, regardless of auto-switch setting/threshold/hold-down. Eligible backups are rechecked for provider, date, country, platform, commercial/redistribution scope, reviewed status, enabled state and freshness.
- Recovery returns to Primary only after stability and hold-down. Long unknown health gaps reset stability. Repeated secondary failures cannot cause immediate bounce-back. Transitions, outages, recoveries and observed completed outage durations are retained. Selected-source ID can remain as recovery state while unavailable; it is NOT an authorization grant.
- Actual upstream failures in the playback proxy are coalesced and recorded as trusted observations, trigger re-evaluation and failover where policy permits. Transient fetches retry at most min(3,failureThreshold), with250/500ms backoff and8s per-attempt deadline; auth/rate-limit responses and invalid URLs/certificates are not retried. The channel retry interval controls repeated state evaluation, not an unbounded HTTP request wait.

### Actual playback boundary

- `/external-playback/:id/manifest` and `/:id/resource` require actual Supabase authentication independently on every request. No legacy JWT or anonymous ticket alone can authorize them.
- Initial country/platform context must be HMAC-authenticated by a trusted server-side edge, bound to the real user/tenant/channel and expire within5minutes. Browser country queries, JWT role claims and forwarded headers are NOT trusted. Missing/unconfigured/forged/expired context fails closed. No fake geolocation fallback.
- Backend selects current rights-eligible source, fetches with pinned transport, rewrites HLS references/DASH resource templates into short-lived AES-GCM opaque resource addresses. Provider URLs/passwords/signed query values are not returned in plaintext. Resource addressing is user/channel/source-bound and is NOT a second identity issuer.
- Every resource request rechecks source and rights; another check after fetching prevents sending bytes after a concurrent revocation/source change. Manifests no-store, media MIME allowlist, no redirects, bounded8MiB resources/depth3, no DRM/key extraction or authentication/geo bypass.
- The trusted edge assertion transport and real viewer/player deployment are not configured here. Source changes may require manifest reload; smooth decoder continuity across different codecs/providers is not certified.

### Protocols and diagnostics

- Existing HTTPS pinned transport retained: all-address DNS validation/private/reserved/IPv6-mapped blocking, actual socket pin, original SNI/certificate validation, bounded deadlines/body/header sizes and no redirects.
- Cleartext HTTP GET is explicit opt-in only (`EXTERNAL_ALLOW_CLEARTEXT_MEDIA`); default remains HTTPS. Credential/query URLs and credential POST over HTTP are denied. No HTTPS→HTTP fallback.
- HLS master/media syntax, MIME and same-origin references; general M3U references validate as intake, NOT an automatically playable whole channel collection. Selected child endpoints still need their own reviewed rights and health.
- MPEG-DASH strict supported profile: same-origin SegmentList/SegmentTemplate with representation IDs, Number/padded Number/Time addressing. XML DTD/entities, ContentProtection, external xlink/BaseURL/clock controls and unsupported templates fail closed. Actual generated static DASH/initialization transport tested; full DASH profile support is not claimed.
- Actual socket-stage DNS/TCP/TLS events and fixed error categories, HTTP status/auth/rate-limit and manifest/segment/readiness status. HTTP200 alone is not playback readiness. Raw provider errors/headers/credentials are not retained. Generic auth failure is not falsely diagnosed as expired credentials;403 is not invented proof of geography.
- RTMP is **unsupported**, because the current browser player/proxy has no approved RTMP path. It is explicitly rejected, not advertised as working.

### Durable reporting

- Per-tenant weekly (default) and optional daily schedules; periodic worker is opt-in. Unique schedule/window outbox retains unchanged/empty weeks. Advisory locks prevent duplicate generation across replicas; missed windows catch up in bounded batches.
- Reports include observed availability percentage, failures and latency per server/provider identity, transition/outage counts, completed observed outage duration, ongoing outages and licence states/expiry. Metrics are sample-based, NOT a claim of continuous decoded-video uptime; report declares truncation at10000records.
- Delivery requires BOTH per-tenant explicit `external:reports` consent and a configured operator-controlled HTTPS webhook. Without either, reports accumulate pending and no send occurs. Consent is rechecked after claiming the delivery.
- Fixed form payload `{idempotencyKey,report,token?}`; secret is server-only, never stored in delivery/audit. Actual pinned TLS transport, no redirects,8s/4KiB response cap. Durable lease, bounded5attempt exponential retry, success/failure codes, crash recovery/terminal attempt handling. At-least-once delivery: recipient MUST deduplicate the stable ID; exactly-once remote delivery is not claimed.

### Attachment security

- Existing encrypted storage reused;48KiB/document and20/license. Canonical base64, signatures/structure for PDF/PNG/JPEG, fatal UTF-8 text validation, executable/archive/script/SVG/active-PDF rejection. Supporting evidence does not approve rights.
- Existing/new attachments default **quarantine**, not grandfathered clean. Operator-installed absolute-path clamscan-compatible scanner: no shell, fixed arguments, no inherited credentials,5s/output bounds, private temporary file and cleanup. Missing/error/timeout stays quarantined; infection blocks download. No real antivirus engine/signature database was installed or claimed verified here.
- Independent `rights:manage` read/rescan/delete authorization; only clean, nondeleted evidence downloads. Downloads are attachment/octet-stream in Admin, never inline rendered. Content deletion preserves hash/metadata/audit but clears encrypted content. Upload/read/scan/delete audited.

### Admin

- Existing visual identity/components retained. New provider group/channel forms, Primary/Secondary ordering, independent disable, explicit publication confirmations, per-channel policy/activation, connection/rights/diagnostics and transition history. Existing source panel adds durable report consent/history and evidence scan/quarantine/delete actions.
- Same-origin server-side Next→Nest bridge; no browser direct provider connections. Explicit loading/empty/error/success states and bounded list sizes. Phone390/tablet820/desktop1280 checked in actual Chromium using API fixtures. Runtime backend security is tested separately against real DB/Nest.

## 2. Files changed

Full executable inventory: `git diff --name-only dbaba49..955e4e2` (latest runtime source when report drafted). Main additions:

- API: `external-channels.{service,controller}.ts`, `external-playback.controller.ts`, `external-manifests.ts`, `external-reports.service.ts`, `external-evidence.ts`, `external-final.spec.ts`; extended existing monitor/servers/pinned transport/Admin module.
- Prisma schema/migrations/rollback below; `saxes@6.0.0` direct dependency for strict XML parsing, root lock updated consistently.
- Admin: `external-channels-panel.tsx`, channel bridge, dashboard composition, existing servers/evidence/report controls.
- Tests: actual PostgreSQL failover/playback/outbox helpers, actual isolated HTTP protocols, expanded GoTrue integration and Chromium group/channel/rank/confirmation/responsiveness checks.
- Existing successful implementations and historical docs preserved. No generated media/binaries/credentials added to Git.

## 3. New migrations and permission review

- `202611120001_external_channel_failover`:6new models (`ProviderGroup`, `ExternalChannel`, `ChannelSource`, `ExternalFailoverEvent`, `ExternalReportSchedule`, `ExternalReportDelivery`), composite tenant FKs/uniques/checks/indexes and default-deny RLS/grant revocation. Total46Prisma models/48backend tables.
- `202611120002_evidence_quarantine`: scan/deletion fields, old evidence remains quarantined until scanned.
- `202611120003_external_switch_integrity`: composite tenant/channel/source foreign keys for transition endpoints.
- Existing tables/data are not replaced or populated/promoted. No production migrations executed.
- Anonymous/authenticated DB roles remain denied backend CRUD; business access uses existing server identity plus explicit tenant filtering, NOT a claim of browser-direct tenant RLS CRUD. Existing Admin staff auth remains the repository's legacy guard; no identity system was replaced in this task. End-user external playback opts into Supabase-only guard.

## 4. Tests and results

Local fresh results: API39suites/584tests pass; PostgreSQL17/WASM36checks pass, no production URL. Includes real Nest HTTP RBAC, real DB competing evaluators, order conflicts, duplicate source prevention, stable failback/hold-down, source disable, cross-tenant switch FKs, concurrent approval/revocation, encrypted evidence quarantine/infection/deletion and report retry/consent/unchanged-week generation.

Actual Nest+PostgreSQL+local TLS synthetic playback proves manifest rewriting, resource user binding, country mismatch denial and rights revocation during fetch. **Identity in that case is an explicit guard fixture**, not real GoTrue. Separate trusted CI uses real GoTrue/SMTP/native Prisma and verifies actual bearer handling on the new playback surface (missing token401, missing trusted context/invalid resource403), alongside existing full recovery lifecycle.

Actual isolated HTTP/TLS socket tests cover generated HLS/DASH/segments, M3U references, certificate rejection, timeout,401/403/404/429/500/redirect refusal. Test-only public-DNS→loopback routing exists only in test harnesses; production private address policy unchanged. These tests are not real provider success or physical-device certification. Existing separate original-media Chromium tests cover actual HLS/DASH/MP4 decode, not every new proxy/DASH profile combination.

Actual Chromium Admin API-fixture browser test passes group/channel creation, source assignment/order reversal, cancelled publication, candidate controls and390/820/1280layouts. API/Nest/DB boundaries are tested separately; this is not falsely described as live browser→GoTrue→provider E2E.

Performance review (measured on1536b16, before final FK/reflection changes): disposable PostgreSQL/WASM two-source functional workload,20evaluations mean18.33ms/p9526.33ms/max29.80ms;14selection calls mean21.01ms/p9533.17ms. Evidence `docs/evidence/external-manager-local-performance.json`. This is not production load/concurrent stream acceptance. Source cap100/channel, list cap100, report cap10000, batch10, bounded media buffers/timeouts and transaction timeouts reviewed. Production pool/CPU/memory/network capacity must be tested before release.

Final native/full-CI result is recorded in the final evidence section after completion. Historical successful runs do not establish a newer SHA's behavior.

## 5. Incomplete / externally unverified acceptance

- The HMAC verifier and guarded proxy are implemented and tested, but the hosting-edge signing/verified-geo integration and frontend player glue for the full real viewer→Supabase→proxy→decoder journey remain **NOT IMPLEMENTED**. A trusted geographical source and approved deployment setup are additionally **BLOCKED** pending authorization. These engineering gaps cannot be closed by merely setting a key. Never substitute user-provided country or an unverified forward header.
- Real antivirus binary/signatures and real recipient delivery are **BLOCKED** pending authorized installation/setup/consent. Fixture scanner/recipient tests prove adapters/denial/retry, not real AV efficacy or email/recipient delivery.
- Real providers, redistribution licence issuer/scope, signed streams, geographic restrictions and physical phones/TV/Safari are **BLOCKED / UNVERIFIED**. No external probe executed; redchicks.xyz remains authorization-unverified.
- General DASH profiles/DRM, RTMP, arbitrary cross-origin playlist resources, byte ranges/large direct files and guaranteed seamless cross-codec failover are **unsupported / not implemented**. They fail closed. Do not claim universal protocol/player compatibility.
- Automatic whole-M3U catalogue/channel publication/import and legacy viewer-wide retroactive rights migration are not implemented here. Existing viewers/sources were deliberately not silently replaced or altered.

## 6. Known limits

Weekly/daily schedules use fixed intervals and Baghdad display context, not configurable calendar cron/DST. Runtime retry observations are bounded/coalesced; high failure thresholds or cooldown may intentionally yield unavailable playback until monitoring provides enough evidence. Background polling is60s and requires approved worker enablement. Hold-down never serves a bad source merely to maintain continuity. Reports measure observations, not continuous SLA. Remote delivery is at-least-once. Downloading clean evidence still requires safe local review tooling; a scanner is not proof of legal permission.

## 7. Production risks and release gates

NOT production-approved. Require explicit migration/key/role/deployment approvals, approved rollback backup, trusted geo/assertion path, real scanner, authorized recipient deduplication, actual viewer/player protocol tests and concurrent streaming capacity. Central existing per-IP limiter, DB advisory-lock/pool budget, per-request rights checks and8MiB buffered media cap need load verification. No speculative relaxation of rate limits or security gates was made. Existing unrelated full-project/staff-auth/mobile dependency findings remain documented; this task does not close them.

## 8. Operation and rollback

1. Review exact source SHA and successful native Node22/24/full application/Auth CI; do not deploy from an unverified code revision.
2. Review `.env.example` server-only flags. Worker/HTTP remain false by default. Existing approved credential key is reused, never exposed in public env or rotated here. Configure scanner/context key/recipient only after approval; no such production setup performed.
3. Add candidate and independently confirm permitted technical scope. Review issuer, rights term/platform/country/commercial/redistribution; attach evidence without automatic approval. Scan evidence before reading. Assign reviewed licence and perform confirmed manifest+segment check.
4. Configure groups/channels/source ranks and policy. A staff member with `external:publish`+rights permissions must explicitly approve each source, then explicitly activate channel. These operations were executed only against disposable synthetic fixtures during tests, never production.
5. Opt into health schedules/worker only for authorized sources. Configure weekly report generation separately from delivery consent; transport setup alone does not authorize sends. Review failures and pending outbox; do not manually mark failed/unscanned records successful.
6. To stop: disable channel or individual source, disable auto-failover/schedules, revoke relevant rights/delivery consent. Runtime playback rechecks rights every request and before sending bytes.
7. Rollback ONLY after explicit approval/backup: disable worker/delivery first; back up new channels/events/outbox/evidence, then reverse switch-integrity migration, evidence columns (loses scan metadata), and channel/report tables using supplied rollback SQL. Prior source/rights tables remain. Never fall back to old unscanned-download code while exposing evidence. Disposable rollback/reapply tests verify existing users remain intact; not a production recovery certification.

## Final evidence

**VERIFIED:** runtime `955e4e2d63482f557be2d0c92db4fbc23fc5963d`, workflow [42906488212](https://github.com/aldaeny/Cloud-play/actions/runs/42906488212), conclusion **SUCCESS**. Native Node22 and24 each **38checks**; real isolated Auth/SMTP/Nest surface checks passed; clean application install, API/Web/Admin contracts, all type/lint/build gates, actual TLS/HTTP protocol tests, worker FFmpeg safety, actual Chromium media/layout/search/popup/channel Admin and production audit all passed. Saved run/jobs/annotations under `docs/evidence/external-acceptance-*.json`. Final local API count39suites584tests, disposable WASM PostgreSQL36checks. Full root dev audit findings remain visible; production audit gate passed.

Final documentation/environment-example commit follows the tested runtime SHA. It changes no executable runtime or migration. Final Git status is checked after push; commit is reported in the delivery response. No merge, deployment, production migration, source publication, provider probe, actual recipient send or paid infrastructure action was performed.

**Final acceptance remains NOT GRANTED:** green isolated CI is not equivalent to completed trusted edge/player integration, real AV/recipient setup, authorized provider/device/load acceptance or production approval.

## Final integration follow-up — partial implementation, NOT production acceptance

This checkpoint adds a fail-closed same-origin media transport to the existing
Live TV UI, not a replacement player or a new identity authority.

- Public SSR/catalog, licensed catalog and community catalog playback addresses
  now use `/api/external/:id/manifest`; metadata and favorites IDs are retained.
  No candidate is imported, approved or activated. Server-only
  `EXTERNAL_CHANNEL_BINDINGS` maps existing directory IDs to approved backend
  channel UUIDs; missing mappings fail closed. Mapping is not rights approval.
- Existing VideoPlayer and MediaViewer prepare a Secure/HttpOnly/SameSite=Strict
  cookie containing the existing Supabase access token through an origin-checked
  POST. Native media requests can therefore use the same-origin bridge without
  exposing a bearer in query strings. Cookie transport lasts at most five minutes.
  Nest independently verifies identity and source/rights on each request.
- The bridge refuses redirects, requires HTTPS internal API configuration, bounds
  responses to 8 MiB/30 seconds, suppresses upstream error bodies and rewrites
  protected manifest resource addresses to the same-origin route.
- Signed context is forwarded only for Nest cryptographic verification. This is
  NOT a hosting geo issuer implementation: a trusted ingress must provide the
  channel/user/tenant-bound assertion on manifest requests. Without it playback
  denies, intentionally. Browser country headers are not converted to assertions.

Files: `apps/web/pages/api/external/{session.ts,[id]/[action].ts}`,
`src/server/protected-live.ts`, `src/lib/media-session.ts`, existing player,
PublicTv/CommunityTv and public/licensed/community metadata paths. No migration.

Actual commands/results for this partial checkpoint:
- `npx tsc --noEmit -p apps/web/tsconfig.json`: PASS.
- `node apps/web/tests/protected-live.test.cjs`: PASS, 9 assertion groups;
  isolated metadata/cookie/deny gates ONLY, not real Supabase or decode E2E.
- Targeted `npx eslint` from `apps/web`: PASS. Initial invocation from repository
  root failed because the web ESLint config is workspace-local; rerun corrected.
- `git diff --check`: PASS.

Remaining critical work is explicitly **unfinished**: deployable trusted hosting
geo boundary, full real Supabase + frontend/backend synthetic decode integration,
ongoing token renewal/logout propagation and bounded source-change recovery,
review of all other historical Live entry points/casting, real scanner execution,
telemetry/alerts/operational health, concurrency/load/recovery tests and actual
Safari/Firefox/Android TV/Google TV evidence. Existing CI links above predate this
checkpoint and do not validate it. No new CI success is claimed. This change
intentionally makes unbound directory entries unavailable rather than retaining a
direct-provider bypass. Browser catalog caching may require cache invalidation
before rollout. Do not deploy before these remaining gates pass.

Rollback: revert this follow-up commit on the session branch, without resetting
history or touching production data. No production deployment, database migration,
provider probe, candidate activation or report send occurred.
