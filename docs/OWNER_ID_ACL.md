# Private provider owner ACL security correction

## Defect and safe migration boundary

Verified source defect: Web `requireOwner` used a verified Auth email as its only allowlist principal. With autoconfirm enabled, registration does not establish email ownership; someone signing up with a configured owner's email could satisfy the old ACL. Core Nest identity mapping already correctly uses immutable UUID; Web private player/playlist import did not.

Web private access now requires `XTREAM_OWNER_USER_IDS`, a server-only comma-separated list of explicitly authorized Supabase Auth UUIDs. The IDs are compared only against the identity returned by actual Auth getUser. Browser user IDs, emails/roles and token claims are not authorization inputs. XTREAM_OWNER_EMAILS may be retained for labels/compatibility parsing but **never grants access**. Missing IDs deny with OWNER_NOT_SET. SDK getUser calls are restricted to configured HTTPS identity origin, redirects denied and5s deadline. No production configuration was changed.

Before any approved deployment, authorized operator must independently establish the real owner's immutable Auth ID and configure the server-only allowlist. Do NOT derive ownership from an unverified email or blindly copy every user with matching address. Existing email-only private access intentionally fails closed until IDs are approved. This security-relevant compatibility change requires deployment review; no credential/key rotation required or performed.

## Execution evidence

Fresh private-player23 and playlist44contract checks passed, including legacy-email-only denial, ID validation/de-duplication and unauthenticated denial. Local provider HTTP fixture transport remains separately marked. Actual isolated GoTrue/Supabase SDK identity+owner-ID acceptance/mismatch/legacy-email denial is added to trusted Auth CI; do not mark that new check verified until its run passes.
