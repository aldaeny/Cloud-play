# D1 Option C — implementation evidence and remaining gates

## Scope and history

Work stays on `arena/c5c3c018-cloud-play`, based on verified merged PR #22 (`76df97e`). PR #23 contains the changes; no production deployment or database migration is authorized by this document. Existing Cloud Play UI is preserved.

Existing logical commits: `b9683c2` Prisma generation, `60154d6` dead components, `1758a6e` ownership/rollback docs, `1dc4d1d` Supabase verification, `899beb4` Next.js bridge, `3d91f2d` rate limits, `034aecd` selection/migration, `78b4501` health checks, `8db289b` status docs, `6041688` recovery fix, `db6c9d8` auth compatibility review, `ea04df8` admin panel.

## New verification

`apps/api/src/app.smoke.spec.ts` imports the real AppModule, replaces only PrismaService, initializes the Nest HTTP application and closes it. It resolves all 13 domain services and verifies HTTP routing (404 for a nonexistent route). All 15 checks pass. This is isolated application composition/runtime verification, NOT production bootstrap or PostgreSQL integration verification. It does not execute main.ts production configuration, middleware, or database health endpoint.

Re-run after restoring dependencies:

- API TypeScript: exit 0.
- API `npm run lint`: exit 0.
- API Jest: **26 suites, 253 tests, all passed** (includes the new 15 smoke checks).
- Prior web evidence: 13 suites, 245 assertions; build 53 pages. Not rerun for this backend-only increment.
- Prior admin evidence: TypeScript, lint and build passed. Not rerun for this backend-only increment.

Calling the root ESLint binary selected ESLint 9 and rejected the API legacy configuration. The supported API workspace `npm run lint` correctly selects its ESLint 8 and passed; no configuration workaround was introduced.

## Changed areas across PR #23

- `apps/api/scripts/generate-client.cjs`, API package/lockfile: native-first generation, explicit offline types-only fallback. The 18 missing generated-type errors are resolved; fallback does not provide a query engine.
- `apps/api/src/common/supabase-auth.*`, AppModule: authoritative Supabase token verification, fail-closed guard, no account creation or email-based linking.
- `apps/web/src/server/api-bridge.ts`: same-origin server-side transport, bearer forwarding, bounded timeouts, redirect refusal, safe errors.
- `apps/web/src/server/rate-limit.ts` and API routes: per-instance throttling, no-store 429 with Retry-After. Not a distributed quota.
- `apps/api/src/modules/admin/xtream-*`, Prisma schema and additive migration/rollback: priority, default, candidate ordering and bounded operator-triggered health checks.
- `apps/admin/components/xtream-servers-panel.tsx`: real backend priority/default/status/check controls; no fabricated metrics.
- AccountProvider/AccountPanel and recovery tests: recovery event and actual password update path.
- Six unreferenced fake-content components removed; FEATURE_STATUS corrected.
- `docs/SERVICE_OWNERSHIP.md`, `docs/BACKUP_AND_ROLLBACK.md`, `docs/AUTH_HARDENING_REVIEW.md`: service ownership, backup/rollback procedure and compatibility gates.

## Incomplete architecture cutover — do not describe as finished

Supabase remains the live web identity/session source and PostgreSQL remains the intended single application store. The new guard and bridge are additive foundations. Existing NestJS end-user identity routes and legacy JWT guards remain: controllers have NOT all been migrated to Supabase authentication, and business operations have NOT all been routed through the bridge. The offline Prisma client cannot prove live queries. The migration of all operations and removal/disablement of duplicate identity endpoints require a verified engine, database readiness, controller-by-controller permission tests and a coordinated cutover. No new independent identity store or database was introduced.

The previously observed database has two public application tables, no Prisma tables and one auth user; this is prior audit evidence, not a fresh production query in this increment. Backup instructions are not proof of a completed managed backup.

## Security and operational blockers

- IPTV provider: **BLOCKED — ORIGIN UNAVAILABLE / AUTHORIZATION UNVERIFIED**. Do not bypass restrictions or infer credentials are invalid from 521. Health tests use controlled fixtures.
- Previous connector evidence marked XTREAM_PASSWORD and XTREAM_PROXY_SECRET sensitive. This does not prove credential rotation. Provider-issued password rotation remains blocked pending authorized provider access; secret rotation must account for existing signed links.
- Supabase auth settings were reviewed, not hardened automatically: no SMTP, limited email quota, UI password minimum coupling, recovery/current-password incompatibility. See AUTH_HARDENING_REVIEW before changing settings.
- Synchronization with a live IPTV provider is not verified. Operator health sweeps are not catalog synchronization or a background scheduler.
- Public Series remains an honest empty state: no verified rights-cleared series catalog was supplied. No fabricated series or unauthorized sources were added.
- No production deployment, destructive migration, production deletion, or provider credential probe occurred in this increment.

