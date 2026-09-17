#!/usr/bin/env bash
set -euo pipefail

project_root="/home/ubuntu/klassny-remont"
remote_user="kegora"
remote_host="89.117.149.68"
remote_root="/home/${remote_user}/apps/klassny-remont"
release_id="$(date -u +%Y%m%d%H%M%S)"
askpass="/home/ubuntu/.ssh/klassny-remont-askpass.sh"
ssh_opts=(
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=20
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
)

export SSH_ASKPASS="$askpass"
export SSH_ASKPASS_REQUIRE=force
export DISPLAY=manus-deploy:0

remote_ssh() {
  setsid ssh "${ssh_opts[@]}" "${remote_user}@${remote_host}" "$@"
}

if [[ ! -x "$askpass" ]]; then
  echo "Temporary SSH credential helper is unavailable." >&2
  exit 1
fi
if [[ ! -f "$project_root/deployment/.env.production" ]]; then
  echo "Deployment environment is unavailable." >&2
  exit 1
fi

remote_ssh "install -d -m 0755 ~/staging '$remote_root/releases/$release_id' '$remote_root/shared'"

setsid scp "${ssh_opts[@]}" \
  "$project_root/deployment/klassny-remont.service" \
  "$project_root/deployment/klassny-remont.nginx.conf" \
  "$project_root/deployment/prepare-server.sh" \
  "$project_root/deployment/activate-release.sh" \
  "$project_root/deployment/.env.production" \
  "${remote_user}@${remote_host}:~/staging/"

remote_ssh "install -m 0600 ~/staging/.env.production '$remote_root/shared/.env' && rm -f ~/staging/.env.production"

(
  cd "$project_root"
  tar \
    --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./deployment/.env.production' \
    --exclude='./.env' \
    --exclude='./.env.*' \
    -czf - .
) | remote_ssh "tar -xzf - -C '$remote_root/releases/$release_id'"

remote_ssh "cd '$remote_root/releases/$release_id' && corepack pnpm install --frozen-lockfile && chown -R '${remote_user}:${remote_user}' '$remote_root/releases/$release_id'"

{
  "$askpass"
  cat "$project_root/deployment/prepare-server.sh"
} | remote_ssh "sudo -S -p '' bash -s"

{
  "$askpass"
  printf '%s\n' "bash '$remote_root/releases/$release_id/deployment/activate-release.sh' '$release_id'"
} | remote_ssh "sudo -S -p '' bash -s"

remote_ssh "systemctl is-enabled klassny-remont && for attempt in 1 2 3 4 5 6 7 8 9 10; do systemctl is-active --quiet klassny-remont && curl -fsS --max-time 15 http://127.0.0.1:3020/ | grep -q 'Классный Ремонт' && exit 0; sleep 2; done; journalctl -u klassny-remont -n 60 --no-pager >&2; exit 1"

printf 'DEPLOYED_RELEASE=%s\n' "$release_id"
