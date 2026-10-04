#!/usr/bin/env bash
set -euo pipefail

release_id="$1"
app_root="/home/kegora/apps/klassny-remont"
release_path="$app_root/releases/$release_id"

if [[ ! -d "$release_path/dist" ]]; then
  echo "Release build output is missing: $release_path/dist" >&2
  exit 1
fi
if [[ ! -f "$app_root/shared/.env" ]]; then
  echo "Deployment environment is missing: $app_root/shared/.env" >&2
  exit 1
fi

ln -sfn "$release_path" "$app_root/current"
chown -h kegora:kegora "$app_root/current"
systemctl restart klassny-remont
systemctl is-active --quiet klassny-remont

printf 'Release %s activated.\n' "$release_id"
