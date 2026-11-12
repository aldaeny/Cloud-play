#!/usr/bin/env bash
# Findings are inventory, not waived or hidden. A successful scan != release clearance.
set -euo pipefail
mkdir -p .cache/security-tools security-evidence
url=https://github.com/aquasecurity/trivy/releases/download/v0.76.2/trivy_0.76.2_Linux-64bit.tar.gz
curl --fail --location --retry 3 "$url" -o .cache/security-tools/trivy.tar.gz
printf '%s  %s\n' bc0fc726e017b8927a62b2d3531d7a84ee01769daf5c99ed866dced54089fdbf .cache/security-tools/trivy.tar.gz | sha256sum -c -
tar -xzf .cache/security-tools/trivy.tar.gz -C .cache/security-tools trivy
scanner="$PWD/.cache/security-tools/trivy"
"$scanner" --version > security-evidence/scanner-version.txt
release=$(git rev-parse HEAD)
for service in storage api web admin worker tools ingress postgres redis auth auth-gateway mailpit; do
  case "$service" in
    ingress) image=cloudplay-ingress:verification ;;
    postgres) image=cloudplay-postgres:verification ;;
    redis) image=redis:7-alpine ;;
    auth) image=supabase/gotrue:v2.197.0 ;;
    auth-gateway) image=cloudplay-gateway:verification ;;
    mailpit) image=axllent/mailpit:v1.33.1 ;;
    *) image="cloudplay-selfhost-${service}:${release}" ;;
  esac
  docker image inspect "$image" --format '{{.Id}}' > "security-evidence/${service}-image-id.txt"
  "$scanner" image --timeout 10m --scanners vuln --list-all-pkgs --format json --output "security-evidence/${service}-vulnerabilities.json" "$image"
  "$scanner" image --timeout 10m --format cyclonedx --output "security-evidence/${service}-sbom.cdx.json" "$image"
done
node scripts/security/summarize.mjs storage api web admin worker tools ingress postgres redis auth auth-gateway mailpit
