> **Current External Manager checkpoint:** see [EXTERNAL_SERVER_FINAL_ACCEPTANCE.md](EXTERNAL_SERVER_FINAL_ACCEPTANCE.md). Runtime `955e4e2` adds actual multi-provider groups/channels, rights-gated failover/playback, durable report outbox and evidence quarantine/scanning. Current schema46models/48backend tables and126declared Nest routes. Local39suites584tests and36isolated PostgreSQL checks pass. Historical missing-feature statements/counts below retain their original evidence context; they do not supersede the new acceptance report. Production acceptance remains blocked, not granted.

> Historical evidence subset. Current routes108/models40/backend tables42. See EXTERNAL_SERVER_MANAGER.md for added routes, tests and scope. Earlier counts are retained with their run context.

# Authorization matrix — current91declared Nest routes

## VERIFIED evidence subsets

Full API499tests include actual HTTP missing-token denials on86protected routes;31end-user routes invalid/disabled tests use fixture Auth/DB. Separate trusted CI uses real GoTrue+native Prisma+Nest for profile create/read, missing/expired/forged/malformed/disabled denials and cross-user/cross-tenant update/delete. Actual Admin catalog HTTP tests use real DB roles/tenant boundaries and signed legacy JWTs; they do not prove staff Supabase cutover.

## NOT IMPLEMENTED complete acceptance

The default end-user authority remains legacy unless API_END_USER_AUTHORITY=supabase; staff/admin login remains legacy. Verified replacement profile integration is not enough to silently remove mobile/legacy contracts or migrate existing accounts. Provisioning/default tenant mapping, staff identity cutover and every sensitive-route behavioral CRUD/permission/session verification are incomplete. Never infer authorization from guard declaration alone. Main production bootstrap applies rate limiter/DTO validation; test-created Nest apps do not automatically include that middleware unless explicitly installed.

|Method|Route|Guard declaration|Missing-token HTTP|Real Auth/DB authorized/ownership evidence|Complete route acceptance|
|---|---|---|---|---|---|
|GET|`/admin/users`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/users/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PUT|`/admin/users/:id/status`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/devices`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/admin/devices/:id/revoke`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/staff`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/staff`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/roles`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/roles`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/audit-logs`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/transcode-jobs`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/dashboard`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/xtream-servers/:id/catalog-sync`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/xtream-servers/:id/catalog-sync/pull`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/xtream-servers/:id/catalog-sync`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/xtream-servers`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/xtream-servers/candidates`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/xtream-servers/preferred`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/xtream-servers`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PATCH|`/admin/xtream-servers/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/xtream-servers/:id/check`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/xtream-servers/check-all`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PATCH|`/admin/xtream-servers/:id/default`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PATCH|`/admin/xtream-servers/:id/priority`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PATCH|`/admin/xtream-servers/:id/toggle`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/admin/xtream-servers/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/analytics/overview`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/analytics/titles`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/analytics/playback`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/analytics/users`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/analytics/devices`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/billing/plans`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/billing/subscriptions`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/billing/subscription/current`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/billing/checkout`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/billing/subscription/:id/cancel`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/billing/invoices`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/billing/coupons/redeem`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/home`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/search`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/titles/:id`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/titles/:id/episodes`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/titles`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/titles`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/titles/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PUT|`/admin/titles/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/admin/titles/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/titles/:id/seasons`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/admin/seasons/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/titles/:id/episodes`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/titles/:id/episodes`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PUT|`/admin/episodes/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/admin/episodes/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/titles/:id/rights`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PUT|`/admin/rights/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/home/rows`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/home/rows/:id/items`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/admin/home/rows/:id/items/:titleId`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/admin/home/rows/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/auth/register`|NONE (public)|Public|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/auth/login`|NONE (public)|Public|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/auth/admin/login`|NONE (public)|Public|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/auth/refresh`|NONE (public)|Public|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/auth/logout`|NONE (public)|Public|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/media/upload-url`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/media/confirm`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/media/assets`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/media/assets/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/media/assets/:id`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/admin/media/assets`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/admin/media/assets/:id/status`|AdminJwtGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/notifications`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/notifications/unread-count`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/notifications/:id/read`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/notifications/read-all`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|DELETE|`/notifications/:id`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/playback/sessions`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/playback/sessions/:id/heartbeat`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/playback/sessions/:id/end`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/playback/me/progress`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PUT|`/playback/me/progress`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/hybrid/profiles`|SupabaseAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/profiles`|JwtAuthGuard|VERIFIED 401|Representative real GoTrue/Nest/native DB fixture tests|NOT IMPLEMENTED|
|POST|`/profiles`|JwtAuthGuard|VERIFIED 401|Representative real GoTrue/Nest/native DB fixture tests|NOT IMPLEMENTED|
|PUT|`/profiles/:id`|JwtAuthGuard|VERIFIED 401|Representative real GoTrue/Nest/native DB fixture tests|NOT IMPLEMENTED|
|DELETE|`/profiles/:id`|JwtAuthGuard|VERIFIED 401|Representative real GoTrue/Nest/native DB fixture tests|NOT IMPLEMENTED|
|POST|`/profiles/:id/verify-pin`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|POST|`/support/tickets`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/support/tickets`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|GET|`/support/tickets/:id`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
|PUT|`/support/tickets/:id/status`|JwtAuthGuard|VERIFIED 401|Scoped existing tests; not complete route-specific evidence|NOT IMPLEMENTED|
