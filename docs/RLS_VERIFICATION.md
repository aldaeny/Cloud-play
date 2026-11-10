> Current checkpoint: see EXTERNAL_SERVER_MANAGER.md and FINAL_PROJECT_STATUS.md. The older results below are historical, not current scope/counts. Current schema40models/42backend tables; new candidate/rights/evidence/schedule tables have default-deny RLS; isolated PostgreSQL30checks and API544tests. No production migration executed. Isolated Auth/SMTP and native Prisma are now verified on earlier trusted CI; latest source requires its own run. Root production audit0/full18dev; separate mobile audit13including1high. Existing playback/provider integration still has explicitly listed implementation gaps.

# Isolated database RLS verification

## VERIFIED: backend browser default-deny

Migration20261110010000 enables RLS on34previously unprotected backend tables. XtreamCatalogSnapshot already had RLS, so all35backend physical tables (33models+2implicit joins) now enable it. No permissive browser policy is created: these tables belong behind Nest, not a browser Data API. Database owner/service role retains its intentional privileged connection; no FORCE RLS is added. The two cloudplay_* account-sync tables retain explicit owner CRUD policies. No production migration was applied.

`npm run test:postgres --workspace aether-api` executed actual PostgreSQL17,23checks (WASM Prisma engine distinctly labeled). New tests cover:

- All35backend tables RLS flags, anon/authenticated SELECT/INSERT/UPDATE/DELETE privilege denials280assertions.
- Inside a rolled-back isolated transaction, GRANT all four CRUD privileges to both browser roles and verify RLS still hides SELECT/UPDATE/DELETE and rejects INSERT with42501 for every backend table. A populated tenant sentinel verifies row invisibility versus privileged owner visibility. Grants/data are rolled back. No claim that every backend table was populated with multi-tenant relational fixtures.
- Rollback additive migration restores34previously disabled flags and preserves snapshot's existing enabled flag; reapply restores35enabled flags.
- Existing cloudplay_favorites/progress owner CRUD, cross-user reads/writes/owner transfer and anonymous denial tests remain passing.

No SECURITY DEFINER functions exist in application migrations; fixture auth.uid is a stable SQL function, not SECURITY DEFINER. No new grants added by the migration. Production Supabase role defaults/grants were not inspected or altered. Browser service-role credential exposure is forbidden; database owner visibility here is not a live managed Supabase service-role verification.

## IMPLEMENTED BUT UNVERIFIED

Native CI must rerun this additive migration and expanded RLS suite. Full tenant/service-role identity context against real isolated GoTrue/PostgREST is not yet verified. Nest service connections intentionally bypass browser RLS: they must enforce tenant/resource authorization in business code. RLS default-deny is not proof of every-route authorization. Never give service credentials to the frontend.

Rollback file is for isolated/approved recovery only, not a recommended production rollback: it restores the earlier weaker flags. Apply/rollback order and grants must be reviewed before any future production approval.
