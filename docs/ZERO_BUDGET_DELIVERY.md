> Historical baseline at 997fcd1. Follow-up implementation is documented in SELF_HOSTED_PACKAGE.md, CUSTOMER_DEMO.md and the final verified report; incomplete statements below describe that baseline, not newer code.

# Zero-budget commercial remediation — evidence and remaining gates

## Scope and safety

This delivery supersedes earlier paid staging/PITR planning: no budget authorization,
no production deploy, no production/DNS/secret mutations, no new paid service or trial.
Existing `ops/launch-plan.json` remains **unapproved** and is not an instruction to
purchase or provision anything. No external provider has been contacted; the
unauthorized provider default was removed from local Compose. Use only controlled
synthetic media until independently verified redistribution rights are approved.

## Implemented

- Entitlement resolves title ownership from the user's database tenant, rejects
  unpublished/cross-tenant titles and mismatched/unpublished episodes. Plan grants
  and revocation now require tenant scope. Stream counts cover **all** profiles.
- Protected external IPTV checks subscriptions when `FREE_ACCESS=false` on session
  creation **and every manifest/segment/read/renew** through the session guard.
  Expiry, cancellation and inactive/cross-tenant plans deny access. Session creation
  uses the existing PostgreSQL per-user advisory lock and caps concurrency by the
  smaller of operator policy and subscribed plan. Free mode remains explicit in UI
  and config; it does not waive Auth, Geo, rights or session requirements.
- Existing internal subscription tables are reused, not replaced: Starter (1/2),
  Professional (3/5), Business (5/10) stream/device limits, manual activation with
  bounded expiry, revocation, permission checks, tenant-scoped listing and atomic
  audit records. No invoices, charges or payment-provider claims. Renewal currently
  means issuing a new period; **not** a complete tenant SaaS licensing system.
- Additive branding migration: display name and local raster logo path, existing
  colors retained. Authenticated admin settings persist through the backend;
  dashboard displays saved name/logo/background/accent. Server validates field
  allowlist, colors and logo paths, rejects client tenant injection, audits updates.
- Seed requires operator email and unique password >=16 characters, prints neither,
  never overwrites an existing account password, rejects role tenant mismatch and
  remains forbidden in production. No published default admin password remains.
- Local env generator creates unique tenant UUID/encryption key/JWT secrets, selects
  Supabase authority, adds bounded database pool and refuses overwriting `.env`.
  No identity fallback was added. Existing Compose keeps private service bindings.

## API and operator use

Admin routes (DB-derived principal; no caller tenant fields):

| Method | Route | Required permission |
|---|---|---|
| GET / PUT | `/admin/tenant-settings/branding` | `settings:manage` |
| POST | `/admin/tenant-settings/internal-plans` | `licenses:manage` |
| GET / POST | `/admin/tenant-settings/licenses` | `licenses:manage` |
| POST | `/admin/tenant-settings/licenses/:id/revoke` | `licenses:manage` |

Activation body: `userId`, `planId`, `expiresAt` (future ISO date, <=366 days).
Branding accepts displayName, logoUrl, brandDark, brandCard, cyanGlow, magentaGlow,
violetGlow, amberGlow only. Local raster logos must be installed by the operator
under `apps/admin/public/brand-assets/`; there is no upload or domain verification.
The Next bridge forwards only fixed paths, methods and the admin bearer.

No role is silently elevated in a running installation. Seed is local/demo only;
existing operators must explicitly grant the two new permissions to intended roles.
Never run seed on customer/production data to obtain these permissions.

## Reproducible verification

```
npm run build --workspace aether-api
npm test --workspace aether-api -- --runInBand
npm run lint --workspace aether-api
npm run test:postgres --workspace aether-api
npm run test:postgres:native --workspace aether-api
npm run build --workspace aether-admin
npm run test:bridge --workspace aether-admin
npm run build --workspace aether-web
node --test scripts/ops/ops-plan.test.mjs scripts/setup-local-env.test.mjs
```

Local PostgreSQL harness uses a disposable cluster, never DATABASE_URL. Its WASM
engine is **not native Prisma proof**. CI `native-prisma.yml` separately tests native
Prisma on Node22/24/26, isolated real Auth/SMTP and production Docker runtime. The
new real HTTP tenant-settings tests run inside that same native harness, not only
mocks. Synthetic playback additionally tests denied unsubscribed session, plan
concurrency, cancellation/expiry blocking an existing segment, and restoration of
access after a valid manual period. Identity/session authority is explicitly a
fixture in this media test; real GoTrue is a different job, not end-to-end hosted SSO.

## NOT complete / NOT accepted

- Legacy uploaded-VOD session creation still fails closed (503); do not advertise
  complete VOD delivery. M3U/Xtream import success is not playback verification.
- Full hosted Supabase Auth + trusted ingress Geo + player on one deployed target
  not proven. No production deployment authorized. No physical-device proof.
- Tenant SaaS license activation/revocation, seats/server/catalog/storage quotas,
  atomic two-replica quota races and end-to-end domain routing are not implemented
  by these internal end-user subscriptions. IPTV has no device identity limit yet;
  plan maxDevices alone does not prove enforcement in that path.
- Consumer login/home/player white-label wiring and verified custom domains remain
  incomplete; admin branding does not constitute full platform white label.
- Compose does not automatically install self-hosted Supabase/GoTrue/TLS/SMTP or
  provide a tested first-admin production bootstrap. It is not a turnkey installer.
  See FREE_LOCAL_SETUP.md for corrected local instructions and explicit prerequisites.
- Existing disposable cold PostgreSQL backup/restore tests are not storage/Auth/full
  installation recovery. No new full Compose install/upgrade/rollback/MinIO restore
  rehearsal was run locally (Docker unavailable). No customer-data restore performed.
- No integrated payment provider, real charge, invoice or revenue claim. Payment
  adapter intentionally fails closed. No subscription/card/paid resources created.

## Acceptance-based percentages (not marketing estimates)

Technical checklist, **3/10 = 30% accepted**: current application builds; local
unit/HTTP/DB regressions; tenant-scoped admin branding/internal licenses. Seven
unaccepted gates: unified Auth/Geo/player deployment, completed VOD path, authorized
M3U+Xtream delivery validation, full tenant quotas, full consumer white label,
turnkey self-hosted lifecycle, physical-device acceptance. Partial implementation
is not counted as a pass. Final-HEAD CI result must be recorded separately.

Commercial **0/5 = 0% accepted**: complete SaaS tenant licensing/limits, deliverable
self-hosted package, complete customer demo, verified redistribution rights, and
customer support/terms/onboarding acceptance are all pending as full gates.
Production **0/5 = 0% accepted**: approved target deployment, end-to-end ingress/Auth/
Geo, full DR rehearsal, physical devices, and release/security acceptance remain
unproven. These conservative percentages do not erase working subsystems.

First paying customer requires closing these gates, choosing lawful content and
support terms, running installation and restore on customer-owned local resources,
then obtaining a separate explicit release approval. No payment or cloud purchase
is necessary to continue independent local implementation; no budget is requested.
