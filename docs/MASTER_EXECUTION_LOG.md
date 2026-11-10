# Master execution — actual incremental record

## Phase1 preservation

Initial restored local branch `arena/d4593efb-cloud-play`, HEAD178865f, dirty recovered follow-up files. Default/remote main178865f; remote session branchb1326cc. Staged recovery compared byte-for-byte equal to remote session tip; preserved in named stash, fast-forwarded without reset/discard. Current checkout includes apps/api(Nest/Jest/Prisma), apps/web(Next/custom Node/browser tests), apps/admin(Next, no dedicated tests), apps/worker-media(TypeScript), packages, infra, mobile, supabase SQL. Root npm workspaces, lockfile, existing Native Node22/24 workflow preserved. PR23 already merged, not modified.

## Phase2 public outbound transport conversion

Migrated all seven remaining Web direct public fetch callsites to server-only `publicFetch` -> `safeFetch` -> native pinned socket transport: Xtream catalog/private catalog/private stream proxy, Firebase catalog, regional/world playlists, community metadata, Archive film metadata. Existing caller status handling preserved (401/403 not transformed into successful content). Default redirects denied; callers requesting follow get bounded per-hop validation, same-origin restriction and no HTTPS downgrade. Manual stream loop retains its independent sealed-origin check. Public body maximum24MiB by default plus existing smaller per-adapter limits. Caller AbortSignal reaches actual socket; timer cleanup occurs on response close/error/upgrade. No test loopback exemption exists in production code.

Fresh tests: private local-provider HTTP23, film fixture contracts17, community fixture contracts19, pinned native HTTP19 (includes six publicFetch contract tests), Web typecheck and lint pass (three prior warnings). Contract suites explicitly substitute the transport boundary, while separate socket suite uses actual HTTP. This is not yet Web TLS fixture verification, global SDK certification, or external provider availability evidence.

Remaining direct Web server fetch is internal API bridge; internal private API origin is intentional and operator-selected, path is server-generated, redirects denied. Admin bridge is the same intentional exception. Nest Supabase verification and browser Supabase SDK use configured identity endpoints, redirects denied by Nest; session validation remains owned by Supabase. Nest provider health already pinned. Native browser image/media/casting traffic is not server SSRF and must remain covered by source validation/CSP/browser tests. No production network/settings or redchicks probes performed.

This record is incremental, not project completion; all acceptance gaps in previous blocker report remain unless explicitly superseded with fresh execution evidence.

## Phase3 bounded authorization/resource fixes

Verified latent defect: ProfilesService.verifyPin treated nonexistent profiles as no-PIN and queried only by profile ID. No production caller currently uses this utility (controller already performs owner filtering). Utility now requires owner ID, scopes lookup to owner and fails404 for missing/cross-user profiles; contract tests assert query scope and rejection. Analytics service accepted negative/NaN/unbounded query limits/windows; now enforces integers limit1–100/days1–365 before DB work. Full API33suites481tests and lint passed. This is bounded remediation, not proof all90routes or Supabase-only cutover are complete; legacy identity endpoints/compatibility are intentionally not removed without verified replacement lifecycle.

## Phase4 backend default-deny RLS

Added reversible isolated-tested migration enabling all34remaining backend tables (35total already including snapshot). No browser policies/grants added; Nest owner connections retain existing behavior. Fresh real PostgreSQL23checks include280ACL denials, all-table RLS behavior even after temporary CRUD grants, privileged owner sentinel visibility, existing browser-owned RLS and new migration rollback/reapply. No production DB access. See RLS_VERIFICATION.md for exact evidence and unverified managed service-role/tenant lifecycle scope.

## Phase5 authorized Xtream pull/scheduler/Admin increment

Added server-only six-list adapter, manual protected pull endpoint, opt-in bounded scheduler, per-provider cross-process advisory lock, retries/backoff, durable sanitized failure history/last-good preservation and Admin controls/history. Actual isolated PostgreSQL test proves separate-connection lock denial plus provider-isolated failure/success with fixture retrieval. New local Admin HTTP bridge suite executes actual sockets and checks auth-header/path/method/no-store forwarding boundaries. API35suites496tests, isolatedPG24checks, Admin type/lint/build/bridge passed. Inventory now91routes. Full external sync/playlist adapter/episode expansion/durable cancellation are not complete; limitations explicitly documented in IPTV_OPERATIONS.md. No provider contacts or production schedule configured.

