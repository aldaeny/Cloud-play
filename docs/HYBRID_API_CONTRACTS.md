# Incremental hybrid API contracts

## Read profiles (additive, not a UI cutover)

Browser-facing: `GET /api/account/profiles` (Next.js Pages API).
Backend: `GET /hybrid/profiles` (NestJS ProfilesModule).

- Header: `Authorization: Bearer <Supabase access token>`.
- Next.js forwards only to the fixed backend path via server-only API_INTERNAL_URL. No target path, userId, email or tenant query parameter is forwarded.
- SupabaseAuthGuard calls the existing Supabase verification service, resolves AppUser by immutable Supabase id, and requires active status. It does not provision accounts.
- ProfilesService scopes rows by the verified AppUser id and uses publicProfileSelect (no PIN/password hashes).
- Success: HTTP 200 `{ "data": [ public profile objects ] }`; Cache-Control: no-store.
- Next.js errors: `{ "error": "<safe bridge code>" }`. 401 missing/invalid session; 403 inactive/unprovisioned; 503 absent/misconfigured/unavailable API or auth authority; 502 malformed/oversized/truncated successful upstream response; 405 writes; 429 local quota exceeded.
- Existing NestJS `/profiles` remains unchanged and legacy JWT-protected. No legacy identity endpoint is removed. The visual frontend is not switched to this endpoint yet.
- Rollback: remove the new Next.js route and HybridProfilesController registration; no migration or data rollback required.

## Verification boundaries

`hybrid-profiles.http.spec.ts` exercises the real Nest HTTP adapter, guard and ProfilesService with fixture Supabase verification/database providers: six authorization/ownership contract tests. This is not live Supabase verification.

`api-bridge.test.mjs` invokes the real Next handler with fetch fixtures and verifies fixed-target forwarding, method restriction, missing configuration, bounded streaming body reads, transport errors and opaque error responses (23 checks total).

`test:postgres` separately verifies the real Prisma/PostgreSQL path; it is not a combined browser-to-production end-to-end test. Existing UI uses its established account/library flow until business provisioning, schema deployment, staging and permission tests support a coordinated cutover.

## Provider metadata import/status (admin)

See `IPTV_SYNC_ARCHITECTURE.md` for the exact full-export JSON contract and limits. GET/POST `/admin/xtream-servers/:id/catalog-sync` use verified legacy admin context + xtream:manage, never browser-supplied tenant/roles. Status excludes raw snapshots and credentials. POST success is 201; invalid/incomplete export is 400 with FAILED history preserved; competing import is 409; wrong tenant/disabled provider is 404. These routes are reachable through the existing admin server proxy but no visible sync UI has been added. Scheduled/online provider pulling is NOT implemented. Native backend runtime and production schema deployment remain separate approval gates.
