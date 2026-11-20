#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == local ]]; then
  shift
elif [[ $# -gt 0 && "$1" != -* ]]; then
  printf 'Usage: tracks-import.sh [local] [--trail NAME | --hike TITLE] [--bundle FILE] [--name NAME] [--gpx-dir DIRECTORY] [--collection ID] [--direction forward|backward (trail only)]\n' >&2
  exit 2
fi
cd "$root"
export PYTHONPATH="$root/backend/src${PYTHONPATH:+:$PYTHONPATH}"
exec "$root/backend/.venv/bin/python" -m knut_vandrar_backend.tracks.cli "$@"
