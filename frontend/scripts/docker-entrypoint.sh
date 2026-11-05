#!/bin/sh
set -eu

dependency_hash="$( { sha256sum package.json package-lock.json; node -p 'JSON.stringify([process.version, process.platform, process.arch, process.report.getReport().header.glibcVersionRuntime])'; } | sha256sum | awk '{ print $1 }')"
hash_file="node_modules/.dependency-hash"

if [ ! -f "$hash_file" ] || [ "$(cat "$hash_file")" != "$dependency_hash" ]; then
  npm_config_legacy_peer_deps=true npm ci --no-audit --no-fund
  printf '%s\n' "$dependency_hash" > "$hash_file"
fi

exec npm run dev -- --hostname "${FRONTEND_HOST:?Set FRONTEND_HOST in .env}"
