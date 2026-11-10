# Deployment approval runbook — DO NOT DEPLOY

## NOT IMPLEMENTED: complete release approval

Project remains NOT READY FOR PRODUCTION; this runbook is preparatory, not authorization. Remaining gates are listed in FINAL_PROJECT_STATUS.md. Do not deploy/merge/apply migrations/rotate credentials/change Auth/provider settings without explicit approval.

1. Review current branch and source SHA; require successful native Node22/24, actual isolated Auth/SMTP, full regression and strict production audit for that code SHA.
2. Review the coordinated Nest11/Express5/config4/jwt11 runtime migration and worker queue/storage compatibility. All builds/tests are not proof of actual Redis/S3 job processing.
3. Review additive backend RLS migration, rollback implications and isolated restore evidence. Confirm real Supabase grants/policies/service role mapping in an approved isolated environment; do not test destructive operations against production.
4. Complete Supabase-only end-user/staff cutover and account provisioning/client compatibility. Never enable default legacy credentials as a readiness shortcut.
5. Private provider access now requires explicitly approved immutable Auth UUIDs in XTREAM_OWNER_USER_IDS. Email-only config intentionally denies access; see OWNER_ID_ACL.md. Do not look up/reassign ownership purely by an autoconfirmed email.
6. Encrypted provider credentials require existing authorized encryption key; do not rotate keys/credentials without approved access/re-encryption procedure.
7. Scheduler is opt-in via validated server-only XTREAM_SYNC_SCHEDULE. Only explicitly authorized providers; minimum300seconds. No schedule was enabled by this work. Confirm runtime supports up to65second sync requests and DB pool budget for lock/import connections; do not buy capacity automatically.
8. Validate CORS origins/CSP/TLS, internal API/storage/Redis endpoint trust boundaries, production environment validation, monitoring and bounded logs. Redchicks remains blocked/unverified.
9. Obtain explicit deployment and migration approval, approved backup/rollback point, smoke-test plan and operator assignment. Nothing here approves execution.

## VERIFIED CI hygiene

Workflows use read-only contents permission, disposable data and synthetic fixture credentials only, Node22/24 native matrix, clean npmci and14day artifacts. No production secrets inherited into reusable workflows. Full dev audit remains visible; production-only audit is a strict zero-finding gate. Current Actions v4 Node20 deprecation notices are not suppressed; action-runtime upgrade is a separate review.
