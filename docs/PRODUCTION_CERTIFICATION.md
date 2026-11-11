# Cloud Play production certification — NOT READY — BLOCKED

Date: 2026-11-11 UTC. Branch: `arena/3ec1875b-cloud-play`. Starting revision: `f4a405c4db6daf4eb2ef73e8b09c59cd3679a828` (the requested `0687a44` was not the checkout HEAD; this checkout is shallow/grafted). Code revision under test: `889ea283688b5427dd7fd4e2f77d50bb5a4aa5dc`. The documentation commit is its descendant; use `git rev-parse HEAD`, `git status --short --branch` and `git log` for the current revision/status (a commit cannot embed its own hash). No uncommitted user changes were present initially.

This report records **only this execution**; older reports are historical, not evidence that a current release gate passed. No provider, production database or production deployment was contacted for functional tests. No production settings, migrations, or secrets were changed.

## Acceptance matrix

The status applies to the **named scope only**. A scoped VERIFIED item is not a production certification.

| Criterion | Status | Evidence and boundary |
|---|---|---|
| Git baseline and preservation | VERIFIED | Initial `git status --short --branch` clean; `git rev-parse HEAD` as above. Code committed on the authorized branch. See `git status` for the current live state. |
| CI on this branch | BLOCKED | [Native Prisma run 43009505912](https://github.com/aldaeny/Cloud-play/actions/runs/43009505912) succeeded on 22/24/26 for `1a82fb7245c35b1b96fe4c38808eff6ffb192abc`; Actions warned that v4 actions target deprecated Node 20 and are forced to Node 24. The new application workflow has not run: dispatch returned GitHub 404 because it is not on the default branch. It will run on a pull request; exact current HEAD must still be checked. |
| Node 22/24/26 local | VERIFIED | API Jest 33 suites/476 tests on Node 22.22.3, 24.22.2, 26.13.0; web/admin Next builds succeeded on all three. API build/typecheck succeeded locally, **with offline Prisma types**, not a production runtime. Vercel project metadata reports web Node 26.x; API Dockerfile remains Node 20 Alpine and its exact native runtime is unverified. |
| Lint and types | VERIFIED | API lint and API/web/admin TypeScript pass; web lint exits 0 with three warnings: TanStack virtualizer compiler incompatibility, two `next/image` notices. Admin lint passes. Next reports React 18 deprecation. Warnings remain visible. |
| Web API/contract suites | VERIFIED | 13 commands listed below, 251 checks pass on Node 22. These include simulated network/fixture tests and static contracts, not live providers or complete E2E. |
| PostgreSQL isolated integration | VERIFIED | `npm run test:postgres --workspace aether-api`: 20 checks, real disposable PostgreSQL 17, six migration SQL files, 33 models, indexes, RLS, transactions, tenant checks and outage recovery. Prisma WASM adapter and some auth fixtures; not the native engine, managed deployment, production pooling or throughput proof. |
| Native Prisma CI | VERIFIED | [GitHub Actions run 43009505912](https://github.com/aldaeny/Cloud-play/actions/runs/43009505912) reports success for native engine and real PostgreSQL/PrismaService jobs on Node 22, 24 and 26, Ubuntu 24.04, commit `1a82fb7`. Logs could not be downloaded here because the Actions results host returned EOF; job conclusions and artifacts remain accessible via the run. This does not establish production OS/ABI or pooling. |
| Native Prisma sandbox and production API image | BLOCKED | Local `npm run test:postgres:native --workspace aether-api` exited 1 before DB operations: TLS connection to `binaries.prisma.sh` failed under outbound host restriction. `PRISMA_REQUIRE_NATIVE=1 npm run prisma:generate --workspace aether-api` also exited 1 as designed. Docker unavailable; image build and deployed API engine not tested. |
| Auth, sessions and authorization | BLOCKED | API tests cover selected JWT, profile and ownership boundaries; `docs/AUTHENTICATION_MATRIX.md` inventories 90 routes. Full route-by-route IDOR, live Supabase recovery/refresh/logout, revocation, session expiry during playback and hosting configuration need isolated authorized services. No complete E2E claim. |
| Geo/proxy and territory enforcement | FAILED | `EntitlementService.check` checks only presence of a rights window, not country; `PlaybackService.createSession` currently fails closed before delivering HLS. No trustworthy end-to-end country signal or Vercel-to-backend chain was established. Backend `RightsService` exact-match regression is fixed, but it is **not** wired as a complete Geo decision. Direct/spoofed/proxy/country-change/missing-header tests against real staging remain necessary. `TRUST_PROXY=true` in web rate limiter trusts first forwarded address; do not enable without a verified sanitizing proxy and inaccessible direct origin. |
| Playback and streaming | BLOCKED | Protected API HLS deliberately returns 503; no origin enforcing authorization on every segment is configured. Owner playlist route tests use mocked network. No real HLS decode, pause/resume, channel switching, network recovery or session-expiry test was run. `ffmpeg`, browser and device runtimes unavailable. Supply isolated synthetic fixtures and authorized device lab. |
| Real devices/browsers | BLOCKED | No iOS Safari, Android Chrome, desktop Chrome/Firefox/Edge, Google TV, Android TV or physical television tested in this execution. No device support certified. Historical screenshots or emulated Chromium are not physical-device proof. |
| Security audit | FAILED | `npm audit` reports 0 critical, 0 high, 13 moderate, 8 low (21 total) for the lockfile at execution time; it is not a complete security assessment. Web `safe-fetch.ts` DNS preflight and subsequent `fetch` are separate and cache a public verdict for 60 seconds: DNS rebinding remains a high-priority SSRF risk. Global distributed brute-force/rate-limit controls and complete CSRF/XSS/IDOR/privilege escalation testing are not established. `docs/PINNED_PROVIDER_TRANSPORT.md` covers Nest provider health only. |
| Production database / pooling / restore | BLOCKED | No authorized production-like database, connection budget or backup artifact supplied. Local migrations were applied only in a disposable cluster. `pg_dump`/`pg_restore` are absent, so a separate restore was not executed. `docs/BACKUP_AND_ROLLBACK.md` is an operator procedure, not verified recovery evidence; its old deployment inventory is historical. |
| Load and resilience | BLOCKED | No isolated production-like staging/approved capacity and stop thresholds. No 10/25/50/100-user workload, sustained-load recovery, CPU/memory, connection count, p50/p95/p99, errors or timeout rates were measured. Local unit tests are not a load test. |
| Vercel Preview/Staging | BLOCKED | Read-only Vercel project metadata identifies `cloud-play-iraq`, root `apps/web`, Node 26.x and SSO protection for non-custom-domain deployments. Pushing this branch automatically queued preview deployment `dpl_6gJpnoSFTRG3eaJLaaVdUJHF3pCh` for `1a82fb7`; it was BUILDING at last check. No authenticated request, deployed branch test, Geo, runtime logs or playback verification was performed. Preview shares existing environment targets; do not run mutation/provider tests until isolation is confirmed. Provide SSO-authorized isolated Preview and test accounts/backends; no bypass. |
| Backup, rollback and incident recovery | BLOCKED | Procedures exist in `docs/BACKUP_AND_ROLLBACK.md`; neither restoration into a separate database nor application rollback/secret rotation was executed. Require encrypted backup, checksum, isolated restore verification and documented rollback rehearsal with operator approval. |
| Runtime production logs | BLOCKED | No authorized scoped access/test session for this revision; no claim of absence of critical runtime errors. |

## Central issue list

| Priority | Status | Finding and closure evidence required |
|---|---|---|
| P1 | VERIFIED | RightsService previously used substring matching for malformed territory data or JSON strings. Exact two-letter code matching now rejects malformed/mixed data; seven rejection/legacy cases and differing-country regression in `rights.service.spec.ts`. This fix does not solve missing Geo enforcement. |
| P1 | VERIFIED | API image previously allowed offline type-only Prisma generation to succeed. `PRISMA_REQUIRE_NATIVE=1` now fails the image build if native generation fails; `prisma-generation.security.spec.ts` simulates success, network and non-network failures. Actual Docker image is still BLOCKED above. |
| P1 | FAILED | Geo enforcement absent from entitlement path and trusted proxy boundary unverified. Establish authenticated trusted country signal, deny absent/invalid data as required by policy, integrate and test every path in isolated staging. |
| P1 | FAILED | Web playlist import/stream transport has DNS rebinding window. Replace preflight-plus-fetch with per-hop validated address-pinned transport while retaining correct Host/SNI, TLS verification, redirects, Range, cancellation and streaming limits; prove with real local sockets. Do not expose this owner feature as safe on untrusted infrastructure until fixed. |
| P1 | BLOCKED | Secure HLS origin/segment authorization and device testing absent. Implement/verify authorized isolated origin with expiry/revocation/concurrency and all player lifecycles before enabling. |
| P1 | BLOCKED | Native Prisma in the exact deployment image, production-like pooling, backups, restore, load, and full authentication E2E lack required isolated services/access. |
| P2 | BLOCKED | Web `TRUST_PROXY` setting must only be used with a proven trusted proxy; rate limit is per-process, not distributed. Test distributed enforcement and proxy spoofing on the actual deployment architecture. |
| P2 | FAILED | 21 low/moderate npm advisories and existing web/React warnings remain; inspect `npm audit` and upgrade compatibly with regression tests. |
| P2 | BLOCKED | Full integration across catalog/channels/EPG/favorites/M3U/Xtream/admin/settings, App/Pages navigation and all 90 route ownership rules not demonstrated end to end. No external provider authorization was supplied. |

## Commands and repeatable evidence

```sh
node -v; npm ci --no-audit --no-fund
npm run lint --workspace aether-api
npm run lint --workspace aether-web
npm run lint --workspace aether-admin
npm run test --workspace aether-api -- --runInBand
for s in private public fta films community playlists live channels xtream-url search-security api-bridge rate-limit recovery; do npm run "test:$s" --workspace aether-web || exit "$?"; done
npm run build --workspace aether-api   # offline fallback is NOT an operational build
npm run build --workspace aether-web
npm run build --workspace aether-admin
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p apps/admin/tsconfig.json
npm run test:postgres --workspace aether-api
npm run test:postgres:native --workspace aether-api # currently blocked on engine download
PRISMA_REQUIRE_NATIVE=1 npm run prisma:generate --workspace aether-api # same network block
npm audit
node apps/api/scripts/auth-matrix.cjs
```

Node 24 and 26 were exercised using registry-provided `node@24` and `node@26`; no claim is made for all OS/ABI combinations. The API lint initially failed on a formatting rule in a new test; it was corrected and the full API suite/lint were rerun successfully. One nested `npx tsc` invocation under Node 26 returned npm usage error; the same typecheck was rerun successfully using `./node_modules/.bin/tsc`. No checks were disabled. Prisma fallback warnings and Next/ESLint warnings remain visible. The GitHub workflows are `.github/workflows/verification.yml` and `.github/workflows/native-prisma.yml`.

## Operator inputs needed

1. An isolated, explicitly authorized Preview with SSO access, synthetic accounts and separate test auth/database/media services; exact proxy topology, validated Geo source, and permission to inspect sanitized logs. Never share secrets in chat or commit them.
2. An approved CI runner able to download official native Prisma engines and build/test the exact Node/OS deployment images, plus completed checks for the exact commit.
3. A dedicated load/staging environment and agreed safe stop thresholds, connection budgets and success SLOs; a device lab for the named physical browsers/TVs.
4. Operator-run encrypted backup and restore into a separate database, integrity/readback evidence and approved rollback rehearsal.
5. Authorization and rights documentation before any external content-provider interaction. No production migration, provider probe, production deployment or SSO bypass is authorized by this report.
