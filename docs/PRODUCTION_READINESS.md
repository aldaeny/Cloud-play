# Production-readiness gate — NOT READY — BLOCKED (2026-11-11)

The current execution, scoped results, issue priorities, evidence and external acceptance blockers are recorded in [PRODUCTION_CERTIFICATION.md](PRODUCTION_CERTIFICATION.md). In particular, the native Prisma runtime, real Geo enforcement, secure protected HLS, full security coverage, devices, production-like load, separate restore and staging are **not certified**. The historical phase report below is retained for context; it is not a current status or proof for this branch.

---

# Historical phase 2 production-readiness gate — NOT PRODUCTION READY

## Repository and scope

Existing PR #23, branch `arena/c5c3c018-cloud-play`. Starting reported/remote commit `ccb365b` was verified. The sandbox had returned to PR #22 with recovered files: staged comparison against the fetched remote was empty, a recovery stash was retained, then a fast-forward merge restored the exact existing branch history. No reset, force-push, branch recreation, merge of PR #23 or production deployment.

Implementation commits in this phase:

- `9d9ba9f`: native-only disposable database gate and reproduction instructions.
- `b91549d`: same-major transitive tooling security remediation.
- `2c17001`: auth inventory, malformed-subject rejection, real JWT boundary tests, isolated RLS tests.
- `d45bc04`: provider-scoped durable metadata import/history/locking and migration.
- `cd088c9`: DNS/address preflight and streaming response limits for provider health.

Final documentation/test follow-up commit is identified by `git log`; all implementation commits are pushed to this same branch. No UI style/component was redesigned.

## Fresh verification (after clean npm ci)

| Check | Executed outcome | What it does NOT prove |
|---|---|---|
| npm ci | exit 0, lockfile accepted | no deployment |
| API lint | exit 0 | not an endpoint penetration test |
| API Jest | **29 suites, 295 tests, all passed** | fixture providers remain explicitly mocked where stated |
| API real PostgreSQL | **20 checks passed**, PG17.11, all 33 models, six Prisma migrations, real RLS/HTTP/locks/outage | WASM engine, not native; auth.uid/users fixture not hosted Supabase |
| Native Prisma command | **exit 1 / BLOCKED**, engine download TLS fails before DB operations | not a pass, no native operation claimed |
| API/Web/Admin tsc --noEmit | all exit 0 | runtime not inferred from types |
| Web non-browser tests | **13 suites, 251 checks, all passed** | recovery email not sent |
| API/Web/Admin builds | all exit 0; web 53 static pages | not production verification; native client still required |
| Web lint | exit 0, 3 warnings (virtualizer compiler + two image notices) | warnings not suppressed |
| Admin lint | exit 0 | no standalone admin test script exists |
| Chromium smoke | **16 passed**, desktop/mobile/tablet/TV viewport checks | media decoding skipped without MEDIA_FIXTURES; not physical-device testing |
| Chromium Arabic search/CSP | **19 passed** | no broadcaster stream decoding claim |
| Chromium layout matrix | **120 passed**, phone widths 375/390/430, tablet820, desktop1440, Arabic/English, light/dark | Chromium emulation, not actual iOS Safari/Android/TV firmware |
| npm audit | **31 → 21**; high **4 → 0**; critical **0 → 0**; 8 low/13 moderate remain | not zero vulnerabilities or zero runtime exposure |

Browser binary was installed only in ignored `.cache/browser-tools` and extracted to temporary paths. First launch failed for missing libnspr4.so; loading the packaged runtime libraries resolved that environment failure. All three browser suites then ran successfully. The temporary web server was stopped. No test was disabled or relabeled as a pass.

## Requirement status and precise blockers

