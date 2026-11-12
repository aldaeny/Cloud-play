# Operation Zero Limit — execution ledger

## Controls and recovery point
Baseline verified: branch arena/f958d4d9-cloud-play, clean tree at
39761d2b30f67ecbe22dee56d8deccd741ff18ac; GitHub run43132540431 successful6/6
on that SHA. This immutable commit is the recovery point; no reset/history rewrite.
No merge, deployment, cloud resource creation, real payment or provider connection.
Public repository visibility verified through GitHub API; billing/Actions permission
lookup returned403. No spending-limit settings altered. Only existing public-repo
standard Actions workflows are requested, not paid runners/services.

## Actual execution capacity
One coding agent; zero independent subagents available. Parallel tool execution
supports independent inspections/tests, not32 independent AI engineers. All code
review here is self-review and automated regression, not independent sign-off.
The following32 role tracks preserve requested scope without inventing personnel.

|#|Role|This iteration's assignment/status|
|---|---|---|
|1|CTO|Enforce no-spend/no-production and evidence gates|
|2|Architect|Keep PG17 Debian/glibc and volume compatibility; reject Alpine swap|
|3|Project manager|Track owners; single writer per file|
|4|QA director|Exact final SHA complete CI required|
|5|App security|Existing regression; complete endpoint audit remains open|
|6|Infrastructure security|Patch gateway base OS|
|7|PostgreSQL security|Rebuild vulnerable gosu; retain server major/runtime family|
|8|Auth specialist|Real existing Auth/SMTP recovery; comprehensive new audit open|
|9|API security|Existing auth/isolation regressions; OS updates|
|10|Supply chain|Pinned gosu source hash/compiler; retained source/build recipe|
|11|Container security|All12 image SBOM and vulnerability inventory|
|12|Pentest|Existing spoof/isolation suite; independent pentest unavailable|
|13|Docker engineer|Updated gateway/PG images wired to lifecycle and scans|
|14|Infrastructure|No new Kubernetes or cloud resources introduced|
|15|CI engineer|Wire viewer identity helper into regression|
|16|DB reliability|Real native tests and existing restore/hash checks|
|17|Disaster recovery|Full install/upgrade/backup/restore/rollback must pass|
|18|Observability|Existing diagnostic enum; new observability audit open|
|19|Backend|Regression gates; comprehensive additional fault injection open|
|20|Frontend|Identity fence regression; full page audit open|
|21|Integrations|No external services contacted for content/payment|
|22|Streaming|Existing actual generated media transport and VOD tests|
|23|Delivery|Existing TLS/spoof tests; real public CDN/Geo unverified|
|24|Performance|No new before/after load measurements yet|
|25|Cache consistency|Existing suite; new dedicated race audit open|
|26|UX|No identity redesign; broad manual review open|
|27|Responsive|Existing browser/layout regression, no device certification|
|28|Accessibility|Comprehensive accessibility audit open|
|29|Mobile|Physical devices unavailable; browser emulation not equivalent|
|30|Automation|Local policy/report/identity plus full CI|
|31|Release|No release approval until critical/high findings addressed|
|32|Independent auditor|Unavailable; explicit human/independent review gate remains|

## Security changes and rationale
Historical inventory: storage18H/0C, API46H/0C, PG147H/2C,
auth-gateway72H/3C. Raw scan artifact is authoritative; counts are per image,
not deduplicated CVEs and do not measure exploitability.
PG sample exposes gosu Go1.24.6 stdlib (CVE-2025-68121 and others) and
Debian libxml2. Rebuild the same upstream gosu1.19 exact source commit with
Go1.27.4, preserve source and Dockerfile, run privilege-drop smoke check.
Keep PostgreSQL17.11-trixie with OS upgrades; do not remove XML or DB features.
Some OS advisories may remain without fixes; no preemptive clearance claim.
Gateway moves from nginx1.28/old Alpine to official stable1.30.6/Alpine3.24
plus available package upgrades. Source tags verified in docker-library official
images manifest. Config, TLS and lifecycle tests remain mandatory.
Ingress/tools Debian packages upgraded; no required tools deleted.
MinIO module fixes extend to jsonparser1.1.2, thrift0.23.0 and all OTel SDK,
metric/trace modules1.43.0 based on actual scanner fixed-version guidance.
Earlier gRPC1.79.3 and RabbitMQ1.13.0 fixes retained. Resolved patched module
manifests remain in conveyed storage image. Legal compliance not certified.

## Evidence and limitations
Local policy/report tests and viewer identity test run without replacing existing
checks. Final CI and actual vulnerability counts must be recorded separately.
No new production performance/device/Geo/billing acceptance claimed. Historical
65/100 is not automatically increased. Zero critical and unaccepted high findings
is still a launch gate, even if every regression job succeeds.

## Account-switch cleanup correction
Review found player teardown used only the media cookie to end a session. After
an account switch that cookie can represent a different principal. Bind a
single-use best-effort end closure to the original session token; use it both for
stale session responses and player teardown. Do not expose tokens in UI/logs or
switch the new account's state. Helper regression verifies original bearer,
idempotency, keepalive and rejected network calls; TypeScript check passes.
This is not yet full browser acceptance of all cross-account races.
Local baseline API rerun:48 suites/733 tests passed,12.591s Jest wall time;
not a performance comparison or service latency measurement.

## First verified iteration and follow-up (not stopping at green CI)
SHA473dce0, run43137477207:6/6 succeeded including full lifecycle. Actual all-image
scan: gateway72H/3C ->0H/0C; PG147H/2C ->120H/1C; storage18H ->13H;
API unchanged46H. Remaining critical: CVE-2026-6653 in Debian libxml2,
scanner fixed-version absent. GitHub advisory GHSA-v4qw-p44r-qhfg describes XML
internal subset use-after-free; no accepted waiver or safe Debian patch established.
Do not remove database XML functionality or switch existing DB volumes to musl.

Follow-up: pure-JS ingress can use Node22 Alpine3.24 without native Prisma/libc
migration. Tools require npm, so update rather than delete it: npm11.21.2 supports
Node^20.17 or>=22.9, exact registry version verified. Storage Prometheus modules
request0.311.3 and thrift0.24 based on the actual follow-up scan. Compile/lifecycle
compatibility must be proven again; no finding declared closed ahead of rescan.

Historical report arithmetic correction: summing the actual39761d2 per-image
annotations gives404 HIGH (not454 as the previous standalone report stated),
5 CRITICAL,557 MEDIUM,453 LOW and64 UNKNOWN. Baseline individual image counts
were correct; use these recalculated totals. Counts remain occurrence-based.
Compliance document corrected to explicitly disclose dependency patches rather
than leaving its obsolete claim of unchanged upstream modules in place.

Follow-up run43139440557 failed in readonly storage compilation: upgrading
Prometheus pulled split go-openapi/swag, grafana/regexp and yaml modules whose
package checksums were not materialized by `go get`/`go mod download` alone.
Fix: run `go mod tidy` on each patched source tree before download/verification,
manifest capture and readonly compilation. Do not drop readonly compilation,
skip the build or call the partial cycle a pass. Full CI rerun required.

Run43140622704 exposed an upstream test-only dependency graph inconsistency:
`go mod tidy` traversed go-openapi/swag tests and selected a testify/v2 module
without assert/yaml. It failed; no lifecycle/scan completion claimed. Resolve
production import checksums with `go get .` instead of traversing dependency
unit tests. All explicitly requested security versions, checksum verification,
readonly compilation and application/lifecycle regression remain required.
