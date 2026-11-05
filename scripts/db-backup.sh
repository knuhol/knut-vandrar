#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/db-common.sh
source "$script_dir/db-common.sh"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'Usage: %s <local|dev|prod> [output.dump]\n' "$0" >&2
  exit 2
fi

environment="$1"
db_load_config "$environment"
db_require_postgres_tools pg_dump pg_restore

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_path="${2:-$DB_SCRIPT_ROOT/backups/knut-vandrar-${environment}-${timestamp}.dump}"
output_dir="$(dirname -- "$output_path")"
mkdir -p "$output_dir"

if [[ -e "$output_path" ]]; then
  printf 'Error: refusing to overwrite existing backup: %s\n' "$output_path" >&2
  exit 1
fi

temporary_file="$(mktemp "${output_path}.tmp.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

pg_dump --format=custom --file="$temporary_file" --dbname="$PGDATABASE"
pg_restore --list "$temporary_file" >/dev/null
mv "$temporary_file" "$output_path"
trap - EXIT

printf 'Backup created: %s\n' "$output_path"