## Phase6 actual isolated Auth/SMTP execution

Reusable GitHub Actions fixture provisions disposable GoTrue2.197.0/PostgreSQL17/Mailpit1.33.1, no production secrets. Auth job in run42866805476 succeeded: actual SMTP signup/confirmation and recovery, nonenumeration response equality, token single-use/expiration/forgery, actual password replacement/old rejection/new login, DB token cleanup, refresh rotation/global refresh-session revocation. Captured actual8PASSannotations in docs/evidence/auth-smtp-975e354.json. This establishes Auth server lifecycle, not browser UI/Nest staff cutover, immediate JWT revocation or every account feature.

## Phase7 controlled runtime dependency remediation

API+worker Nest migration11.2.9/config4.0.4/APIjwt11.0.2 fixes confirmed runtime advisory. Express5 type/HTTP compatibility covered by allAPI499tests, all-workspace builds, cleaninstall. Full audit18(8low10moderate), production-only0. Remaining tooling findings not hidden. See DEPENDENCY_BLOCKER_REVIEW.md for deliberate major-migration rationale and limits.

## Phase8 native outage regression diagnosis/fix (verification pending)

Expanded native suite revealed P1017 in final post-restart query after multiple native pool sockets existed; prior smaller suite happened not to expose it. All preceding native/RLS/pull checks passed. Default WASM did not catch this native-specific stale pool behavior. Explicit pool disconnect/connect added to custom-client recovery test; production PrismaService now offers bounded readiness reconnection without replaying application writes, used by /health. New native-only test fills actual production pool, stops PG, verifies failure, restarts, checks actual readiness recovery. Unit tests cover healthy/no-reconnect, one reconnect, continuing-outage propagation. Fresh native CI is required before claiming regression fixed.

## Native regression closure and phase9 real identity integration

Run42868169946 on af30c0e and run42868976484 on39fc84f succeeded: native Node22/24 now26checks each, including expanded RLS, pull isolation, production readiness reconnect after real DB outage. P1017 regression fixed without WASM substitution or business-write replay. Actual annotations saved for39fc84f.

Auth job in run42868976484 also passed expanded integration: actual GoTrue SMTP + native Nest Prisma app connected to isolated DB, fixture HTTPS identity bridge (CA only in isolated child process), no mocked guard/service/identity. Own profile create/read accepted; forged body owner/tenant/role ignored; cross-user/cross-tenant update/delete404, disabled403, expired/forged/malformed JWT401. Evidence9actual PASS annotations saved. This is representative profile-path integration, not every91route/staff authority/session cutover proof.

## Phase10 actual decoding and image proxy hardening

Generated original test-pattern/sine/VTT fixtures with explicit external ffmpeg executable under ignored cache (binary not committed). Two HLS qualities, two audio tracks and subtitles, DASH and MP4. Chromium against local production build with test-only licensed catalog/media interception:23tests passed, including actual HLS/DASH/MP4 decoding and controls, tracks, broken-stream retry and cleanup/keyboard behavior. No third-party footage or unauthorized provider media used. Not physical-device/Safari/TV certification. Removed unused wildcard Next remote image optimizer allowlist; all existing external artwork uses unoptimized client-side images. Actual requests to optimizer with loopback/metadata/public remote image URLs all400 without upstream access, while local images/navigation/media browser suite passed.

## Backup/restore added

Fresh isolated PostgreSQL25checks include cold physical copy only after clean cluster stop, restore on separate port, exact two-provider catalog/revision comparison, application user/foreign-key/role/RLS preservation and browser credential-table denial after restore. No production backup read or created. This is same-PG17 physical backup proof, not managed Supabase PITR/object-storage/cross-version recovery certification. Native rerun with backup check pending.
