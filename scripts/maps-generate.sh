#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
# Select the repository's sole Node version source when nvm is installed.
if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use --silent
fi
expected_node="v$(tr -d '[:space:]' < "$root/.nvmrc")"
if [[ "$(node --version)" != "$expected_node" ]]; then
  printf 'Use the Node version from .nvmrc before generating maps.\n' >&2
  exit 1
fi
export PYTHONPATH="$root/backend/src${PYTHONPATH:+:$PYTHONPATH}"
exec "$root/backend/.venv/bin/python" -m knut_vandrar_backend.maps.cli "$@"
