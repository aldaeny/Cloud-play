# External Servers and Content Rights — implemented scope

## Release decision

**NOT IMPLEMENTED — complete requested multi-server platform. Do not deploy.** This document separates shipped candidate/rights/monitoring foundations from missing channel/failover/report-delivery functionality. No production source, data, settings, credentials or migrations were changed. No merge or production deployment. No external IPTV source was probed. Existing Xtream data remains unchanged; candidates are not inserted into viewer catalogs.

## VERIFIED — implementation and executed subsets

- Existing Xtream business service, encrypted credential key and pinned HTTPS socket transport reused, not replaced. External candidates may link existing tenant-owned Xtream IDs without copying credentials. Endpoint URLs (including signed query tokens) are encrypted with existing AES-256-GCM vault. Normal server/list APIs never serialize URL/ciphertext/password. Operator must supply the existing approved server-only XTREAM_ENCRYPTION_KEY; no production key rotated.
- Separate ExternalServer and ContentLicense records. Adding a candidate and a confirmed technical check require no paper authorization. Every create/edit forces candidate+disabled; edit clears attached rights and health evidence. Soft delete preserves health/audit. No route can set production_enabled or auto-select a candidate for user playback.
- Eight requested rights statuses, explicit owner/provider/contact/type/platform/country/commercial/redistribution/territory/date fields, immutable review history and actor/time. Rights approval needs BOTH actual DB permissions xtream:manage and rights:manage, scopeReviewed and issuerVerified confirmations, valid term and redistribution/commercial flags. Revocation/review demotes attached sources. Advisory eligibility rejects other providers, territories/platforms, unreviewed/expired/revoked/noncommercial scopes. It is NOT a publication API.
- Encrypted evidence attachments (PDF/PNG/JPEG/text/email),48KiB each/20 per license, canonical base64 and binary signatures for PDF/images, SHA256, tenant-linked FK, upload actor/time. Normal lists return metadata only. Download requires rights:manage and is audited; UI forces octet-stream attachment, never inline renders. Presence of a document NEVER approves rights. No malware scanner or legal issuer-verification integration is claimed. Files larger than48KiB require future approved object-storage integration; no unsafe file URLs or public buckets.
- HTTPS GET reuses pinned all-address DNS/private/reserved/IPv6-mapped checks, original TLS/SNI hostname, no redirects,8s timeout,1MiB manifest limit,2MiB optional segment limit. HTTP401/403,404/429/500 and redirects are retained without response bodies/secrets. HLS MIME/header/target-duration/references are validated; encrypted key declarations are conservatively protected without fetching keys. Same-origin HTTPS segment references only, optional one-segment fetch needs independent segmentAccessConfirmed. No key acquisition or bypass. Valid syntax/MIME is NOT decoded playback. Generic M3U channels are not falsely marked HLS playback-valid. Master variants are recorded but not recursively fetched.
- ServerHealthCheck is the append-only API history (no delete/update endpoint); retains start/end/status/elapsed/stage-verification/MIME/HLS/segment/licensing fields. Failure stage may be unresolved: transport errors deliberately use TRANSPORT_FAILED_OR_POLICY_DENIED and not_verified rather than inventing DNS/TLS diagnoses. HTTP403 is auth_required, NOT inferred geo-blocking. A provider's signed error page is never logged or returned.
- ServerSchedule:15min/hour/day/week/manual, default Asia/Baghdad display; UTC timestamps and fixed intervals. Durable PostgreSQL compare-and-swap5minute lease, bounded10-source sequential batch, expired lease recovery, fenced completion. Duplicate check CAS60s; no segment downloads on scheduled checks. Worker lifecycle waits on bounded current batch on shutdown. Source deleted/edited cannot retain successful probe evidence. Scheduler is OFF unless EXTERNAL_MONITOR_SCHEDULER_ENABLED=true; configuration requires explicit technical access confirmation and does not imply rights. No production schedule enabled.
- Daily/weekly on-demand tenant-scoped aggregated reports include no-result weeks, separately expose expiry counts and unknown environment status. **Not automatic delivery.** Reports never declare all servers down because a probe fails.
- Admin uses current brand/components/layout; new section below existing Xtream panel, real same-origin authenticated Next→Nest bridge, encrypted intake/updates/delete/rights review/evidence/schedule/history/report controls. No replacement application. Paginated50-source API; license selector currently100-record cap and must be paginated before large-scale use. UI shows page-local counts, NOT fake global statistics.

## APIs

All paths under `/admin/external-servers`; AdminJwtGuard checks real DB staff/role/tenant. Never trust body tenant/owner/role or JWT permission arrays.

