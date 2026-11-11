# Production blockers closure — NOT READY / BLOCKED

Date: 2026-11-08 (session date). Branch: `arena/d4593efb-cloud-play`.
Continues baseline `8d27eb62ea69caf0dc838f4f470bd6860f76f29e`.
Final candidate is the commit containing this document (resolve with `git log -1 --format=%H -- docs/PRODUCTION_BLOCKERS_CLOSURE.md`). Final exact-HEAD CI outcome is supplied in handoff, not inferred from earlier runs.

## Acceptance matrix

| Requested blocker | Status | Executed evidence / remaining acceptance |
|---|---|---|
| Global trusted Geo including Supabase login/refresh | BLOCKED | 15 new unit assertions; signed method/path/token-scoped resource-server policy, transactional PG nonce/context ledger and live Auth session checks. Guard covers its protected APIs when explicitly configured. Country/IP changes denied without admin exemption. Real Auth/PG guard integration added. Direct browser Supabase login/refresh still bypasses Nest; authorized ingress/Auth enforcement and hosted proof absent. Optional policy is not a completed rollout. |
| Vercel SSO Staging | BLOCKED | User approved isolated Staging testing, no bypass. Read-only connector confirms project, branch previews and `all_except_custom_domains` SSO protection. Connector exposes deployment metadata, not an authenticated browser session. No SSO cookie/access session provided; no hosted overwrite/provenance proof. No settings/secret changes or manual deployment. |
| Performance and distributed quota | BLOCKED | Actual ten-minute soak and bounded 10/25/50/100 users; candidate fixture SLO passed. Native Docker Prisma saturation/recovery measured. Main ingress/distributed limiter excluded; multi-instance shared quota untested. Production SLO/workload not approved. No capacity claim. |
| Managed DR, Storage, rollback and RPO/RTO | BLOCKED | Earlier isolated logical restore and cold physical restore retained; neither is managed PITR or Storage recovery. User will identify non-production environment and approved scope/cost. No managed restore attempted, no measured production RPO/RTO. Supabase connector has no PITR/Storage restore tool; restoring a paused project is NOT PITR. |
| Six physical hardware targets | NOT RUN | User confirmed devices unavailable. Existing `HARDWARE_VALIDATION.md` is authoritative six-target matrix. HLS/DASH, seek/resume, 45s renewal, offline/recovery must be recorded on each actual target. Chromium synthetic playback is not physical compatibility proof. |
| HTTP drain under load, shutdown/restart | PASS | Real Node HTTP tests: 12 admitted responses finish, new connections refused, forced deadline reported as failure. Actual production Docker image: paused disposable PG holds eight admitted health requests; SIGTERM, resume PG, all eight responses/body checks complete, active count zero, exit zero, restart healthy. Does not certify losslessness beyond 30s deadline or every future long-running route. |

**Strict closure rate: 1/6 requested blockers = 16.7%.** Five are not closed (four BLOCKED, one NOT RUN). This is a requirement-count metric, not total project completion or production readiness. Earlier 12/20 category PASS inventory is historical baseline evidence, not a new final-HEAD certification.

## Measured evidence

Sanitized GitHub check annotations retained in `docs/evidence/closure-isolated-load.json` and `closure-docker-runtime.json` from run **43027603106**, commit **74e0127cbabba1da249b5cb8ad5f69ecccf682d0**. That run was **FAIL overall** (Auth harness cleanup); native Node22/24/26, application regression and Docker passed. No failed assertions were removed or relaxed.

- Soak: 600243ms; five real GoTrue viewers, native PG, Nest, controlled TLS media; 9085 requests, 2995 flows, zero failed flows/errors/timeouts; 15.136 requests/s; p50 124.575ms, p95 209.353ms, p99 325.224ms. DB connections 5 before/after; recovery query 0.987ms. Samples include process RSS; not DB CPU/IO or decoder telemetry.
- Candidate fixture limits set before measurement: p95 <=2s, p99 <=5s, errors <=1%, zero timeouts, throughput >=5rps. NOT approved production SLO. Ten minutes is not hours/days stability certification.
- Docker one-connection native pool: 16 concurrent queries, 5 completed / 11 expected P2024 timeouts, 1014ms saturation, 2.306ms recovery query. Actual eight-request HTTP drain and restart PASS; 15 runtime checks.
- Local API: 687 tests / 43 suites PASS; API lint PASS; Web bridge 23 PASS; both TypeScript projects checked. Full application regression is CI-backed, no local native-runtime substitution.

