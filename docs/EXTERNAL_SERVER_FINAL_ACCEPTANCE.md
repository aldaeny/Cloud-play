# External Server Manager — final implementation acceptance

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
