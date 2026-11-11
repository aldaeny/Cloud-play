# Storage distribution and source-compliance review

This is an engineering checklist, not legal advice or legal sign-off.

Pinned official releases in Dockerfile.storage:
- MinIO RELEASE.2025-04-22T22-12-26Z (AGPL-3.0):
  https://github.com/minio/minio/tree/RELEASE.2025-04-22T22-12-26Z
- MC RELEASE.2025-08-13T08-35-41Z (AGPL-3.0):
  https://github.com/minio/mc/tree/RELEASE.2025-08-13T08-35-41Z
No upstream binary/source patches are currently applied. Docker packaging and
hardcoded architecture checksums are in infra/docker/Dockerfile.storage. Official
GitHub downloads are free; commercial MinIO support is not included.

## Release gates

Conveying images/binaries invokes AGPL distribution obligations independently of
whether a network-use trigger applies. Preserve copyright, license text and
notices; provide the exact corresponding source, build/install scripts, and
required dependency/license material using an appropriate compliant delivery
method. A GitHub link alone is not a reviewed source-distribution program, and
upstream availability can change. Archive/mirror exact source and license notices
alongside customer releases, document retrieval and retain evidence. If modifying
the covered network service, review AGPL section 13's corresponding-source offer
obligation to remote users. Review section 6 conveyance/installation-information
requirements for the actual delivery model.

Separate processes talking S3 is not, by itself, evidence that application source
must be relicensed, nor a legal guarantee of compatibility. No license boundary
sign-off is granted. Review the actual combined distribution and any modifications
with qualified counsel. Do not strip license text or label everything proprietary.
A non-AGPL replacement requires a compatible, independently tested S3 adapter and
full backup/restore/media rerun; do not claim it is a drop-in licensed solution.

Debian, Node, nginx, Go dependencies and media tooling have separate notices and
source requirements. CI generates CycloneDX package inventory for storage/API;
that is not a full legal license-conflict analysis. MinIO's current upstream
security/support lifecycle, old pinned binary findings and unfixed advisories
must be triaged before a customer release. No commercial license was purchased.

## Security inventory

scripts/security/scan-runtime.sh pins Trivy 0.76.2 by official release SHA256,
scans the actual built storage/API images (OS and detected Go/module packages),
and emits JSON findings, image IDs, CycloneDX SBOMs and VULNERABILITY_REPORT.md.
All severities and unfixed findings remain visible. Inventory success is **not**
release clearance; actionable HIGH/CRITICAL findings require remediation or an
explicit, documented operator risk decision—not silent suppression. Scanner DB
fetch failure is a failed scan, not "zero vulnerabilities". Reproduce on existing
Linux Docker hardware after the lifecycle builds retained image tags. No paid
scanner account is required. npm audit does not cover these binaries/OS packages.

## Remediation applied after first scan

The initial inventory reported storage HIGH224/CRITICAL10 and API HIGH44/CRITICAL1
(dependency occurrences, not unique exploitable defects). Both Debian runtime
builds now apply available same-distribution apt upgrades. MC moves to the latest
published official free binary release, RELEASE.2025-08-13T08-35-41Z, with official
amd64/arm64 SHA256s. No Go binary is relabeled as patched without rescanning.
MinIO's latest release (RELEASE.2025-10-15T17-29-55Z) publishes no binary assets;
replacing its old binary with a reviewed, reproducibly built source version and
current Go/dependency toolchain is a remaining remediation path—not a claim of
support or a reason to suppress embedded-Go findings. Final counts come from the
final-SHA CI inventory, not these initial counts. New upstream DB advisories can
change counts even without source changes. Package upgrades cannot fix embedded
Go libraries; those require a rebuilt/replaced binary and lifecycle retesting.