## Failure retention and corrections

- Run 43025432256 at ef66131: Node26 synthetic playback fixture failed without numeric status detail (Node22/24 passed); retained as failure. Added sanitized numeric HTTP diagnostics, no removed assertions. Next run Node26 passed; original intermittent cause not established.
- Early soak failure handler inadvertently invoked soak again, obscuring the first failure. Removed duplicate execution and published sanitized evidence even on child failure.
- Run 43027603106: ten-minute soak itself PASS; overall Auth job failed during cleanup because synthetic service-role token had a 600s lifetime. Generate a fresh short-lived fixture token per admin operation; no production credentials or Auth config changed. New full CI required.
- Raw GitHub artifact/log downloads fail at network-restricted blob/results hosts. Check annotations via api.github.com remain available; evidence here comes from those annotations, not imaginary downloaded artifacts.

## Resource-server rollout contract (not enabled in production)

`API_GEO_ALLOWED_COUNTRIES` is an explicit API rollout list; malformed/empty policy fails closed. `API_GEO_ENFORCEMENT=true` enables corresponding Web signing, using existing >=32-character external Geo signing key and actual approved Vercel ingress trust. Missing metadata returns denial; generic XFF/X-Country never provides provenance. Require both settings only in an authorized isolated environment after hosted header-overwrite proof. Setting `VERCEL=1` on arbitrary infrastructure does not prove provenance.

API session context: Auth-verified subject/session id, live `auth.sessions` row, four-hour absolute bound; country + HMAC IP fingerprint anchored in existing `ExternalGeoNonce` records with advisory transaction lock. No schema migration. Per-request nonce prevents replay; token/method/path prevent cross-resource reuse; no user role bypass. Optionality is compatibility-preserving pending approved deployment, NOT a solution for direct Auth issuance. Existing media-specific guards remain in place.

## Next authorized execution gates

1. Provide an authenticated SSO Staging browser session through the platform (never secrets in chat). Confirm an isolated backend/Auth fixture target before end-to-end hosted execution; current preview configuration must not be assumed isolated merely because the deployment is preview.
2. Identify non-production Supabase source and independent restore destination, Storage fixture bucket, PITR availability/window, rollback scope and explicit cost approval. Do not inspect/use production DATABASE_URL or restore production.
3. Approve production SLO/workload; execute shared-quota multi-instance and longer ingress-inclusive soak in that isolated environment.
4. Supply six physical devices/operators later; retain NOT RUN until actual logs.

No production migration/deploy/Auth policy/SSO settings/secrets/provider probes or main merge performed. Existing UI and content routes were not disabled to obtain PASS. Decision remains **NOT READY — BLOCKED**, even if final CI is green.

## Follow-up candidate (2026-11-08)

User clarified that atomicity/races/outage/retries and replayable CI are mandatory,
and confirmed Staging resources are **not yet identified**. Global Auth Geo and
SSO proof remain BLOCKED: no hosted middleware-only PASS, no direct-Auth bypass
claim. DR remains BLOCKED, prepared acceptance gates are not restoration proof.
Six-device 72-case CSV is prepared, every result NOT RUN.

New shared-quota implementation and real two-process native CI harness are detailed
in `SHARED_QUOTA_ACCEPTANCE.md`. These replace no successful features; production
rollout is not enabled. Final CI handoff must report actual results separately
from pre-run statuses. `validation/dr-staging-acceptance.json` contains no access
secrets and permits no execution; `validation/DR_EXECUTION_GATES.md` defines required
marker/checksum/ACL/rollback/RPO/RTO evidence for later approved execution.

Overall decision remains NOT READY / BLOCKED. No completion percentage is increased
merely for preparing templates or adding code. Baseline evidence is not re-run
individually; full CI is required here because common API middleware changed.
