#!/usr/bin/env bash
# Builds a release from GitHub on the server itself and switches the site to it.
# Needs no deploy machine: run it as kegora over SSH (sudo asks for the password).
#
#   curl -fsSL https://raw.githubusercontent.com/KEgoRAval/klassny-remont/main/deployment/release-from-github.sh -o /tmp/release.sh
#   bash /tmp/release.sh            # main
#   bash /tmp/release.sh <branch>   # another branch or tag
#
# The previous release stays in releases/; see deployment/OPERATIONS.md for rollback.
set -euo pipefail

ref="${1:-main}"
repo="KEgoRAval/klassny-remont"
domain="krem.moscow"
app_root="/home/kegora/apps/klassny-remont"
release_id="$(date -u +%Y%m%d%H%M%S)"
release_path="$app_root/releases/$release_id"
site_config="/etc/nginx/sites-available/klassny-remont"
keep_releases=5

if [[ "$(id -un)" != "kegora" ]]; then
  echo "Run this as kegora, not $(id -un)." >&2
  exit 1
fi
if [[ ! -f "$app_root/shared/.env" ]]; then
  echo "Deployment environment is missing: $app_root/shared/.env" >&2
  exit 1
fi

commit="$(curl -fsSL "https://api.github.com/repos/$repo/commits/$ref" | sed -n 's/^  "sha": "\([0-9a-f]\{40\}\)",$/\1/p' | head -1)"
if [[ -z "$commit" ]]; then
  echo "Could not resolve $ref in $repo." >&2
  exit 1
fi
printf 'Building %s (%s) as release %s\n' "$ref" "${commit:0:7}" "$release_id"

mkdir -p "$release_path"
# The exact commit, so the release matches what was resolved above even if the branch moves.
curl -fsSL "https://codeload.github.com/$repo/tar.gz/$commit" | tar -xz -C "$release_path" --strip-components=1
printf '%s\n' "$commit" > "$release_path/RELEASE_COMMIT"

cd "$release_path"
# Dev dependencies are needed for the build, so NODE_ENV must not be production here.
env -u NODE_ENV corepack pnpm install --frozen-lockfile
corepack pnpm build

sudo bash "$release_path/deployment/activate-release.sh" "$release_id"

# Keep the HTTPS Nginx config in step with the repository; roll back if Nginx rejects it.
if sudo test -f "/etc/letsencrypt/live/$domain/fullchain.pem"; then
  backup="$(mktemp)"
  sudo cp "$site_config" "$backup"
  sudo install -m 0644 -o root -g root "$release_path/deployment/klassny-remont.https.nginx.conf" "$site_config"
  if ! sudo nginx -t; then
    sudo install -m 0644 -o root -g root "$backup" "$site_config"
    rm -f "$backup"
    sudo systemctl reload nginx
    echo "Nginx rejected the HTTPS config from this release; the previous config is back." >&2
    exit 1
  fi
  rm -f "$backup"
  sudo systemctl reload nginx
fi

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 15 http://127.0.0.1:3020/ | grep -q 'Классный Ремонт'; then
    break
  fi
  if [[ "$attempt" == 10 ]]; then
    sudo journalctl -u klassny-remont -n 60 --no-pager >&2
    echo "The new release does not answer on 127.0.0.1:3020." >&2
    exit 1
  fi
  sleep 2
done
curl -fsS --max-time 30 "https://$domain/" | grep -q 'Классный Ремонт'

# Old releases take space; keep the newest few for rollback.
ls -1d "$app_root"/releases/*/ | sort | head -n "-$keep_releases" | while read -r old; do
  [[ "$(readlink -f "$app_root/current")/" == "$old" ]] || rm -rf "$old"
done

printf 'RELEASED %s (%s): https://%s/ answers.\n' "$release_id" "${commit:0:7}" "$domain"
