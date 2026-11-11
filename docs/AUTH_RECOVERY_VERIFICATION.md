# Auth and recovery verification

## VERIFIED

Trusted isolated CI provisions GoTrue2.197.0, PostgreSQL17 and Mailpit1.33.1. It executes actual SMTP delivery and link consumption, not mocked mail functions. `test-auth-recovery.mjs` tests signup/confirmation/no session before verification, password login, recovery request nonenumeration response equality, recovery email, token single-use, expiry/forgery rejection, password replacement with old rejection/new acceptance, auth.users recovery_token cleanup, refresh rotation and global logout refresh-session revocation. Evidence: successful runs42868976484,42869720790,42870237804; saved annotations master-auth-owner.json.

Child `test-auth-nest.mjs` runs actual native Nest/Prisma against disposable database and a fixed local HTTPS identity bridge (test-only CA), with actual GoTrue validation and no overridden guards. It verifies own profile operations, ignored forged identity body fields, cross-user/tenant writes denied, disabled account and expired/forged/malformed tokens denied. Web Supabase SDK private owner ACL is tested with immutable authorized ID versus mismatched ID and insecure legacy-email-only config.

## NOT IMPLEMENTED

Complete account lifecycle acceptance still requires staff/admin Supabase-only migration, safe business-row provisioning/account deletion flow, every91route coverage and actual browser recovery interaction with this real Auth stack. Existing Web recovery UI contract tests remain mocked/structural, not that browser integration. Access-JWT immediate revocation is NOT established by refresh-session revocation; behavior must be specified with short expiry/session checks. No invented alternative password/token authority was added.

## BLOCKED

Production SMTP/delivery domain, real user mailboxes and production account migration/settings are not verified or authorized. This does NOT block the completed disposable SMTP test; the previous statement that isolated delivery could not run is superseded. No production configuration, accounts or secrets were touched. Reproduce with workflow native-prisma.yml dispatch, which calls auth-recovery.yml; do not point these scripts at production.