|Method|Suffix|Behavior|
|---|---|---|
|GET|/|50-row cursor source page, no endpoint secrets|
|POST|/|Create disabled candidate, ignores caller publication/tenant/rights claims|
|PUT|/:id|Full edit, resets candidate/rights/health|
|DELETE|/:id|Soft delete; retains evidence|
|POST|/:id/check|Confirmed technical GET; optional separately confirmed segment|
|GET|/:id/history|Latest100checks|
|POST|/:id/schedule|Confirmed durable schedule; returns workerEnabled flag|
|GET|/reports/:period|daily/weekly on demand only|
|GET,POST|/licenses|List100/create unverified license|
|POST|/licenses/:id/review|Append review; additional rights:manage|
|POST|/:id/license/:licenseId|Tenant-isolated assignment; never publishes|
|GET|/:id/eligibility|Advisory exact platform/country rights plus recent health|
|GET,POST|/licenses/:id/documents|Evidence metadata / encrypted attachment|
|GET|/documents/:id|Audited confidential content; additional rights:manage|
|GET|/audit|Latest100tenant audit actions, no secrets|

Main Nest production bootstrap's existing request limits/validation/rate limiter remain; new services explicitly validate unknown request objects. Existing staff legacy-JWT authority remains a separately tracked project gap, not a new auth system.

## Database and rollback

Three ADDITIVE migrations:202611110001_external_candidates,202611110002_license_documents,202611110003_external_monitor_schedule. Seven models: ExternalServer,ContentLicense,LicenseReview,LicenseDocument,ServerHealthCheck,ServerAuditLog,ServerSchedule. Composite tenant+entity FKs protect licence/source/schedule relations. Default-deny RLS enabled on new tables; PUBLIC/anon/authenticated grants revoked. Backend continues explicit tenant filtering with the existing trusted service identity; this is NOT browser tenant-policy CRUD. Existing38/39/40model schema and column/index/FK checks expanded as migrations were added. Final schema40models+2implicit tables.

Rollback files under apps/api/prisma/*-rollback.sql. Reverse schedule,documents,candidate migrations in that order ONLY after approved backup and explicit destructive rollback approval. These drop new feature evidence; never execute automatically or against production. No original table rows are rewritten.

## Executed test boundaries

- Local disposable PostgreSQL17/WASM30checks, including real encrypted candidates, tenant isolation, actual Nest HTTP RBAC401/403/404, ignored JWT forged privilege, rights review/revoke/provider-edit reset, encrypted document round trip/binary-type denial, same-tenant FKs, durable scheduler competing replicas/expired lease recovery/disabled jobs/no-result weekly report and all42tables browser grant denial. No production URL used.
- Actual isolated HTTPS socket test (`test-external-tls.mjs`) passed certificate/SNI trust, untrusted-certificate rejection, timeout, valid/malformed HLS and synthetic segment,401/403/404/429/500/302 no-follow/error-body redaction. Test-only dependency routing maps fixture.example onto loopback; production has no routing override. This is actual TLS/GET, not live provider access or actual video decode.
- API Jest fixtures cover success/failure HTTP/HLS/MIME/segment/DRM/policy; socket-pinning tests separately check actual configured request lookup. Do not call fixture HTTP cases live external tests.
- Actual Chromium Admin test with explicit API responses covers candidate save without licence, secret form reset, schedule confirmation/disabled-worker display, deletion/empty state and390/820/1280layout; separate real Nest/DB checks validate backend permissions. Browser API fixtures are not live browser→Supabase staff integration.
- Native CI on Node22/24 remains required for final source SHA. Earlier native success must not be reported as newer scheduler verification. CI annotations and run IDs are recorded in delivery evidence.

## NOT IMPLEMENTED — remaining requested functionality

Independent ServerProvider groups; ExternalChannel/ChannelSource relationships and channel CRUD; multiple licensed sources per channel; explicit primary/backup and authorized failover/transition audit; production publication workflow and runtime rights enforcement on legacy viewer sources; fully parsed general M3U and DASH/DRM capability checks; RTMP and plain HTTP transport; test-before-save API; comprehensive per-stage DNS/TCP/TLS diagnostics/geo evidence and independent probe-environment sentinel; recursive HLS variant/alternate audio/segment container validation; large encrypted object-storage evidence/scanning; persisted SyncJob/SyncJobLog+channel-level jobs rather than reused technical check history; schedule timezone/calendar editing beyond fixed Baghdad intervals; complete monitor dashboard/global counts; provider/failure/licensing reports; automatic weekly report delivery even unchanged; comprehensive UI/worker crash/fencing/load/physical-device acceptance.

These are implementation gaps, not missing provider credentials. No claim of practical unlimited scale: bounded APIs and worker batches are implemented, load/capacity proof is not. No existing sources were migrated or blocked by retroactive rights changes without approval.

## BLOCKED — external approval/setup only

Authorized provider endpoints/technical access, redistribution contracts with verified scope/issuer, approved production migration/deployment/key management, licensed external playback, report delivery address/transport, physical TV/mobile verification. redchicks.xyz remains AUTHORIZATION UNVERIFIED; no probe/retry performed. Public availability or lack of password never implies redistribution/commercial permission.
