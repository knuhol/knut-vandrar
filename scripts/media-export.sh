#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/media-common.sh
source "$script_dir/media-common.sh"

[[ $# -ge 1 ]] || media_error 'Usage: media-export.sh <local|dev|prod> [archive.tar|-] [--ssh HOST] [--remote-checkouts-dir DIR] [--hike UUID] [--location UUID]'
environment="$1"
shift
output_path="$MEDIA_SCRIPT_ROOT/backups/media-$environment-$(date -u +%Y%m%dT%H%M%SZ).tar"
if [[ $# -gt 0 && ( "$1" == - || "$1" != -* ) ]]; then output_path="$1"; shift; fi
media_parse_transport "$@"
if [[ "$output_path" == - ]]; then
  media_run "$environment" export ${media_arguments[@]+"${media_arguments[@]}"}
  exit
fi
[[ ! -e "$output_path" && ! -L "$output_path" ]] || media_error "Refusing to overwrite: $output_path"
mkdir -p -- "$(dirname -- "$output_path")"
temporary_file="$(mktemp "${output_path}.tmp.XXXXXX")"
trap 'rm -f -- "$temporary_file"' EXIT
media_run "$environment" export ${media_arguments[@]+"${media_arguments[@]}"} > "$temporary_file"
# A hard link publishes without overwriting a file created during the export.
ln -- "$temporary_file" "$output_path"
rm -- "$temporary_file"
trap - EXIT
printf 'Media archive created: %s\n' "$output_path" >&2
