#!/usr/bin/env bash

set -Eeuo pipefail

DB_SCRIPT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

db_usage_error() {
  printf 'Error: %s\n' "$1" >&2
  exit 2
}

db_load_config() {
  local environment="$1"
  local config_file=""
  local backup_host_override="${DB_BACKUP_HOST:-}"

  case "$environment" in
    local)
      config_file="$DB_SCRIPT_ROOT/.env"
      backup_host_override=""
      ;;
    dev)
      if [[ -r "$DB_SCRIPT_ROOT/.env.vps.development" ]]; then
        config_file="$DB_SCRIPT_ROOT/.env.vps.development"
      else
        config_file="/etc/knut-vandrar/development.env"
      fi
      ;;
    prod)
      if [[ -r "$DB_SCRIPT_ROOT/.env.vps.production" ]]; then
        config_file="$DB_SCRIPT_ROOT/.env.vps.production"
      else
        config_file="/etc/knut-vandrar/production.env"
      fi
      ;;
    *)
      db_usage_error "Environment must be local, dev, or prod."
      ;;
  esac

  if [[ ! -r "$config_file" ]]; then
    printf 'Error: configuration file not found or unreadable: %s\n' "$config_file" >&2
    if [[ "$environment" == dev || "$environment" == prod ]]; then
      printf 'Copy the matching .env.vps.*.example file to the ignored .env.vps.* path, or run this on the VPS.\n' >&2
    fi
    exit 1
  fi

  # These project env files are shell-compatible and are maintained by the operator.
  # shellcheck disable=SC1090
  source "$config_file"

  : "${POSTGRES_DATABASE:?POSTGRES_DATABASE is required in the selected environment file}"
  : "${POSTGRES_USER:?POSTGRES_USER is required in the selected environment file}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required in the selected environment file}"
  : "${POSTGRES_PORT:?POSTGRES_PORT is required in the selected environment file}"
  [[ "$POSTGRES_PORT" =~ ^[0-9]+$ ]] || db_usage_error "POSTGRES_PORT must be a number."
  (( POSTGRES_PORT > 0 && POSTGRES_PORT <= 65535 )) || db_usage_error "POSTGRES_PORT must be between 1 and 65535."

  export PGHOST="${backup_host_override:-127.0.0.1}"
  export PGPORT="$POSTGRES_PORT"
  export PGUSER="$POSTGRES_USER"
  export PGPASSWORD="$POSTGRES_PASSWORD"
  export PGDATABASE="$POSTGRES_DATABASE"
}

db_require_postgres_tools() {
  local tool
  for tool in "$@"; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      printf 'Error: required PostgreSQL client tool is missing: %s\n' "$tool" >&2
      exit 1
    fi
  done
}
