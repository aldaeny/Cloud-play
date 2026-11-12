# Continuation after merged cff4c492

No historical commits, successful tests or reports are replaced by this note.

## Candidate runtime migration (requires final image/lifecycle evidence)

Storage runtime changes from Debian12 to Alpine3.24. MinIO/MC remain exactly the
same source commits and Go toolchain; CGO-disabled binaries do not require glibc.
The image retains `/bin/sh`, curl, CA certificates, binary paths, source archives,
entrypoint, S3 ports and named volume paths. No storage data or ownership migration
is performed. Operator scripts assuming Debian apt inside this container must use
the retained old image or adapt explicitly; it is not a general-purpose OS image.

API runtime moves to Node22 Debian13 (trixie), while build stays Debian12. The
native Prisma/OpenSSL3 and argon2 libraries built against older glibc must actually
load and pass the production Docker/native tests on the newer runtime. Node22,
API routes, ports and database schema are unchanged. Do not assume compatibility
from image names; the final CI result is authoritative. No destructive schema
migration or customer volume overwrite is authorized.

These changes address the old base OS package surface, not embedded old Go module
advisories. The exact final scan must report both improvements and regressions;
all severities and unfixed findings remain visible. `remediation-plan.json` adds
machine-readable OS/ecosystem/fixed-version/target details; CRITICAL and available
fixes sort first. It is an inventory, not release clearance. No severity filter or
ignorefile is introduced.

## Viewer identity isolation

Library now fences asynchronous catalog, episode, playback and heartbeat results
across account change/logout/unmount. Same-user token refresh/focus does not reset
playback. State is cleared on identity change; stale created sessions are ended
best-effort using the original authenticated request identity. Pending-play locking
is synchronous so two rapid clicks cannot race before a React render. Backend
ownership, live Auth and tenant checks remain authoritative. This does not claim
that changing a browser account revokes every old server-side Supabase session.
Actual account-switch UI/browser acceptance remains distinct from helper contracts.

## Intermittent local PostgreSQL VOD denial

Previous final-HEAD local WASM run once observed201->403; unchanged retry passed.
The test now retains the same mandatory201 assertion and adds an allowlisted
backend denial enum (no tokens/credentials) to failure diagnostics. No retry,
time-window increase, test skip or assertion relaxation is added. Root cause is
not considered closed merely because a rerun passes.

## Remaining external/engineering gates

Existing authorized public/staging host, DNS/certificates, real licensed MMDB,
private CA/firewall ownership and an external test client are still required for
public ingress acceptance. Geo fixtures are not real infrastructure provenance.
Merchant selection/authorization/free sandbox credentials and approved webhook
semantics are needed for real billing. Legal source-distribution review and
physical-device resources remain outstanding. No paid service or public production
deployment is authorized. Runtime CVEs and unfinished viewer features must be
reported, not hidden behind a green lifecycle.

## Complete fleet inventory and smaller serving images

The security job now inventories storage, API, web, admin, worker, operator tools,
private ingress, PostgreSQL, Redis, GoTrue, nginx and Mailpit, retaining IDs, all
findings and SBOMs for each. Operator tools intentionally retain migration/build
CLI dependencies; findings there are not silently excluded. Scanner annotations
are short samples; full remediation-plan.json and Markdown retain every finding.

Web/admin/worker install all build dependencies and run their original builds
before pruning development dependencies from the final serving image. No host/CI
test dependency or test command is removed. The dedicated tools image is NOT
pruned: lifecycle migration/bootstrap/restore support remains mandatory. Private
Node ingress uses the same Node22 Debian13 runtime family as API. These are
candidate image changes until the exact final Docker lifecycle passes; retain
old release images for safe snapshot rollback. No customer schema change occurs.

Operator tools also move to Node22 Debian13, retaining the complete Prisma CLI
and all required migration dependencies. Real bootstrap/migrate/upgrade/restore
commands must pass on this runtime; no CLI is replaced by a simulated operation.
