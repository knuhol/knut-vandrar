#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/media-common.sh
source "$script_dir/media-common.sh"

[[ $# -ge 2 ]] || media_error 'Usage: media-import.sh <local|dev|prod> <archive.tar|-|--recover> [--dry-run] [--replace] [--ssh HOST] [--ssh-password] [--remote-checkouts-dir DIR]'
environment="$1"
archive="$2"
shift 2
media_parse_transport "$@"
if [[ "$archive" == --recover ]]; then
  media_run "$environment" recover ${media_arguments[@]+"${media_arguments[@]}"}
elif [[ "$archive" == - ]]; then
  media_run "$environment" import ${media_arguments[@]+"${media_arguments[@]}"}
else
  [[ -f "$archive" && -r "$archive" && -s "$archive" ]] || media_error 'Archive must be a readable, nonempty file.'
  media_run "$environment" import ${media_arguments[@]+"${media_arguments[@]}"} < "$archive"
fi
