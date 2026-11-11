# Cloud Play — production certification record

## Critical blockers remediation update

**NOT READY — BLOCKED.** Current remediation results and open release gates are authoritative in [CRITICAL_BLOCKERS_REMEDIATION.md](CRITICAL_BLOCKERS_REMEDIATION.md). New tests use **PASS / FAIL / BLOCKED / NOT RUN**; earlier status terminology below is historical, not a replacement for this update. Actual Docker runtime at `e074e58` passed after fixing omitted API workspace dependencies; final-HEAD workflow must additionally prove enhanced outage/transaction cases. Production legacy M3U/Xtream routes are explicitly fail-closed pending session-bound migration. Trusted hosting Geo and physical-device acceptance remain unproven. No production release is authorized.


## Decision

**NOT READY — BLOCKED. No production release is authorized.**

Only these criterion states are used: **VERIFIED**, **FAILED**, **BLOCKED**. A VERIFIED bounded test is not certification of a larger untested system. The central priority register is [RELEASE_ISSUES.md](RELEASE_ISSUES.md); recovery procedures are [RELEASE_RECOVERY_RUNBOOK.md](RELEASE_RECOVERY_RUNBOOK.md).

## Git and scope

- Authorized branch: `arena/d4593efb-cloud-play`.
- Starting HEAD: `0687a4465e79a7317920e6424ecad3323fed7481`; starting worktree clean, inspected before edits.
- Runtime fixes: `193ac9e` (production authority/pool validation), `84a1eb2` (legacy credential issuer guard). Subsequent commits strengthen executable tests/diagnostics and documentation without redesigning UI/player or changing databases/identity authority.
- Final tested candidate, final documentation commit and final Git status are recorded in the completion section below. `git log` identifies the exact report-only commit containing this file; a commit cannot contain its own SHA.
- No branch switch, reset, force push, main merge, production deployment, production migration, production DB test, source activation or external provider probe. Existing Git integration creates protected preview deployments on branch pushes; no production promotion was requested.

## Repairs executed

1. **CP-01 / P1 — VERIFIED:** production bootstrap now refuses implicit/legacy end-user authority. Supabase must be explicitly selected.
2. **CP-02 / P1 — VERIFIED:** when Supabase is selected, legacy user registration/login/phone/refresh and email/password mutation refuse before DB access/signing. Existing staff administration and explicit nonproduction legacy compatibility retained. Actual native HTTP fixture tests deny legacy credential endpoints; unit tests ensure no token/DB mutation calls.
3. **CP-03 / P1 — VERIFIED:** production database configuration requires exactly one `connection_limit` (1..50) and `pool_timeout` (1..30 seconds), preventing implicit CPU-derived unbounded deployment defaults. Duplicate/zero/oversized settings rejected without exposing connection string. Total production pool/replica approval remains BLOCKED.
4. **VERIFIED:** actual HTTP auth-rate test changes forged X-Forwarded-For ten times but still exhausts one real socket identity bucket; request eleven receives 429 + Retry-After. No proxy trust was enabled.
5. **VERIFIED:** real native fixture adds country-change renewal denial; original signed country binding remains authoritative at backend. This does not establish actual Vercel provenance.
6. **VERIFIED:** added real API literal SQL/markup storage/read assertion and a real-browser hostile search DOM check. These are narrow regression tests, not comprehensive XSS/SQLi certification.
7. Progressive multiuser fixture and separate-database custom archive restore added. Their final status must come from final CI evidence, not the existence of their code. Failed progressive runs remain retained.
8. Prior bounded cleanup, retained lease history, stale client recovery and Node 26 native matrix retained. New index rollback/reapply rehearsal added. No production migration/worker opt-in enabled.

## Acceptance criteria

