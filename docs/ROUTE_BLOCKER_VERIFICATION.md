# Route-level blocker verification matrix

All90declared routes, generated from source metadata. Evidence is **fixture-auth/fixture-DB actual Nest HTTP** unless otherwise stated. Missing-token denial is not full authorization proof. Every row remains NOT IMPLEMENTED for complete route-specific ownership/tenant/role lifecycle acceptance unless separate evidence explicitly proves it. No real hosted Supabase session lifecycle executed in this checkpoint.

|Method|Route|Declared guards|Missing-token HTTP|Supabase invalid/disabled HTTP|Full authorization acceptance|
|---|---|---|---|---|---|
|GET|/admin/users|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/users/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PUT|/admin/users/:id/status|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/devices|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/admin/devices/:id/revoke|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/staff|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/staff|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/roles|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/roles|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/audit-logs|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/transcode-jobs|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/dashboard|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/xtream-servers/:id/catalog-sync|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/xtream-servers/:id/catalog-sync|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/xtream-servers|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/xtream-servers/candidates|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/xtream-servers/preferred|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/xtream-servers|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PATCH|/admin/xtream-servers/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/xtream-servers/:id/check|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/xtream-servers/check-all|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PATCH|/admin/xtream-servers/:id/default|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PATCH|/admin/xtream-servers/:id/priority|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PATCH|/admin/xtream-servers/:id/toggle|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/admin/xtream-servers/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/analytics/overview|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/analytics/titles|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/analytics/playback|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/analytics/users|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/analytics/devices|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/billing/plans|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/billing/subscriptions|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/billing/subscription/current|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/billing/checkout|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/billing/subscription/:id/cancel|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/billing/invoices|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/billing/coupons/redeem|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/home|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/search|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/titles/:id|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/titles/:id/episodes|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/admin/titles|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/titles|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/titles/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PUT|/admin/titles/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/admin/titles/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/titles/:id/seasons|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/admin/seasons/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/titles/:id/episodes|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/titles/:id/episodes|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PUT|/admin/episodes/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/admin/episodes/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/titles/:id/rights|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|PUT|/admin/rights/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/home/rows|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/home/rows/:id/items|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/admin/home/rows/:id/items/:titleId|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/admin/home/rows/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/auth/register|NONE (public)|Public — not applicable|Not covered|NOT IMPLEMENTED|
|POST|/auth/login|NONE (public)|Public — not applicable|Not covered|NOT IMPLEMENTED|
|POST|/auth/admin/login|NONE (public)|Public — not applicable|Not covered|NOT IMPLEMENTED|
|POST|/auth/refresh|NONE (public)|Public — not applicable|Not covered|NOT IMPLEMENTED|
|POST|/auth/logout|NONE (public)|Public — not applicable|Not covered|NOT IMPLEMENTED|
|POST|/media/upload-url|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/media/confirm|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/media/assets|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/media/assets/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|DELETE|/media/assets/:id|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/admin/media/assets|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|POST|/admin/media/assets/:id/status|AdminJwtGuard|VERIFIED (401)|Not covered|NOT IMPLEMENTED|
|GET|/notifications|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/notifications/unread-count|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/notifications/:id/read|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/notifications/read-all|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|DELETE|/notifications/:id|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/playback/sessions|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/playback/sessions/:id/heartbeat|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/playback/sessions/:id/end|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/playback/me/progress|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|PUT|/playback/me/progress|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/hybrid/profiles|SupabaseAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/profiles|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/profiles|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|PUT|/profiles/:id|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|DELETE|/profiles/:id|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/profiles/:id/verify-pin|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|POST|/support/tickets|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/support/tickets|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|GET|/support/tickets/:id|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
|PUT|/support/tickets/:id/status|JwtAuthGuard|VERIFIED (401)|VERIFIED (401/403)|NOT IMPLEMENTED|
