#!/usr/bin/env bash
# Releases the current main branch. Run by GitHub Actions after every merge to main.
#
# Installed by deployment/setup-ci-deploy.sh as /usr/local/sbin/klassny-ci-release
# (root-owned) and run through one sudoers rule, so the deploy key needs no password.
# It takes no arguments and always releases main.
#
# Unlike release-from-github.sh, nothing from the downloaded release runs as root:
# the build runs as kegora, and root only switches the `current` link and restarts
# the service. The Nginx config is not touched here; change it with
# release-from-github.sh by hand. Changes to this file take effect only after
# setup-ci-deploy.sh is run again on the server.
set -euo pipefail

# Fetches a page and checks it is the site. Reads the whole body before searching:
# "curl | grep -q" fails under pipefail once the page is larger than a pipe buffer,
# because grep exits at the first match and curl then reports a write error (23).
site_answers() {
  local body
  body="$(curl -fsS --max-time "$2" "$1")" || return 1
  [[ "$body" == *'Классный Ремонт'* ]]
}

repo="KEgoRAval/klassny-remont"
domain="krem.moscow"
user="kegora"
app_root="/home/kegora/apps/klassny-remont"
keep_releases=5

if [[ "$(id -u)" != 0 ]]; then
  echo "Run through sudo: sudo -n /usr/local/sbin/klassny-ci-release" >&2
  exit 1
fi
if [[ ! -f "$app_root/shared/.env" ]]; then
  echo "Deployment environment is missing: $app_root/shared/.env" >&2
  exit 1
fi

# One release at a time; a second merge waits for the first deploy to finish.
exec 9>/run/lock/klassny-ci-release.lock
flock 9

commit="$(curl -fsSL "https://api.github.com/repos/$repo/commits/main" | sed -n 's/^  "sha": "\([0-9a-f]\{40\}\)",$/\1/p' | head -1)"
if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Could not resolve main in $repo." >&2
  exit 1
fi
if [[ -f "$app_root/current/RELEASE_COMMIT" && "$(cat "$app_root/current/RELEASE_COMMIT")" == "$commit" ]]; then
  printf 'ALREADY LIVE %s: nothing to release.\n' "${commit:0:7}"
  exit 0
fi

release_id="$(date -u +%Y%m%d%H%M%S)"
release_path="$app_root/releases/$release_id"
printf 'Building main (%s) as release %s\n' "${commit:0:7}" "$release_id"

# Download and build as kegora, in a login shell so corepack and pnpm are on PATH.
runuser -l "$user" -c "bash -s -- '$release_path' '$repo' '$commit'" <<'BUILD'
set -euo pipefail
release_path="$1"; repo="$2"; commit="$3"
mkdir -p "$release_path"
curl -fsSL "https://codeload.github.com/$repo/tar.gz/$commit" | tar -xz -C "$release_path" --strip-components=1
printf '%s\n' "$commit" > "$release_path/RELEASE_COMMIT"
cd "$release_path"
# Dev dependencies are needed for the build, so NODE_ENV must not be production here.
env -u NODE_ENV corepack pnpm install --frozen-lockfile
corepack pnpm build
BUILD

if [[ ! -d "$release_path/dist" ]]; then
  echo "Release build output is missing: $release_path/dist" >&2
  exit 1
fi

previous="$(readlink -f "$app_root/current" || true)"
ln -sfn "$release_path" "$app_root/current"
chown -h "$user:$user" "$app_root/current"
systemctl restart klassny-remont

healthy=false
for _ in $(seq 1 15); do
  if site_answers http://127.0.0.1:3020/ 10; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  journalctl -u klassny-remont -n 60 --no-pager >&2 || true
  if [[ -n "$previous" && -d "$previous" ]]; then
    ln -sfn "$previous" "$app_root/current"
    chown -h "$user:$user" "$app_root/current"
    systemctl restart klassny-remont
    echo "Release $release_id did not answer; rolled back to $(basename "$previous")." >&2
  fi
  exit 1
fi

site_answers "https://$domain/" 30

# Old releases take space; keep the newest few for rollback.
current_dir="$(readlink -f "$app_root/current")/"
ls -1d "$app_root"/releases/*/ | sort | head -n "-$keep_releases" | while read -r old; do
  [[ "$current_dir" == "$old" ]] || rm -rf "$old"
done

printf 'RELEASED %s (%s): https://%s/ answers.\n' "$release_id" "${commit:0:7}" "$domain"
