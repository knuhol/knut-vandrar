#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/db-common.sh
source "$script_dir/db-common.sh"

if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'Usage: %s <local|dev|prod> <backup.dump> [--yes]\n' "$0" >&2
  exit 2
fi

environment="$1"
backup_file="$2"
skip_confirmation="${3:-}"
if [[ -n "$skip_confirmation" && "$skip_confirmation" != --yes ]]; then
  printf 'Error: the only supported third argument is --yes.\n' >&2
  exit 2
fi

db_load_config "$environment"
db_require_postgres_tools createdb dropdb pg_restore psql

if [[ ! -r "$backup_file" || ! -s "$backup_file" ]]; then
  printf 'Error: backup file is missing, unreadable, or empty: %s\n' "$backup_file" >&2
  exit 1
fi

# Validate the custom-format archive before touching the selected database.
pg_restore --list "$backup_file" >/dev/null

printf 'Target: %s database "%s" on %s:%s\n' "$environment" "$PGDATABASE" "$PGHOST" "$PGPORT"
printf 'This replaces the selected database contents with the supplied backup.\n'
if [[ "$skip_confirmation" != --yes ]]; then
  printf 'Type the database name (%s) to continue: ' "$PGDATABASE"
  read -r confirmation
  if [[ "$confirmation" != "$PGDATABASE" ]]; then
    printf 'Restore cancelled.\n' >&2
    exit 1
  fi
fi

# Confirm access to the maintenance database before dropping the target.
psql --no-psqlrc --set=ON_ERROR_STOP=1 --dbname=postgres --command='SELECT 1' >/dev/null

dropdb --if-exists --force --maintenance-db=postgres "$PGDATABASE"
createdb --maintenance-db=postgres --owner="$PGUSER" "$PGDATABASE"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$PGDATABASE" "$backup_file"

printf 'Database "%s" restored from %s.\n' "$PGDATABASE" "$backup_file"