| Criterion | Status | Evidence / exact scope / external requirement |
|---|---|---|
| Initial Git inspection and preservation | VERIFIED | Branch/HEAD/status inspected; no initial uncommitted work. No UI redesign/deletion or router replacement. |
| API unit/HTTP suites locally | VERIFIED | 40 suites / 635 tests at `84a1eb2` runtime; `/tmp/certification-jest3.log`. Some HTTP unit tests use identity/DB fixtures and are not production auth evidence. |
| Web offline contracts locally | VERIFIED | 15 suites / 267 checks; `/tmp/certification-web.log`; real provider sockets not contacted. |
| Pinned transport contracts | VERIFIED | 19 actual local HTTP/socket checks; `/tmp/certification-pinned.log`. |
| API/Web typecheck and lint locally | VERIFIED | No errors; Web has three visible warnings: TanStack virtualizer compiler compatibility and two existing unoptimized-image warnings. Not suppressed. |
| Isolated WASM PG integration locally | VERIFIED | 36 checks, including real cold physical clone restore and additive expiration-index rollback/reapply; `/tmp/certification-pg.log`. Not native-engine evidence. |
| Native Prisma Node 22/24/26 | VERIFIED | Recent new candidate runs each succeeded with 38 checks; final candidate annotations below are authoritative. Actual PrismaService init/disconnect/readiness recovery, model columns/FKs/indexes, transaction rollback and RLS tested. |
| Production build/all final CI | VERIFIED | [43009599466](https://github.com/aldaeny/Cloud-play/actions/runs/43009599466), exact SHA `3ebf2c1b203e82ae0fb4dbe6c5942899ecf26863`, all five jobs SUCCESS. API/Web/Admin production builds, types/lint, offline contracts, real controlled transports and Chromium/Admin regression. `certification-ci.json`, `certification-jobs.json`, `certification-application.json`. |
| Auth/session real isolated lifecycle | VERIFIED | Actual GoTrue/SMTP/native PG/Next/Nest/TLS browser fixture in prior successful CI `42987869471`; final candidate actual Auth job also succeeded, with 18 assertion groups including 9 protected-playback groups; `certification-auth.json`. No mocked identity counted as actual lifecycle proof. |
| Real hosting Geo / proxy chain | BLOCKED | `certification-staging.json`: actual `0687a44` preview READY, request intercepted by Vercel SSO/login. Need authorized staging access, verified country overwrite/direct-origin exclusion; never trust browser country/IP. Backend requires signed token/channel/time/nonce scope and lease binding. |
| Actual staging authentication/API/media/runtime logs | BLOCKED | Same SSO boundary; connector offers build metadata but no authorized application browser session/runtime log path. Need synthetic-only staging backend and authorized session, not secrets pasted in chat. |
| HLS/DASH seek/resume/range/revocation | VERIFIED | Real controlled TLS synthetic HLS + DASH decoded in Linux Chromium; Range/206 and no-store/MIME/rewrites verified in existing harness. Strict codec/manifest subset; bounded buffered Range, not arbitrary provider/live-window support. Final candidate actual Auth/browser job also succeeded; evidence below. |
| Gradual multiuser load 10/25/50/100 | VERIFIED | Initial failures retained; listener lifetime/drain correction followed by successful runs `43009466677` and `43009599466`. Final `certification-progressive-load.json`: all four levels, three bounded waves each, zero measured error/timeout rate, DB connections 5 before/max/after, recovery query succeeds. Not main.ts ingress, not long soak or target capacity. |
| Long sustained equivalent-production soak / DB resource envelope | BLOCKED | No approved target SLO, replica/pooler capacity, production-equivalent isolated environment, DB CPU/IO/RSS telemetry or resource budget. Short CI bursts cannot establish this criterion. |
| Backup/restore isolated cold copy | VERIFIED | Real stopped PG17 clone on separate port; native matrix verifies catalogs, FK/roles/RLS and browser credential denial. |
| Backup/restore logical custom archive | VERIFIED | Real fixture at `3ebf2c1`: separate database restored 77 tables / 1207 rows, matching digests/indexes/FKs/RLS/policies/grants; truncated archive rejected; restored FK rejects invalid insert. Safe fixture label/created-DB guard; no Auth archive uploaded. `certification-logical-restore.json`. |
| Actual managed Supabase/PITR/storage restore | BLOCKED | Approved isolated managed restore target, backup/PITR scope, storage restore and measured RPO/RTO absent. No production DB access used. |
| Schema rollback rehearsal | VERIFIED | Isolated provider snapshot, backend RLS and expiration-index rollback/reapply; preserved fixture users. No production rollback or data deletion. |
| Hosted application rollback / configuration recovery | BLOCKED | Procedures documented; need authorized isolated staging artifact/schema pairing and secret-manager recovery exercise. Secret rotation was not performed. |
| Dependency runtime audit | VERIFIED | Current `npm audit --omit=dev`: zero runtime advisories; `certification-dependency-audit.json`. |
| Dependency tooling audit | VERIFIED | Full tree: 18 findings (10 moderate, 8 low; zero high/critical), retained and not suppressed. No major downgrade/force update. This verifies the audit, not remediation of all findings. |
| Bounded security controls | VERIFIED | Existing ACL/tenant/IDOR denial matrix (130 source routes), forged ownership/token-class/SSRF/TLS/CSRF/origin/rate/cookie tests; current real API malicious literal and browser markup regression. Source inventory is not an exhaustive security proof. |
| Comprehensive target security review / distributed quota / audit operations | BLOCKED | Need actual staging ingress/cookies/headers and approved WAF/shared limiter/audit sink/alert access. Backend main.ts cap100/min/socket-IP may coalesce users behind a shared Next egress; progressive harness excludes main.ts, so its 100-user result does not close this availability/quota gate. Blind trust of XFF is not a fix. No claim of absence of all XSS or other vulnerabilities. |
| Actual Chrome/Firefox/Edge Desktop | BLOCKED | Available Linux Chromium automation is not all three branded desktop browsers on representative supported OS/hardware. Need authorized browser/device environment and records. |
| Actual Safari iOS / Chrome Android | BLOCKED | No physical devices or authorized real-device lab available. A 390px Chromium viewport is not iOS/Android certification. |
| Actual GoogleTV / AndroidTV / listed TVs | BLOCKED | No supplied hardware/remote-control lab or explicit device support matrix. No TV support claim. |
| Production runtime free of critical errors | BLOCKED | No authorized production runtime assessment; fixture logs/build success cannot establish it. |
| Final clean Git / all intended work pushed | VERIFIED | Final report/evidence/ignore-only commit pushed on this branch; handoff `git status --porcelain` empty and local HEAD equals `git ls-remote origin refs/heads/arena/d4593efb-cloud-play`. Resolve report commit with `git log -1 --format=%H -- docs/PRODUCTION_CERTIFICATION.md`; no self-referential SHA embedded. |

## Preserved feature audit map

This maps implementations to executable coverage. It does NOT mark whole features complete merely because a source file exists. Deployed journeys remain blocked where stated above. Exact router/controller/migration paths are in `certification-source-inventory.json` (inventory of 130 API route declarations).

| Feature | Implementation located | Bounded executable evidence |
|---|---|---|
| Accounts/Auth/profiles | Web Supabase SDK/account APIs; API identity/profiles/Supabase guards | recovery/bridge/session contracts; real GoTrue/SMTP/profile ACL lifecycle |
| IPTV player/session | `components/player/{VideoPlayer,MediaViewer}.tsx`, `lib/media-session.ts`, external playback controller/service | actual synthetic HLS/DASH decode/drop/revoke/rotation; seven client lifecycle contracts |
| Channels/categories/EPG | Web `lib/channels.ts`, live App routes, IPTV Pages APIs; API external channels/catalog | channel sorting/UI/layout, licensed EPG/protocol fixtures; no external provider permission inferred |
| Favorites/preferences/themes | `lib/use-channel-library`, storage/preferences and existing components | channel UI/layout/library and real PG owner RLS fixtures; not cross-device sync certification |
| Xtream | owner-controlled Web server adapters and API admin catalog/server services | URL/access/credential-sealing contracts; native DB/provider-isolated sync and controlled transport |
| M3U management | Pages playlist import/stream APIs and server playlist importer | isolated parsing/SSRF/sealed URL/owner checks; actual original generated protocol media fixtures |
| Admin | existing `apps/admin`, API admin RBAC | bridge and browser fixture states; native live DB roles/tenant-denial; not actual deployed staff session proof |
| Existing APIs | API modules + Pages API routes | protected HTTP denial matrix and module suites; authorized route-specific coverage is bounded, not every positive business journey |
| Navigation/router/layout/transitions | Pages home/section and App live routes, existing shared layout/styles | actual Chromium browser/channel/layout/search/popup regression; no visual redesign |
| Worker/media/quarantine | existing worker-media inputs and backend quarantine policy | generated local media fixture and uploaded-network-playlist rejection; no external provider probe |

## External closure requests (no secrets in chat)

1. Authorized SSO access to a preview/staging configured with isolated Auth/PG and synthetic media only. Supply access via the hosting permission mechanism, not a password/token in chat. Prove real Geo overwrite, missing/forged headers, country changes and no alternate ingress.
2. Authorized real-device lab or physical supported devices with exact models/OS/browser versions; capture login/navigation/playback/renewal/expiry/reconnect/remote-control evidence.
3. Approved load SLO, replica count and aggregate DB/pooler budget plus isolated equivalent infrastructure/telemetry for sustained soak and recovery.
4. Approved managed backup/PITR/storage restore target and staged application/configuration rollback exercise; no production migration/cutover permission inferred.

## Completion evidence

- Final tested candidate: **`3ebf2c1b203e82ae0fb4dbe6c5942899ecf26863`**.
- Final run: **[43009599466](https://github.com/aldaeny/Cloud-play/actions/runs/43009599466), completed SUCCESS, five of five jobs**. Independent `gh run view`/API retrieval, not inferred from dispatch.
- Native jobs Node22 `130485587615`, Node24 `130485587083`, Node26 `130485587554`: **38 actual native PostgreSQL checks each**. Auth `130485587645`: **18 assertion groups / 9 protected playback groups**, plus progressive measurements and separate logical restore notice. Application `130485587992`: all steps succeeded including current hostile-search DOM regression.
- Durable evidence: `docs/evidence/certification-{ci,jobs,application,auth,native-node22,native-node24,native-node26,progressive-load,logical-restore,bounded-capacity,dependency-audit,source-inventory,static-security,staging,load-initial-failure}.json`.
- Earlier progressive FAILED outcomes remain retained; stable persistent listener and full concurrent-wave draining were followed by success, not by ignored errors or altered limits. The historical annotation records do not establish a different production application defect.
- Final documentation/ignore-only commit does not change tested implementation/tests/workflows. Final Git/remote check performed at handoff; no production promotion.

### Observed progressive measurements

All levels have three waves with 2-second pauses. Latencies below are p50 / p95 / p99 milliseconds for current final run. Login samples are **new users provisioned at each level** (10, then 15, then 25, then 50), not a fresh login for all existing users at every level. Every distinct user actually logs into isolated GoTrue once. API read is `/profiles`, not Web channel-directory load.

| Users | Measured requests | Duration ms | Create p50/p95/p99 | Renew p50/p95/p99 | Manifest p50/p95/p99 | Segment p50/p95/p99 |
|---:|---:|---:|---|---|---|---|
| 10 | 130 | 11260 | 347.847 / 360.731 / 360.731 | 273.508 / 418.340 / 451.241 | 413.367 / 588.884 / 601.007 | 273.043 / 469.844 / 488.573 |
| 25 | 325 | 17531 | 600.229 / 617.879 / 619.581 | 783.773 / 862.638 / 870.561 | 1041.050 / 1166.536 / 1188.892 | 403.429 / 797.197 / 905.036 |
| 50 | 650 | 29616 | 1194.609 / 1226.239 / 1227.040 | 1439.807 / 1689.880 / 1706.679 | 2212.132 / 2693.205 / 2751.267 | 1231.318 / 1815.611 / 1853.487 |
| 100 | 1300 | 54883 | 2752.487 / 2820.979 / 2823.904 | 2998.407 / 4237.717 / 4362.472 | 4392.546 / 5200.281 / 5316.057 | 1901.046 / 3224.389 / 3420.764 |

Measured error and timeout rates are **0 at all four levels**. Only explicitly timed operations enter those denominators; setup, nested variant fetches and teardown are separately asserted. Observed DB connections **5 before / 5 maximum sampled / 5 after**, recovery SELECT succeeds. Node RSS snapshots grow from **253,734,912** at 10 users to **526,979,072 bytes** at 100; this does NOT prove long-run memory stability or per-viewer cost. Process CPU per phase is in JSON, not DB CPU. The fixture stops at RSS768MiB, host free memory below256MiB, total240s or request deadline15s; none triggered in the final run.

The 100-user manifest p95 of **5.2 seconds** is an observation, not acceptance against an unspecified production SLO. No claim of production scale, physical concurrent decoding, deployed rate limiting or long soak follows from these results.

### Restore result

**VERIFIED isolated scope:** custom PG17 archive readable, truncated archive rejected, single-transaction restore into separately created DB; **77 tables / 1207 synthetic rows**, matching row digest/indexes/FKs/RLS/policies/grants; restored FK rejects invalid insert. Fixture archive removed; only sanitized evidence retained. **BLOCKED managed scope:** actual Supabase backup/PITR/storage recovery, independent infrastructure failure and hosted application/config rollback.

**Final decision: NOT READY — BLOCKED**, despite all five final CI jobs succeeding. External hosting/device/target-operational requirements above remain acceptance gates.
