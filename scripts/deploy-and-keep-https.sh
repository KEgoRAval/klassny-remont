#!/usr/bin/env bash
# Deploys a release and keeps HTTPS on.
#
# scripts/deploy-to-server.sh runs deployment/prepare-server.sh, which installs the
# HTTP-only Nginx config over the site config. Once krem.moscow has a certificate,
# that would switch HTTPS off after every release. This script deploys as usual,
# then puts the HTTPS config back (rolling back if Nginx rejects it) and checks the
# live site. Use it instead of deploy-to-server.sh.
set -euo pipefail

project_root="/home/ubuntu/klassny-remont"
remote_user="kegora"
remote_host="89.117.149.68"
domain="krem.moscow"
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

bash "$project_root/scripts/deploy-to-server.sh"

setsid scp "${ssh_opts[@]}" \
  "$project_root/deployment/klassny-remont.https.nginx.conf" \
  "${remote_user}@${remote_host}:~/staging/"

# Runs as root on the server. Without a certificate HTTPS was never enabled, so the
# HTTP config that the release installed is the right one and is left alone.
restore_https=$(cat <<EOF
set -euo pipefail
site_config=/etc/nginx/sites-available/klassny-remont
certificate=/etc/letsencrypt/live/${domain}/fullchain.pem
if [[ ! -f "\$certificate" ]]; then
  printf '%s\n' 'HTTPS_SKIPPED: no certificate for ${domain}; the HTTP config stays.'
  exit 0
fi
backup="\$(mktemp)"
cp "\$site_config" "\$backup"
install -m 0644 -o root -g root /home/kegora/staging/klassny-remont.https.nginx.conf "\$site_config"
if ! nginx -t; then
  install -m 0644 -o root -g root "\$backup" "\$site_config"
  rm -f "\$backup"
  systemctl reload nginx
  printf '%s\n' 'HTTPS_FAILED: Nginx rejected the HTTPS config; the previous config is back.' >&2
  exit 1
fi
rm -f "\$backup"
systemctl reload nginx
nginx -T 2>/dev/null | grep -q 'location = /api/trpc/leads.submit' || { printf '%s\n' 'HTTPS_FAILED: the lead upload limit is missing from the active config.' >&2; exit 1; }
printf '%s\n' 'HTTPS_RESTORED'
EOF
)

result="$(
  {
    "$askpass"
    printf '%s\n' "$restore_https"
  } | remote_ssh "sudo -S -p '' bash -s"
)"
printf '%s\n' "$result"

if grep -q 'HTTPS_RESTORED' <<<"$result"; then
  remote_ssh "curl -fsS --max-time 30 https://${domain}/ | grep -q 'Классный Ремонт' && curl -fsSI --max-time 30 http://${domain}/ | grep -qi '^location: https://${domain}/'" \
    || { printf '%s\n' "The site does not answer over HTTPS after the release." >&2; exit 1; }
  printf '%s\n' "HTTPS verified: https://${domain}/ answers and http:// redirects to it."
fi