| Requirement | Status | Missing / why / evidence / completion gate |
|---|---|---|
| Native Prisma | BLOCKED | Official binaries.prisma.sh is outside outbound allowlist. Native-only runner fails explicitly. Run documented command on trusted CI using approved backend Node/OS and official verified engine. |
| Real PostgreSQL mappings/operations | COMPLETED AND VERIFIED (isolated scope) | 20-check suite; production compatibility and data restore remain separate. Now 33 models due to one added staging model. |
| Hybrid single auth authority | IN PROGRESS | Only additive profiles read uses Supabase; legacy user/staff HS256 routes remain. No safe fully tested all-module cutover yet. See 90-route matrix. |
| AuthZ / IDOR | IN PROGRESS | Real JWT tests, fixture profiles HTTP and real-DB sync tenant/permission checks pass. Not all 90 endpoints have route-specific ownership/security tests. Staff disable/status not modeled; token replay until expiry remains possible. |
| Recovery + SMTP E2E | BLOCKED | No isolated GoTrue/Supabase Auth service or SMTP sink/provider configured. Docker, Podman and gotrue executables unavailable; only migration SQL exists in local supabase directory. GOTRUE_API_HOST, GOTRUE_DB_DATABASE_URL, SMTP_HOST and GOTRUE_SMTP_HOST are absent (values not printed). Current 12 web recovery tests cover static/render contracts, NOT email/token lifecycle. Need isolated auth endpoint/key, isolated DB and SMTP inbox, then expiry/reuse/new-login/old-password rejection/session tests. No production email/settings/account modifications. |
| Hosted Supabase RLS | IMPLEMENTED BUT NOT VERIFIED in this phase | Checked-in policy SQL passed real isolated PG tests with two local auth users and non-BYPASSRLS authenticated/anon roles. Hosted policies/default grants were not queried/changed in this phase. |
| New snapshot RLS | COMPLETED AND VERIFIED (isolated scope) | RLS enabled, PUBLIC privileges revoked, no browser policy. Local anon/authenticated SELECT rejected. Actual production roles/default grants require approval review. |
| Dependency remediation | IN PROGRESS | All starting high-severity nodes removed using focused same-major overrides. 21 remaining findings, including Nest runtime moderate advisories, require reviewed upgrades/retests. See SECURITY_AUDIT. |
| SSRF / outbound safety | IN PROGRESS | Added reserved-IP/IPv6 rejection, all-answer DNS preflight and streaming cap. Fetch re-resolves: DNS rebinding remains. Require pinned transport/egress review. Legacy HTTP opt-in retained, not used as secure transport fallback. |
| Provider management | IMPLEMENTED BUT NOT VERIFIED in deployed environment | Existing CRUD/default/priority/health and tests preserved; no production backend interaction claimed. |
| Metadata import synchronization | COMPLETED AND VERIFIED (isolated scope) | Durable snapshots, success/failure/history, diffs, cross-process lock, malformed failure preservation, two-provider isolation, actual admin HTTP/DB-role tests. Operator-authorized full-export import only. |
| Online/scheduled provider synchronization | NOT IMPLEMENTED | No direct provider adapter/scheduler/worker/retry queue/notifications or seasons/episodes ingestion. Import re-submission is manual retry, not scheduled sync. |
| redchicks.xyz | BLOCKED | ORIGIN UNAVAILABLE / AUTHORIZATION UNVERIFIED. Not probed in this phase. Requires authorized provider/rights evidence; never bypass restrictions. |
| Credentials | IMPLEMENTED BUT NOT VERIFIED in this phase | Prior metadata showed both variables Sensitive. No fresh metadata/decryption/rotation/runtime-availability check; current values not read. Rotation needs explicit approval and provider access. |
| Frontend integration | IN PROGRESS | Profiles proxy exists, visual UI not cut over; no design changes. Existing UI regression checks pass; no claim all business operations reach Nest. |
| Playback / Series | BLOCKED for private provider verification | Media decoding skipped (no local fixtures); no provider playback verified. Series honest empty state retained without rights-cleared series data. |
| Migration readiness | IN PROGRESS | Six migrations apply to fresh isolated PG17. Snapshot rollback/reapply preserves provider rows. No production migration, verified managed backup/restore or production schema diff in this phase. |
| Production deployment | BLOCKED by approval and verification | No merge/deployment/promote or production configuration change performed. |

## Remaining severity/priorities

1. **Release-blocking:** native Prisma runtime on exact backend deployment image; unified Supabase authentication/authorization coverage; recovery/email E2E; verified backups and production RLS/grants review.
2. **High security priority:** residual DNS rebinding/egress gap, staff-disablement model, full endpoint-specific tenant/IDOR tests, review runtime dependency advisories.
3. **Functional completion:** online/scheduled provider sync and diagnostics UI; broader module-to-frontend integration; authorized playback/media fixtures and rights-cleared series catalog.
4. **Compatibility:** React18 deprecation warning under Next16, remaining tooling vulnerabilities, real Safari/Android/TV browser/device regression.

## Reproduce

```sh
npm ci --no-audit --no-fund
npm run lint --workspace aether-api
npm run test --workspace aether-api -- --runInBand
npm run test:postgres --workspace aether-api
# A separate mandatory gate; EXPECTED TO FAIL in this restricted sandbox:
npm run test:postgres:native --workspace aether-api
node apps/api/scripts/auth-matrix.cjs
npm run lint --workspace aether-web
npm run lint --workspace aether-admin
npm run build --workspace aether-web
npm run build --workspace aether-admin
npm audit
```

See existing web package scripts for the 13 unit/contract suites and Chromium browser/layout/search suites. Browser tests need a local built web server and browser executable/runtime libraries. Do not point mutation tests at production.
