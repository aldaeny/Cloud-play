# Commercial-function audit after fab1577

## Verified boundaries, not a payment product

Organization licenses and end-user subscriptions are distinct. Server-side
organization expiry/suspension/revocation guards and PostgreSQL concurrent quota
triggers remain enforced for enrolled tenants. Unenrolled legacy tenants retain
licenseEnforced=false for compatibility: enrollment is an operator release step.
Native PostgreSQL tests cover racing allocations, rollback, cross-tenant access,
expiry, suspension/revocation, renewal and shared Xtream/external-server counts.
These are policy tests, not hardware-capacity or byte/egress quota guarantees.

## Billing source audit

`apps/api/src/modules/billing/payment.adapter.ts` has no provider implementation.
createCheckout, verifyWebhook, cancelSubscription and refundPayment fail with 503.
`billing.service.ts` verifies tenant plans and does NOT create an active
subscription/paid invoice without verified payment. Cancellation refuses missing
provider references or provider failure before any local status update. Coupons
remain honestly unavailable rather than granting nonexistent discounts.

Missing: selected/acquired merchant sandbox, supported currency/country/legal
entity, real signed raw-body webhook controller, event-ID uniqueness/replay store,
provider reconciliation and out-of-order transition rules, payment-to-invoice
accounting, idempotent refunds, prorations/tax, automatic renewal/dunning and
provider-confirmed cancellation. No real-provider calls, credentials or paid
accounts were authorized. Never turn the adapter into a "success" mock to sell it.
Manual internal tiers are explicitly nonfinancial; they are not card billing.

Needed to close: merchant/provider selection and legal authorization, free sandbox
credentials delivered through an operator secret store, sandbox webhook endpoint
permission and test fixtures from that provider. Implement the provider protocol
and durable event ledger only after those semantics are known. No secrets in chat.

## Viewer

Organization library now includes owned-device/profile selection, episodes,
server-derived resume position, periodic progress writes, heartbeat credential
refresh and explicit end. Episode/progress routes use fixed backend paths and
owned profile/tenant authorization; no arbitrary upstream URL or device enrollment
is accepted. Backend grants remain authoritative. Progress UI is best-effort
15-second checkpoints; an abrupt close may lose the last interval.

Not certified: full organization-library browser playback through an actual
operator public GeoIP ingress; device enrollment/revocation UI, complete payment
UI, offline downloads/DRM, accessibility/localization acceptance and physical-device
matrix. Existing public/media browser regressions must still pass after player
changes. Separate synthetic/fixture tests from real infrastructure acceptance.

## Security / observability / recovery

See SELFHOST_PUBLIC_INGRESS.md and STORAGE_DISTRIBUTION_COMPLIANCE.md. Health and
recovery default-package tests remain mandatory. Optional ingress certificates,
MMDB and edge configuration need a separate operator backup/rotation drill; they
are deliberately not silently included in the default secret archive. Backups
contain unencrypted installation secrets and require operator-controlled storage
and access policy. No cloud monitoring or paid alert subscription is provisioned.
Public media query/cookie access logging must stay off; monitor aggregated status,
latency, TLS failures and resource pressure without logging signed media URLs.

## Evidence-based score policy

A score is a heuristic, not certification. Use five equally weighted dimensions
(each /20): local deployment/recovery; authorization/tenant enforcement; public
infrastructure proof; security/license release clearance; customer billing/viewer
acceptance. Award points only from the exact final SHA's recorded test evidence.
Do not give scan-completed points for vulnerability remediation or mTLS fixture
points for real GeoIP accuracy/public DNS/host-firewall evidence. Final report must
state counts, findings and exact missing resources, not claim 100%.
