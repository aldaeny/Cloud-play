#!/usr/bin/env bash
# Disposable GitHub Ubuntu runner only. No TLS/signature bypass, no skipped deps.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux ]]; then
  echo 'CI_BROWSER_HOST_REQUIRES_GITHUB_LINUX' >&2
  exit 1
fi
. /etc/os-release
if [[ "$ID" != ubuntu || "$VERSION_ID" != 24.04 ]]; then
  echo 'CI_BROWSER_HOST_UNSUPPORTED_OS' >&2
  exit 1
fi
# Hosted image's mirror+file config prefers an Azure mirror whose DNS failed.
# Keep Ubuntu's signed repositories; choose the official HTTPS archive instead.
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
fi
printf '%s\n' 'Acquire::Retries "2";' 'Acquire::http::Timeout "20";' 'Acquire::https::Timeout "20";' 'APT::Update::Error-Mode "any";' | sudo tee /etc/apt/apt.conf.d/80cloudplay-fixture-network >/dev/null
printf '%s\n' '::notice title=CI browser host::Official signed Ubuntu archive via HTTPS; bounded package network timeouts; no dependency check disabled'