## Required next evidence/gates

1. Authorized IPTV credential rotation and signed-link rollover plan.
2. Verified backup and restore rehearsal before database changes.
3. Native Prisma engine and isolated PostgreSQL migration/runtime tests.
4. Incremental controller migration to Supabase guard with tenant/subscription/permission coverage, then coordinated retirement of legacy user auth.
5. SMTP and compatible account-hardening configuration with approval.
6. Rights-cleared Series catalog and authorized provider synchronization fixtures/specification.
7. Verified staging deployment and explicit production approval; PR #23 remains unmerged.

## Real isolated PostgreSQL verification (follow-up)

`npm run test:postgres --workspace aether-api` now provisions a fresh **real PostgreSQL 17.11** cluster from the pinned-major embedded-postgres development dependency. It never reads DATABASE_URL, binds only loopback on a dynamically selected port, applies all five checked-in SQL migrations in order, and removes its cluster and generated test client afterward.

**11 real checks passed:** Prisma query/version, all 32 model delegates, all model column presence and scalar nullability, foreign-key counts and declared unique indexes, nested create/relationship/defaults, update/read, unique violation P2002, foreign-key violation P2003, interactive transaction rollback, disposable deletes, actual server stop/query failure/restart/recovery.

This client uses Prisma **5.22.0's real npm-shipped WASM query engine**, matching `@prisma/adapter-pg` and node-postgres, not a database mock. A test-only schema enables the driverAdapters preview feature. Node 22 needs a loader adaptation in the temporary generated client to compile the unchanged WASM bytes; no tracked generated engine or production schema is patched. The production native PrismaService path remains unverified in this network and still requires native generation before deployment. This closes real model/query/migration verification, not production bootstrap verification.

Observed schema caveat: Prisma's generated migration declares scalar array columns (e.g. Title.genres) nullable at the PostgreSQL level even though Prisma lists are required. The test checks those columns exist but explicitly excludes list nullability equivalence. No production schema was changed to hide this distinction. Explicit non-unique index performance and exhaustive writes of all possible model combinations are not proven by these checks.

API regression re-run: **26/26 suites, 253/253 tests**, lint exit 0, build exit 0. These are separate from the 11 real database checks. No live Supabase query, provider access, SMTP delivery, merge or deployment was performed.

## Current phase: profiles integration, transport hardening and final evidence

The database runner now has **12** checks: it also loads compiled AppModule with the real WASM Prisma client, runs the real SupabaseAuthGuard and ProfilesService over HTTP, and verifies owner scoping and the hash-free profile response against the real local database. Only Supabase verification is a fixture in this combined test; no live auth authority is contacted. `pretest:postgres` builds the backend to avoid stale compiled controllers.

New files: HybridProfilesController, its six HTTP authorization tests, Next.js `/api/account/profiles`, and `docs/HYBRID_API_CONTRACTS.md`. ProfilesModule registers the new read-only route. The legacy route and visible UI are unchanged. This is an implemented/tested migration surface, not completed end-user UI integration.

Bridge hardening: bounded response reads (256 KiB, both declared and chunked), cancellation, opaque upstream errors, failure on truncated/empty unexpected success bodies, safe handling of unserializable request data. Previously body-read failure could be represented as successful null data; that is now rejected.

### Fresh read-only external inspection

- Supabase project remains ACTIVE_HEALTHY, PostgreSQL 17.11.0.011.
- Public tables remain exactly `cloudplay_favorites` and `cloudplay_progress`, both RLS enabled. Prisma tables still absent. No application row contents were retrieved or changed.
- Auth configuration still has no SMTP host, autoconfirm true, minimum password length 6, HIBP/captcha off, refresh rotation true and production redirect URL configured. Settings were NOT modified. Actual recovery email delivery, token expiry/invalid-token handling across the hosted service, subsequent new-password login and old-password rejection are still BLOCKED/unverified; rendering/static tests are not equivalent.
- Vercel project metadata confirms XTREAM_PASSWORD and XTREAM_PROXY_SECRET are sensitive. Values were not decrypted. Rotation and runtime availability were not verified. Production still points to PR #22 (`76df97e`); Git integration automatically created a READY/STAGED preview for `1710392`. No deployment/promote API was called; a preview is not production verification.

### Current QA

