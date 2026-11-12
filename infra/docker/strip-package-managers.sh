#!/bin/sh
# Serving images execute node directly; the dedicated operator tools image does
# NOT call this. Remove unused global package-manager code, not scan findings.
set -eu
command -v node >/dev/null
rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
node --version
