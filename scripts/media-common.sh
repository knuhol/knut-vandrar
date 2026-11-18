#!/usr/bin/env bash

set -Eeuo pipefail

MEDIA_SCRIPT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

media_error() {
  printf 'Error: %s\n' "$1" >&2
  exit 2
}

media_validate_environment() {
  case "$1" in
    local|dev|prod) ;;
    *) media_error 'Environment must be local, dev, or prod.' ;;
  esac
}

# Transport flags are removed before forwarding backend command arguments.
media_parse_transport() {
  if [[ -r "$MEDIA_SCRIPT_ROOT/.env" ]]; then
    # Like db-common.sh, read only the operator-maintained, shell-compatible config.
    # shellcheck disable=SC1091
    source "$MEDIA_SCRIPT_ROOT/.env"
  fi
  media_remote_host="${MEDIA_SSH_HOST:-}"
  media_remote_checkouts_dir="${MEDIA_REMOTE_CHECKOUTS_DIR:-/srv/knut-vandrar}"
  media_arguments=()
  media_ssh_password=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ssh-password) media_ssh_password=true; shift ;;
      --ssh|--remote-checkouts-dir)
        [[ $# -ge 2 && -n "$2" ]] || media_error "$1 requires a value."
        if [[ "$1" == --ssh ]]; then media_remote_host="$2"; else media_remote_checkouts_dir="$2"; fi
        shift 2
        ;;
      *) media_arguments+=("$1"); shift ;;
    esac
  done
}

media_exec_backend() (
  local environment="$1"
  shift
  local config_name env_file
  local -a compose=(docker compose)
  media_validate_environment "$environment"
  export NODE_VERSION="$(<"$MEDIA_SCRIPT_ROOT/.nvmrc")"
  export PYTHON_VERSION="$(<"$MEDIA_SCRIPT_ROOT/.python-version")"
  cd "$MEDIA_SCRIPT_ROOT"
  if [[ "$environment" == local ]]; then
    compose+=(--env-file "$MEDIA_SCRIPT_ROOT/.env" -f docker-compose.yml)
  else
    if [[ "$environment" == dev ]]; then config_name=development; else config_name=production; fi
    env_file="${DEPLOY_CONFIG_DIR:-/etc/knut-vandrar}/$config_name.env"
    if [[ ! -r "$env_file" ]]; then env_file="$MEDIA_SCRIPT_ROOT/.env.vps.$config_name"; fi
    [[ -r "$env_file" ]] || media_error "Missing environment file for $environment."
    compose+=(--project-name "knut-vandrar-$environment" --env-file "$env_file"
      -f docker-compose.vps.yml -f "docker-compose.vps.$environment.yml")
  fi
  # exec requires an already running backend; it never starts or restarts services.
  "${compose[@]}" exec -T backend python -m knut_vandrar_backend.media.cli "$@"
)

media_quote() {
  local value="$1" index character
  media_quoted="'"
  for ((index=0; index<${#value}; index++)); do
    character="${value:index:1}"
    if [[ "$character" == "'" ]]; then
      media_quoted+="'\\''"
    else
      media_quoted+="$character"
    fi
  done
  media_quoted+="'"
}

media_run() {
  local environment="$1"
  local remote_host=""
  shift
  media_validate_environment "$environment"
  if [[ "$environment" != local ]]; then remote_host="$media_remote_host"; fi
  printf 'Media target/source: %s (%s)\n' "$environment" "${remote_host:-this host}" >&2
  if [[ -z "$remote_host" ]]; then
    media_exec_backend "$environment" "$@"
    return
  fi
  [[ "$remote_host" != -* && "$remote_host" =~ ^[A-Za-z0-9_.@:-]+$ ]] \
    || media_error 'Invalid SSH host; configure SSH options in ~/.ssh/config.'
  [[ "$media_remote_checkouts_dir" == /* ]] || media_error '--remote-checkouts-dir must be an absolute directory.'
  local command argument
  local -a remote=(bash scripts/media-common.sh "$environment" "$@")
  media_quote "${media_remote_checkouts_dir%/}/$environment"
  command="cd $media_quoted && exec"
  for argument in "${remote[@]}"; do
    media_quote "$argument"
    command+=" $media_quoted"
  done
  local -a authentication=(-o BatchMode=yes)
  if [[ "$media_ssh_password" == true ]]; then
    authentication=(-o BatchMode=no -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive)
  fi
  ssh -T "${authentication[@]}" -o StrictHostKeyChecking=yes -- "$remote_host" "$command"
}

# SSH invokes this entry point inside the destination checkout, without recursion.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  [[ $# -ge 2 ]] || media_error 'Internal usage: media-common.sh ENV COMMAND [OPTIONS]'
  media_exec_backend "$@"
fi
