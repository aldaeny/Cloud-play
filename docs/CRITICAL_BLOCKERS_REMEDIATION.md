# Critical production blockers remediation

## Final project completion directive — current status

**NOT READY — BLOCKED.** The current implementation and acceptance scope are in [FINAL_PROJECT_COMPLETION_REPORT.md](FINAL_PROJECT_COMPLETION_REPORT.md), with [HARDWARE_VALIDATION.md](HARDWARE_VALIDATION.md) and `docs/evidence/final-*.json`. Older “legacy M3U/Xtream production routes disabled” statements below describe the prior remediation, not the current code: those blanket503 gates have been replaced with live Supabase-session/Geo/IP-bound selection exchange and120-second resource grants. Positive production-handler/live Auth integration is required, not only denial tests. New private-media policy/configuration was not applied to production. Actual hosted Geo/SSO and broader Auth/API Geo policy, long-duration client/device behavior, target soak/distributed quota and managed recovery remain open release gates. No production certificate, merge or deployment is authorized.


## Decision: NOT READY — BLOCKED

This remediation uses **PASS / FAIL / BLOCKED / NOT RUN** per test. Earlier certification vocabulary is historical only. No production release, migration, merge, provider activation, SSO change or secret rotation is authorized.

## A — provenance and scope

Work remains on `arena/d4593efb-cloud-play`, based on `178865f9c5fd050a367f4c3295d760f850eeb61d`. The actual task-start checkout was `0998aee`, not the requested reference `8316f19`; no reset or reference substitution was performed. Inspected status, history, remote, existing reports and CI before edits. Changes through `af7915c` are implementation/test changes; the final documentation commit is identified by Git history and the matching workflow dispatch, not a self-referential SHA embedded here.

No production DATABASE_URL was read for tests. Test databases, SMTP/Auth identities, DNS answers, TLS certificates and media are isolated synthetic fixtures. No real IPTV source was contacted; redchicks.xyz remains BLOCKED / authorization unverified.

## B — DNS rebinding / outbound transport

**PASS (bounded local transport tests):** `node scripts/test-web-contracts.mjs` includes 35 actual HTTP-to-socket playlist security assertions, in addition to existing pinned-fetch tests. Tests exercise synthetic DNS mapping to controlled listeners, blocked/noncanonical/mapped/reserved targets, mixed DNS answers, rebinding, redirects, allowed streams, TLS SNI and certificate hostname validation. Fixtures are not evidence of production ingress.

`apps/web/src/server/{safe-fetch,pinned-get,public-fetch}.ts` remains the pinned HTTP(S) transport. Playlist import/stream and Xtream use it rather than trusting a URL-only validation. Capped manifest reads and child token expiry cannot extend absolute parent expiry. No assertion was deleted or transport bypass introduced.

## C — Geo provenance

**PASS (isolated policy tests):** fresh Geo verification on every protected resource request, not just issuance; bridge signs a fresh hosting assertion per request. Tests cover missing, malformed, forged, duplicate, expired, country/platform mismatch and cross-session binding. Client-supplied country or forwarding header alone is not evidence of hosting provenance.

**BLOCKED (real hosting proof):** latest inspected preview at `e074e58`, deployment `dpl_44RPeDuEnGMefUAfCJQsXFVASewU`, was READY but `/api/external/session` redirected to Vercel login. This is SSO protection, not a Geo PASS. No SSO/settings/secrets were changed. Needs an authorized authenticated preview test session or an independently authorized ingress fixture with trusted proxy provenance; do not send tokens/passwords in chat.

## D — HLS/session boundaries

**PASS (isolated regressions):** fresh resource Geo; short bound leases; parent absolute expiry; safe child URL rewrite; unsupported/ambiguous encrypted HLS KEY/SESSION-KEY declarations fail closed except exact plain `METHOD=NONE`. General secure HLS issuer remains explicitly disabled where delivery is not configured.

**BLOCKED (production compatibility):** legacy M3U import/stream return `503 SESSION_BOUND_PLAYLIST_REQUIRED`; legacy Xtream play/stream return `503 SESSION_BOUND_XTREAM_REQUIRED` in production before network access. Development player paths remain. This intentionally disables unsafe production delivery, not proof that session-bound migration is complete. Production M3U/Xtream playback must not be enabled until equivalent user/session/Geo-bound per-resource delivery exists. No UI redesign, route rename or account/data migration was performed.

## E — actual production image

Initial **FAIL**, CI `43014805716` at `a893abd`: image engine loaded and all isolated PG17 migrations succeeded, then API startup failed with missing `@nestjs/core` (exit1, no OOM). npm workspaces installed conflicting Nest dependencies inside `apps/api/node_modules`; runtime copied only root dependencies. `e074e58` copies the pruned API workspace dependencies too; no startup assertion was weakened.

**PASS**, Docker job `130504593861`, CI `43015256648` at `e074e58`: actual production image, non-root/no baked env/canary/git/docs, native Debian/OpenSSL3 engine load, missing-config rejection, PG17 migrations, actual model query, bounded pool configuration, DB outage503, same-process reconnection, graceful SIGTERM exit0 and restart. Native PostgreSQL matrix Node22/24/26 also PASS on this SHA. This is image proof, not WASM substitution.

