#!/usr/bin/env bash
# Original synthetic-media fixture tooling ONLY, not a production media worker.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'CI_FFMPEG_REQUIRES_GITHUB_LINUX_X64' >&2
  exit 1
fi
release=autobuild-2026-11-07-12-47
asset=ffmpeg-n8.1.3-34-ga35157abb9-linux64-gpl-8.1.tar.xz
expected=d9e9ab7ecc262a4d6cdb334b17af16ce227a9ed44d052f194ad0deca1a29e037
root="$GITHUB_WORKSPACE/.cache/fixture-tools"
mkdir -p "$root/ffmpeg"
archive="$root/$asset"
trap 'rm -f "$archive"' EXIT
curl --fail --location --retry 2 --connect-timeout 20 --max-time 240 --proto '=https' --proto-redir '=https' \
  "https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/$release/$asset" --output "$archive"
printf '%s  %s\n' "$expected" "$archive" | sha256sum --check --status
# Explicit member only; no extraction of arbitrary paths or installer execution.
member="${asset%.tar.xz}/bin/ffmpeg"
tar -xJf "$archive" -C "$root/ffmpeg" --strip-components=2 "$member"
chmod 755 "$root/ffmpeg/ffmpeg"
"$root/ffmpeg/ffmpeg" -version
printf '%s\n' "$root/ffmpeg" >> "$GITHUB_PATH"
printf '%s\n' '::notice title=CI FFmpeg::Pinned 8.1 branch build; SHA256 verified; synthetic fixture use only'
