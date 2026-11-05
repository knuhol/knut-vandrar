#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <dev|prod> <commit-sha>" >&2
  exit 2
fi

environment="$1"
commit_sha="$2"
case "$environment" in
  dev) branch=dev; config_name=development; compose_project=knut-vandrar-dev; routing_file=docker-compose.vps.dev.yml ;;
  prod) branch=main; config_name=production; compose_project=knut-vandrar-prod; routing_file=docker-compose.vps.prod.yml ;;
  *) echo "Unsupported environment: $environment" >&2; exit 2 ;;
esac
if [[ ! "$commit_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Commit must be a full 40-character SHA" >&2
  exit 2
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="${DEPLOY_CONFIG_DIR:-/etc/knut-vandrar}"
env_file="$config_dir/$config_name.env"
lock_dir="${XDG_STATE_HOME:-$HOME/.local/state}/knut-vandrar"
mkdir -p "$lock_dir"
exec 9>"$lock_dir/$environment.lock"
flock -n 9 || { echo "A $environment deployment is already running" >&2; exit 1; }

if [[ ! -r "$env_file" ]]; then
  echo "Deployment environment file is missing or unreadable: $env_file" >&2
  exit 1
fi
git -C "$repo_root" fetch --prune origin "+refs/heads/$branch:refs/remotes/origin/$branch"
if ! git -C "$repo_root" cat-file -e "$commit_sha^{commit}" 2>/dev/null; then
  echo "Commit $commit_sha was not fetched from origin/$branch" >&2
  exit 1
fi
if ! git -C "$repo_root" merge-base --is-ancestor "$commit_sha" "origin/$branch"; then
  echo "Commit $commit_sha is not on origin/$branch" >&2
  exit 1
fi

git -C "$repo_root" checkout --detach "$commit_sha"
export NODE_VERSION="$(<"$repo_root/.nvmrc")"
export PYTHON_VERSION="$(<"$repo_root/.python-version")"

cd "$repo_root"
docker compose \
  --project-name "$compose_project" \
  --env-file "$env_file" \
  -f docker-compose.vps.yml \
  -f "$routing_file" \
  up --build --detach --wait --wait-timeout 240 --remove-orphans

echo "Deployed $environment at $commit_sha"