`af7915c` extends image verification with specific missing-config cause, unreachable-DB startup and a real held transaction interrupted by DB outage plus rollback-integrity query. **PASS:** all enhanced cases executed in job `130505864150`, run `43015632385` at `a827b17`. The final documentation/status-label-only commit is separately dispatched to keep CI aligned with final HEAD.

## F — load and recovery

Measured response-byte accounting and recovery-query latency were added to `test-progressive-load.mjs`. It explicitly reports unavailable internal Prisma pool queue telemetry instead of calling connection count saturation proof. The isolated Auth workflow executes 10/25/50/100-user bounded waves; it is not a soak, production ingress test, or arbitrary SLO certification.

Previous measured fixture results (historical, not refreshed final-HEAD evidence): 130/325/650/1300 requests, zero errors/timeouts; five observed DB connections; 100-user RSS 526979072 bytes. Previous separate logical restore: 77 tables / 1207 rows; independent database, metadata/FK/RLS/grants checks and truncated archive rejection. See `docs/evidence/certification-*.json` and recovery runbook for original scope. **PASS (refreshed isolated evidence):** run `43015632385` at `a827b17`, Auth job `130505864434`, actual SMTP one-use recovery, refresh/logout, protected browser HLS/DASH and separate logical restore (77 tables / 1207 rows; hashes/indexes/constraints/RLS/grants/FK equal; truncated archive rejected). Load metrics below are bounded fixture observations, not an SLO:

| Users | Requests | Error / timeout | Manifest p50/p95/p99 ms | Process CPU ms | RSS bytes | Measured response bytes | DB connections |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 130 | 0 / 0 | 312.781 / 365.199 / 377.007 | 3247.349 | 258187264 | 1407880 | 5 |
| 25 | 325 | 0 / 0 | 754.931 / 911.863 / 922.047 | 7522.895 | 276250624 | 3520119 | 5 |
| 50 | 650 | 0 / 0 | 1594.443 / 2205.797 / 2367.824 | 14695.513 | 296357888 | 7040422 | 5 |
| 100 | 1300 | 0 / 0 | 3590.361 / 3873.474 / 3927.404 | 28543.297 | 377491456 | 14080752 | 5 |

Recovery query 0.974ms, five connections before/after; complete per-operation latency percentiles and caveats retained in structured evidence. Measured byte total does not include every transport/framing byte or the untimed variant request. Existing legacy harness JSON uses VERIFIED; new progressive results now emit PASS without changing assertions. All six jobs PASS on `a827b17` (native38 checks each on22/24/26, actual Docker12 checks, Auth/SMTP/load/restore, full application/browser/Admin/build regressions).

**BLOCKED:** target-environment soak, internal pool queue/saturation instrumentation, distributed quota behavior, managed backup/PITR/rollback rehearsal. Local logical restore is not managed PITR. In-flight native DB transaction interruption is not proof of in-flight HTTP drain under application termination.

## G — devices

**NOT RUN:** physical Safari iOS, Safari macOS, Chrome Android, Android TV/Google TV and real TV playback. Browser automation and viewport emulation are not physical-device certification.

Hardware acceptance checklist (record device/OS/browser/version/network/tester/time and sanitized evidence): login/logout/recovery; authorized live and VOD playback; manifest/segment expiry and renewal; revoke/country/IP change; seek/pause/resume/background; orientation/fullscreen; remote focus/back/navigation; EPG/favorites/categories; slow network/reconnect; no origin/token leakage. Use controlled authorized media only. Requires device access/tester; no protection weakening.

## Commands and results recorded locally

| Command | Result / scope |
| --- | --- |
| `npm run test --workspace aether-api -- --runInBand` | PASS: 40 suites / 650 tests after Geo/HLS changes |
| API lint + TypeScript; Web TypeScript | PASS after implementation changes |
| `node scripts/test-web-contracts.mjs` | PASS, includes private-player25, playlist45, protected-live9, HTTP/socket/TLS35 |
| `npm run test:postgres --workspace aether-api` | PASS: 36 real isolated WASM PostgreSQL tests; not native/image substitute |
| `npm run build --workspace aether-web` | PASS after af7915c |
| `npm audit --omit=dev --json` | PASS: zero runtime findings |
| `npm audit --json` | FAIL: 18 tooling findings (8 low,10 moderate,0 high/critical); no forced upgrade or suppression |
| `node --check apps/api/scripts/test-{docker-runtime,progressive-load}.mjs` (each file) | PASS syntax |
| Local Docker execution | BLOCKED: no Docker/podman; actual image executed on isolated CI instead |

Warnings remain visible, including action-runtime deprecation. Full application/browser/Admin regressions and isolated real SMTP/Auth/load/restore are gated by final-HEAD CI, not claimed from syntax checks. CI evidence is in `docs/evidence/critical-blockers-*.json` plus workflow artifacts/annotations. Exact final run/SHA is recorded in the completion response to avoid a recursive documentation-only HEAD mismatch.

## Open release gates

1. Trusted hosting Geo proof through authorized SSO.
2. Complete safe production M3U/Xtream session-bound delivery (currently explicitly disabled).
3. Preserve passing CI on final HEAD; `a827b17` passed all six jobs, including enhanced Docker interruption and full application/Auth suites. The following evidence/status-label commit is dispatched again.
4. Target load/soak/pool/distributed limits and managed recovery/rollback evidence.
5. Physical device matrix.

Successful bounded tests do not close these gates. Recommendation remains **NOT READY — BLOCKED**.
