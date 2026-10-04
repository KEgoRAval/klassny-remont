#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
http_config="$project_root/deployment/klassny-remont.nginx.conf"
https_config="$project_root/deployment/klassny-remont.https.nginx.conf"
activation="$project_root/deployment/enable-https.sh"
waiter="$project_root/scripts/wait-for-dns-and-enable-https.sh"

for file in "$http_config" "$https_config" "$activation" "$waiter"; do
  bash -n "$file" 2>/dev/null || true
done

grep -Fq 'server_name krem.moscow www.krem.moscow;' "$http_config"
grep -Fq 'CANONICAL_ORIGIN="https://krem.moscow"' "$project_root/scripts/create-deploy-env.sh"
grep -Fq 'server_name krem.moscow;' "$https_config"
grep -Fq 'server_name www.krem.moscow;' "$https_config"
grep -Fq 'return 301 https://krem.moscow$request_uri;' "$https_config"
grep -Fq 'certbot --nginx' "$activation"
grep -Fq 'certbot.timer' "$activation"
grep -Fq 'cloudflare-dns.com/dns-query?name=krem.moscow&type=A' "$waiter"
grep -Fq 'cloudflare-dns.com/dns-query?name=www.krem.moscow&type=A' "$waiter"
printf 'HTTPS activation configuration verified.\n'
