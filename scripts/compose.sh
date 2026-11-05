#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export NODE_VERSION="$(<"$repo_root/.nvmrc")"
export PYTHON_VERSION="$(<"$repo_root/.python-version")"

cd "$repo_root"
exec docker compose "$@"