- API: 27 suites / 259 tests, all passed; lint and build exit 0.
- Real isolated PostgreSQL: 12 checks passed, separately counted.
- Web: all 13 non-browser suites, **251 checks**, all passed. Lint exit 0 with three warnings (TanStack compiler compatibility, two image optimization notices).
- API/Web/Admin builds: all exit 0; web 53 static pages plus the new dynamic API route. Admin lint exit 0. Build TypeScript checks passed.
- No standalone admin test script exists; do not interpret its successful build as full admin functional verification.
- Browser responsive/playback/device tests were not rerun in this phase. No physical iPhone/Android/TV verification.
- Build warns React 18 support is deprecated in Next.js 16; no unrelated framework upgrade was attempted.
- Fresh npm audit: **31 findings (11 low, 16 moderate, 4 high, 0 critical)**. High entries: @nestjs/cli, glob, picomatch, tmp. They include development tooling paths. No blind force-upgrade was performed; security remediation and regression validation remain outstanding.

### 13-module state matrix (integration, not file existence)

| Module | Status | Evidence / gap |
|---|---|---|
| Catalog | IN PROGRESS | Controller/service tests and module resolution pass; legacy JWT routes; production UI uses existing source catalogs, not verified Nest APIs. |
| Identity | IN PROGRESS | Legacy auth tests pass; login/register/refresh/logout remain alongside Supabase; removal awaits verified replacements. |
| Profiles | IN PROGRESS | New Supabase read route + Next proxy + HTTP ownership tests + real local PostgreSQL HTTP read verified; writes/UI cutover pending. |
| Rights | IN PROGRESS | Service tests pass; no independently verified frontend integration. |
| Playback | IN PROGRESS | Session/progress/free-access service tests pass; legacy JWT; real licensed upstream playback not verified. |
| Media | IN PROGRESS | Admin-only upload/assets routes and tests exist; real storage/transcode integration not verified. |
| Entitlement | IN PROGRESS | Subscription/rights rules tested with fixtures; no production subscription authorization evidence. |
| Billing | BLOCKED | Service tests pass; PaymentAdapter explicitly reports no verified payment provider; no real checkout claim. |
| Editorial | IN PROGRESS | Admin routes/tests and title proxy exist; no deployed database content workflow verification. |
| Admin | IN PROGRESS | Existing login/title/server proxy and real-data panel code; backend tests pass; deployed API/database workflows pending. |
| Notifications | IN PROGRESS | JWT-protected controller + service tests; no verified frontend usage/delivery. |
| Support | IN PROGRESS | JWT-protected ticket controller + service tests; no verified frontend usage. |
| Analytics | IN PROGRESS | Admin controller/service tests; no verified live system metrics/UI integration. |

All 13 pass isolated composition tests. Only the explicitly described local profiles HTTP test combines one business operation with real PostgreSQL. Other modules must NOT be described as fully integrated.

### Component acceptance states

- **COMPLETED AND VERIFIED:** disposable PostgreSQL test harness; 32-model read/column/constraint coverage within its stated limits; profiles read HTTP/proxy contract tests; bridge transport bounds; previous dead-component removal retained; successful local builds/regressions.
- **IMPLEMENTED BUT NOT VERIFIED:** production native Prisma runtime, deployed multi-server admin interaction, hosted recovery completion, complete browser/device regression for this revision.
- **IN PROGRESS:** full hybrid cutover, single-authority consolidation (legacy endpoints retained), all-module frontend integration, user/subscription/admin workflows, performance validation and comprehensive API security audit.
- **BLOCKED:** authorized private provider access/rotation, SMTP delivery, production migration/deployment approval, verified production backup/restore, real payment provider.
- **NOT IMPLEMENTED:** full multi-provider catalog synchronization/history/notifications; verified rights-cleared public series catalog; complete admin sessions/logs/configuration UI. Series honest empty state is preserved.

### Migration readiness and next actions

Five SQL migrations work on the fresh isolated PG17 cluster; this does not establish safety against unknown production data or Supabase exposure policies. Before any production apply: verified backup + restore rehearsal, current schema diff, role/grant/RLS design for all new public tables, tenant/identity provisioning, native runtime or separately reviewed adapter adoption, permission and subscription coverage, then explicit approval. Existing migration SQL must not simply expose all 32 tables via Supabase REST without a reviewed access policy. No production DDL has been executed.

Next independent work: remediate dependency advisories with focused upgrades/tests; extend incremental Supabase API surfaces and real-DB authorization tests; add recovery lifecycle tests in an isolated auth/email environment; implement provider-independent synchronization against controlled fixtures. None of these warrants declaring the platform production-ready today.
