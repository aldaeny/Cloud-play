# Final production readiness evaluation

**Decision: NOT READY — production acceptance is not granted.**

Scope: preserve the architecture/player/UI established at `604b43d` and subsequent work; evaluate protected playback and release integrity without production deployment, migration, provider contact, activation, or infrastructure changes. Runtime change under evaluation: `c4e86bb74ecec39cb5fb759fbc30f6f6055849f9`. This is a bounded engineering evaluation, not certification of all codecs, devices, providers, security attack classes or production capacity.

## Evidence and interpretation

- Baseline actual CI: [42924580153](https://github.com/aldaeny/Cloud-play/actions/runs/42924580153), commit `0259edc76b6cd7299922e5d38c20917406d451eb`, all four jobs succeeded. Sanitized job/annotation evidence is in `docs/evidence/protected-playback-phase2-*.json`; historical browser and other local evidence is described in `EXTERNAL_SERVER_FINAL_ACCEPTANCE.md`. These are historical results, NOT proof of the new housekeeping changes.
- Current candidate CI: [42987869471](https://github.com/aldaeny/Cloud-play/actions/runs/42987869471). **Completed SUCCESS: all five jobs**, including native Node 22/24/26, real Auth/SMTP/browser and full application regression. Durable exact SHA/jobs/annotations/measurements: `docs/evidence/production-readiness-{ci,jobs,auth,native-node22,native-node24,native-node26,performance}.json`. Matrix extended to native Node 26 in addition to 22/24 because the actual Vercel project reports Node 26.x.
- Current local execution: API Jest **40 suites / 632 tests passed**; API ESLint and API/Web TypeScript passed; all offline Web contracts passed, now **15 suites / 267 checks**, including seven new browser-session lifecycle unit contracts. Isolated WASM PostgreSQL **36 checks passed**, including additive index migration application/reapplication. WASM/type-only Prisma generation is NOT native-engine proof; native proof belongs to CI and is now PASS on 22/24/26.
- Actual read-only Vercel inspection: `docs/evidence/production-readiness-staging.json`. Preview exists at `0259edc`, platform state READY. Unauthenticated application probe reached Vercel SSO/login, NOT the application. READY deployment state is not application readiness. No bypass/protection change was attempted.
- Local execution logs: `/tmp/readiness-jest.log`, `/tmp/readiness-web.log`, `/tmp/readiness-pg.log`; ephemeral logs are not durable release evidence. Durable CI annotations/artifacts take precedence.

## Test/result matrix

PASS below means the stated bounded scenario passed, not unlimited support. PARTIAL means a meaningful portion remains unverified. BLOCKED/NOT RUN is never treated as PASS.

| Area / test | Result and evidence | Remaining limitation |
|---|---|---|
| Create/renew sessions | PASS baseline real GoTrue + native PG + Nest + Next + controlled TLS fixtures; signed Geo and entitlement checked | Current candidate real Auth CI also PASS |
| Real Auth refresh rotation | PASS baseline actual refresh preserves same authoritative `auth.sessions` binding | Browser unit contract additionally checks updated access token forwarding, not refresh-token transport |
| Revoke/log out immediately | PASS baseline still-signed access JWT denied after actual logout; retained media cookies denied after DB lease revocation | Already buffered/decoded video cannot be retracted; immediate means next protected request |
| Reuse prevention | PASS expired/replayed Geo assertion rejected; cross-user and same-user/different-Auth-session lease use denied | Media tickets intentionally reusable during their authorized lease, NOT one-use media URLs; stealing the complete valid browser session is not prevented by this binding |
| User/channel isolation | PASS baseline cross-channel and user/session denial; tenant/ACL regression tests | Not an exhaustive authorization proof of every unrelated API |
| Concurrency cap | PASS baseline four concurrent creates produce at most two active leases/user via DB advisory lock | Different-device physical multi-tab UX and high-volume fairness not certified |
| Expiration | PASS baseline expired lease denied at authorization independently of housekeeping | Cleanup does not replace request-time expiration |
| Autonomous cleanup | IMPLEMENTED candidate: opt-in lifecycle timer every 60s; non-overlapping process work; cross-replica transaction advisory lock; at most 500 leases + 500 nonces/batch; 10s transaction timeout; shutdown await. Two scheduler unit tests PASS. Native integration assertion added | Default OFF; operator must approve migration and explicitly enable in long-lived backend. Native real-PG cleanup assertion PASS. Expired leases are marked revoked and retained, not deleted; nonce deletion is ephemeral replay-state cleanup |
| Client stale-session recovery | PASS seven new unit contracts: serialized attaches, channel switch release, failed renewal release, scheduled renewal, refresh/logout, stale unmount, ordinary media no-op | Not physical-device lifecycle certification |
| Geo forged/missing headers | PASS baseline HMAC/timestamp/token/channel/nonce validation, replay rejection; Web contracts fail closed without trust configuration | A server-side trust flag alone does not prove hosting header provenance |
| Actual Vercel Geo ingress | BLOCKED: real protected preview intercepted by SSO | Need approved authenticated staging access, synthetic-only configuration, spoofed country/IP tests and direct-origin exclusion. Never accept browser-supplied country/IP as evidence |
| HLS / DASH | PASS baseline actual existing HLS desktop decode and DASH fMP4 init/media decode at mobile Chromium width | Strict supported manifest subset; not arbitrary provider, DRM or codec compatibility |
| Range/206 | PASS baseline single bounded range, suffix/invalid/416, subtitles and rewritten resources; same resource identity preserved for implicit BYTERANGE | Backend fetches bounded object then slices; not origin Range streaming, multipart/conditional requests or large-file streaming certification |
| Seek / Resume | Candidate real decoded HLS seek to 8s and pause/resume assertions added to authenticated harness | Native/browser CI PASS; no cross-device resume persistence claim |
| Headers | PASS bounded Content-Type, private/no-store contracts; capacity harness additionally checks actual segment MIME/cache | No shared-cache/CDN production validation |
| Upstream failures / disconnection | PASS baseline dropped segment recovers; brief browser offline/online continues buffered playback; safe error contracts | Not long outage, live sliding window, codec discontinuity or provider failover soak certification |
| Authorization non-bypass | PASS baseline independently revoked rights deny DASH init/media; manifests/resources/subtitles/ranges protected | Requires real ingress staging validation too |
| SSRF | PASS controlled tests for scheme/host/IP/DNS/redirect/TLS constraints and pinned socket checks | No third-party network probes or exhaustive penetration test |
| CSRF | PASS configured canonical HTTPS origin enforced on session mutation; same-site/HttpOnly cookies and no-store | Actual production proxy/origin/cookie behavior still unverified |
| XSS | Existing framework escaping/CSP and URL/manifest validation inspected; build/contract checks pass | PARTIAL: no comprehensive stored/reflected/DOM XSS penetration assessment; do not claim vulnerability absence |
| URL/credential leakage | PASS curated upstream URL scan across 43 built JS assets at baseline; server-only counts; no fixture provider URL in authenticated HTML | Scanner is curated, not a universal secret detector. Production build environment/bundle must be independently scanned without exposing secrets |
| Rate limiting | Existing application limits and session concurrency retained; synthetic unit/contracts apply | PARTIAL: no distributed ingress/backend quota saturation, per-tenant fairness or production rate-limit topology certification |
| Permissions / audit | Existing ACL, tenant disable, candidate rights and audit/operational regressions pass; low-cardinality playback metrics omit tokens/URLs | Production audit sink, alerting, retention, log redaction and access controls not verified |
| Simultaneous connections / latency | Candidate controlled native harness: 20 creates, 20 renewals (four concurrent), 32 synthetic segments (eight concurrent); records mean/p95/max and DB client connection/size/settings samples | PASS in current CI. No preset production SLO, target arrival rate, saturation/soak or cross-replica budget. Never call these production capacity numbers |
| PostgreSQL pool/consumption | Default Prisma pool identified; bounded harness records connections, DB size and shared_buffers setting | BLOCKER: approved instance/pooler/replica connection budget, CPU/IO/memory telemetry and load target absent. shared_buffers is configuration, NOT measured resident memory |
| Chrome | PASS actual Chromium fixture decode and separate mocked catalog/layout browser suites | Chromium is not branded Chrome on actual supported hardware |
| Safari / iOS / Android / TVs | NOT RUN on physical Safari/iPhone/Android/GoogleTV/AndroidTV/supported TV hardware | BLOCKER for advertised compatibility. Mobile viewport does not establish mobile OS/TV support |
| Production build / TS / ESLint | PASS baseline full CI build/type/lint; current full application CI build/types/lint PASS; API lint + API/Web types also pass locally | Current full CI PASS; three pre-existing Web hook warnings were not suppressed |
| All CI / native Prisma | Baseline SUCCESS native 22/24; current SUCCESS includes 26 | Final conclusion independently retrieved, not inferred from dispatch |
| Prisma migrations | Additive expiration indexes supplied with rollback; isolated WASM migration suite passed | No production migration executed. Native migration/build CI PASS; operator review still required; staging backup/rollback rehearsal and production schema drift unverified |
| Pages / App Router | Existing Pages bridge preserved; framework build/route/browser tests provide bounded compatibility evidence | Does not imply all future App Router routes use equivalent authorization |
| Dependency integrity | Baseline production dependency audit zero; lockfile not force-upgraded | Not a guarantee of absence of vulnerable transitive code or future advisories |

## Fixes made without production mutation

1. Added bounded opt-in expired lease housekeeping with cross-replica lock, no audit-history deletion, safe error code only, and additive expiration indexes. Removed unbounded nonce cleanup from every creation request.
2. Failed same-channel renewal now releases stale client lease state, allowing a later explicit retry to create rather than endlessly retry the dead lease. Existing UI/player hierarchy preserved.
3. Added seven lifecycle unit contracts, two scheduler tests, real native housekeeping/seek/resume assertions, synthetic-only connection/latency benchmark and sanitized artifact output.
4. Extended native matrix to Node 26 to investigate the actual hosting runtime mismatch. No hosting configuration changed.

## Remaining issues and severity

No confirmed critical exploit was established by this bounded evaluation. That does **not** mean no critical vulnerability exists.

- **HIGH / release blocker:** trustworthy actual hosting Geo provenance/direct-origin exclusion and authenticated staging journey unproven due to SSO. Need an authorized access path; no protection bypass.
- **HIGH / release blocker:** advertised physical platform/device playback compatibility unproven. Require actual representative hardware and acceptance records, not viewport emulation.
- **HIGH / release blocker:** production scale/SLO/pool budget/soak/recovery evidence missing. Default Prisma pool must be explicitly budgeted against Supabase/PostgreSQL connection limits and replica count before release.
- **HIGH / release blocker:** operational release gate (approved schema plan, backup restore/rollback drill, authoritative Auth/session DB privilege validation, monitoring/alerting and rights-cleared enabled catalog) has not been certified against target infrastructure.
- **MEDIUM:** comprehensive XSS/permissions/rate-limit topology assessment incomplete; production asset/secret/URL scan and CSP/cookie behavior need environment-specific validation.
- **MEDIUM:** housekeeping is deliberately opt-in; expiry still denies access while disabled, but stale replay state/history grows. Approve indexes and enable long-lived backend worker, monitor failure/backlog and define history retention separately.
- **MEDIUM:** bounded object Range implementation and strict manifest subset require documented product limits; do not advertise arbitrary upstream Range/live/codec support.

## Required predeployment checklist

- [x] Current runtime candidate `c4e86bb` full CI SUCCESS (five jobs); exact SHA/jobs/assertions and benchmark results exported. Subsequent report-only commit does not change runtime.
- [ ] Authorized isolated Vercel staging access, with synthetic-only upstream settings; prove genuine Geo header overwrite, forged header rejection, direct-origin isolation and authenticated cookie/origin journey.
- [ ] Validate supported Node/runtime plus native Prisma query engine for actual backend, not type-only generation.
- [ ] Approve additive migration and rollback/index locking plan after isolated staging rehearsal; do not run against production here.
- [ ] Set/verify least-privilege authoritative `auth.sessions` read path and supported Supabase Auth lifecycle without exposing tokens.
- [ ] Approve backend cleanup opt-in and alerts/backlog thresholds; do not enable by changing production settings in this task.
- [ ] Define concurrent viewers, request rate, renewal jitter, latency/error SLO, pooler mode and per-replica connection budget; run longer synthetic staged load with DB CPU/IO/memory metrics and outage/recovery.
- [ ] Execute real Chrome/Safari/iOS/Android/GoogleTV/AndroidTV/advertised TVs: HLS/DASH, Range/seek/resume, token rotation/logout/revoke, remote controls and reconnect.
- [ ] Perform scoped security review for XSS/CSRF/SSRF/permissions/rate limits; inspect actual release assets and log redaction without recording secrets.
- [ ] Validate backups/restore, alert routing/audit retention, deployment rollback and operational ownership.
- [ ] Verify every listed source has technical, rights and permission approval; candidates remain disabled; blocked sources remain untouched.
- [ ] Obtain explicit production approval separately. No deploy/merge/migration/source activation is authorized by this report.

**Final acceptance remains NOT READY even if current CI passes: essential staging/device/scale/operational tests remain unproven.**

## Observed bounded measurements (current CI)

| Operation | Count / concurrency | Mean ms | p95 ms | Max ms |
|---|---:|---:|---:|---:|
| Session creation | 20 / sequential | 54.484 | 78.060 | 78.208 |
| Renewal | 20 / 4 | 109.016 | 123.321 | 123.341 |
| Synthetic segment | 32 / 8 | 227.370 | 257.026 | 257.126 |

Observed DB client connections max **5**, server configured max **100**; database size before/after **12,179,123 bytes**; shared_buffers configuration **134,217,728 bytes**; Node RSS snapshot **264,306,688 bytes**. These are shared fixture process/server samples, not incremental per-viewer cost or measured PostgreSQL resident memory, saturation or production SLO evidence. Auth CI recorded **17 assertion groups**, including **8 protected-playback groups**; native jobs each retain their exact assertion annotations. No external provider was contacted.
