#!/usr/bin/env bash
set -euo pipefail

project_root="/home/ubuntu/klassny-remont"
remote_user="kegora"
remote_host="89.117.149.68"
askpass="/home/ubuntu/.ssh/klassny-remont-askpass.sh"
expected_ip="89.117.149.68"
max_attempts=90

export SSH_ASKPASS="$askpass"
export SSH_ASKPASS_REQUIRE=force
export DISPLAY=manus-deploy:0
ssh_opts=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o PreferredAuthentications=password -o PubkeyAuthentication=no)
remote_ssh() { setsid ssh "${ssh_opts[@]}" "${remote_user}@${remote_host}" "$@"; }

if [[ ! -x "$askpass" ]]; then
  printf '%s\n' 'Temporary SSH credential helper is unavailable.' >&2
  exit 1
fi

for attempt in $(seq 1 "$max_attempts"); do
  root_records="$(curl -fsS --connect-timeout 10 --max-time 20 -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=krem.moscow&type=A' 2>/dev/null || true)"
  www_records="$(curl -fsS --connect-timeout 10 --max-time 20 -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=www.krem.moscow&type=A' 2>/dev/null || true)"
  if grep -Fq "\"data\":\"$expected_ip\"" <<<"$root_records" && grep -Fq "\"data\":\"$expected_ip\"" <<<"$www_records"; then
    printf 'DNS propagation confirmed after attempt %s.\n' "$attempt"
    break
  fi
  if [[ "$attempt" == "$max_attempts" ]]; then
    printf '%s\n' 'DNS propagation did not reach public resolvers before timeout.' >&2
    exit 1
  fi
  printf 'Waiting for DNS propagation (%s/%s).\n' "$attempt" "$max_attempts"
  sleep 10
done

setsid scp "${ssh_opts[@]}" \
  "$project_root/deployment/enable-https.sh" \
  "$project_root/deployment/klassny-remont.nginx.conf" \
  "$project_root/deployment/klassny-remont.https.nginx.conf" \
  "${remote_user}@${remote_host}:~/staging/"

{
  "$askpass"
  printf '%s\n' 'bash /home/kegora/staging/enable-https.sh'
} | remote_ssh "sudo -S -p '' bash -s"

remote_ssh "curl -fsSI --max-time 30 https://krem.moscow/ | sed -n '1,15p'; printf '%s\\n' '---'; curl -fsSI --max-time 30 http://krem.moscow/ | sed -n '1,10p'; printf '%s\\n' '---'; curl -fsSI --max-time 30 https://www.krem.moscow/ | sed -n '1,10p'"
printf '%s\n' 'HTTPS activation and redirect verification completed.'
