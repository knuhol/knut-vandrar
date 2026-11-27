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

  case "$environment" in
    local)
      config_file="$DB_SCRIPT_ROOT/.env"
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

  DB_SSH_HOST=""
  if [[ "$environment" != local && "$config_file" == "$DB_SCRIPT_ROOT"/.env.vps.* ]]; then
    DB_SSH_HOST="${MEDIA_SSH_HOST:-}"
  fi
  if [[ "$environment" != local && "$config_file" == "$DB_SCRIPT_ROOT"/.env.vps.* && -z "$DB_SSH_HOST" ]]; then
    db_usage_error 'Set MEDIA_SSH_HOST in the workstation environment file to use an SSH tunnel.'
  fi
  unset PGHOSTADDR
  export PGHOST="127.0.0.1"
  export PGPORT="$POSTGRES_PORT"
  export PGUSER="$POSTGRES_USER"
  export PGPASSWORD="$POSTGRES_PASSWORD"
  export PGDATABASE="$POSTGRES_DATABASE"
}

db_start_ssh_tunnel() {
  local environment="$1"
  local probe_database="$2"
  local deadline

  [[ "$environment" == local || -z "$DB_SSH_HOST" ]] && return 0

  command -v ssh >/dev/null || db_usage_error 'OpenSSH is required for remote database access.'
  db_require_postgres_tools psql
  if [[ "$DB_SSH_HOST" == -* || ! "$DB_SSH_HOST" =~ ^[A-Za-z0-9_.@:-]+$ ]]; then
    db_usage_error 'Invalid DB_SSH_HOST; use a host or SSH config alias.'
  fi

  # libpq uses this socket name when PGHOST is an absolute directory.
  # Keep it private and short enough for the Unix socket path limit.
  DB_TUNNEL_DIR="$(mktemp -d /tmp/kv-db.XXXXXXXX)"
  ssh -n -T -N -o BatchMode=yes -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes \
    -o ControlMaster=no -o ControlPath=none -o ForkAfterAuthentication=no -o ConnectTimeout=10 \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -L "$DB_TUNNEL_DIR/.s.PGSQL.$PGPORT:127.0.0.1:$POSTGRES_PORT" -- "$DB_SSH_HOST" \
    >"$DB_TUNNEL_DIR/ssh.log" 2>&1 &
  DB_TUNNEL_PID=$!

  export PGHOST="$DB_TUNNEL_DIR"
  deadline=$((SECONDS + 20))
  while (( SECONDS < deadline )); do
    if ! kill -0 "$DB_TUNNEL_PID" 2>/dev/null; then
      printf 'Error: SSH tunnel to %s exited before it became ready.\n' "$DB_SSH_HOST" >&2
      cat "$DB_TUNNEL_DIR/ssh.log" >&2
      exit 1
    fi
    if PGCONNECT_TIMEOUT=2 psql -X -w --dbname="$probe_database" --command="SELECT 1" \
      >/dev/null 2>"$DB_TUNNEL_DIR/postgres.log"; then
      printf 'SSH database tunnel ready: %s -> 127.0.0.1:%s\n' "$DB_SSH_HOST" "$POSTGRES_PORT" >&2
      return 0
    fi
    sleep 1
  done

  printf 'Error: PostgreSQL at %s:%s did not respond through the SSH tunnel.\n' "$DB_SSH_HOST" "$POSTGRES_PORT" >&2
  cat "$DB_TUNNEL_DIR/ssh.log" "$DB_TUNNEL_DIR/postgres.log" >&2
  exit 1
}

db_cleanup_ssh_tunnel() {
  if [[ -n "${DB_TUNNEL_PID:-}" ]]; then
    kill "$DB_TUNNEL_PID" 2>/dev/null || true
    wait "$DB_TUNNEL_PID" 2>/dev/null || true
    DB_TUNNEL_PID=""
  fi
  if [[ -n "${DB_TUNNEL_DIR:-}" ]]; then
    rm -f -- "$DB_TUNNEL_DIR/.s.PGSQL.$PGPORT" "$DB_TUNNEL_DIR/ssh.log" "$DB_TUNNEL_DIR/postgres.log"
    rmdir -- "$DB_TUNNEL_DIR"
  fi
}

db_cleanup() {
  db_cleanup_ssh_tunnel
  if [[ -n "${DB_TEMPORARY_FILE:-}" ]]; then
    rm -f -- "$DB_TEMPORARY_FILE"
    DB_TEMPORARY_FILE=""
  fi
}

db_enable_tunnel_cleanup() {
  trap db_cleanup EXIT
  trap 'exit 130' INT TERM HUP
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
