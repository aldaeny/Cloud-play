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
