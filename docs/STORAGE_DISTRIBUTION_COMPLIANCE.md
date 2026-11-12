# Storage distribution and source-compliance review

This is an engineering checklist, not legal advice or legal sign-off.

Pinned upstream source releases in Dockerfile.storage (Cloud Play builds):
- MinIO RELEASE.2025-10-15T17-29-55Z (AGPL-3.0):
  https://github.com/minio/minio/tree/RELEASE.2025-10-15T17-29-55Z
- MC RELEASE.2025-08-13T08-35-41Z (AGPL-3.0):
  https://github.com/minio/mc/tree/RELEASE.2025-08-13T08-35-41Z
Dependency security modifications ARE applied to both source builds. Exact
requests are in infra/docker/Dockerfile.storage; resolved go.mod/go.sum/module
lists accompany original SHA256-verified source archives in the conveyed image.
These are not unmodified upstream dependency graphs or vendor binaries. Source
downloads are free; commercial MinIO support is not included.

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
source requirements. CI generates CycloneDX package inventory for all12 scanned runtime images;
that is not a full legal license-conflict analysis. MinIO's current upstream
security/support lifecycle, old pinned binary findings and unfixed advisories
must be triaged before a customer release. No commercial license was purchased.

## Security inventory

scripts/security/scan-runtime.sh pins Trivy 0.76.2 by official release SHA256,
scans all12 actual runtime images (OS and detected Go/module packages),
and emits JSON findings, image IDs, CycloneDX SBOMs and VULNERABILITY_REPORT.md.
All severities and unfixed findings remain visible. Inventory success is **not**
release clearance; actionable HIGH/CRITICAL findings require remediation or an
explicit, documented operator risk decision—not silent suppression. Scanner DB
fetch failure is a failed scan, not "zero vulnerabilities". Reproduce on existing
Linux Docker hardware after the lifecycle builds retained image tags. No paid
scanner account is required. npm audit does not cover these binaries/OS packages.

## Historical remediation after first scan (superseded counts/build state)

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

## Source-build candidate replacing old prebuilt Go binaries

The current candidate uses MinIO RELEASE.2025-10-15T17-29-55Z at exact commit
9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a and MC RELEASE.2025-08-13T08-35-41Z at
commit d6541ea280b73a834b64d4097e21f2be77676104. Official codeload archives are
SHA256-verified in Dockerfile.storage. Go 1.27.4, CGO-disabled cross-builds,
`-mod=readonly`, `go mod verify` and trimpath preserve an auditable build; module
versions are explicitly security-patched as recorded in Dockerfile.storage and
the conveyed resolved manifests. Compiler fixes alone do not fix module CVEs. Output labels identify
these as Cloud Play source builds, not vendor-distributed official binaries.

Exact main source archives (including their upstream license files) and build
instructions are carried at /usr/share/doc/cloudplay-storage inside the image.
This improves source availability but is NOT a reviewed complete corresponding-
source offer: dependency source availability, notices, conveyance and actual
modification/distribution model still require the legal checklist above. Base
images/apt repositories remain mutable inputs; retain final image digests, SBOM
and scan database metadata. This is version/source-pinned, not a claim of bitwise
reproducible images or legal certification. Only passing final CI can validate the
new S3/data-format/restore/upgrade behavior against the retained baseline.
