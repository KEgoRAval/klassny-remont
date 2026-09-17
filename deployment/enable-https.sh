#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
site_config=/etc/nginx/sites-available/klassny-remont
webroot=/var/www/certbot
mkdir -p "$webroot"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
install -m 0644 "$script_dir/klassny-remont.nginx.conf" "$site_config"
ln -sfn "$site_config" /etc/nginx/sites-enabled/klassny-remont
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

certbot --nginx --non-interactive --agree-tos --no-eff-email --register-unsafely-without-email \
  -d krem.moscow -d www.krem.moscow

install -m 0644 "$script_dir/klassny-remont.https.nginx.conf" "$site_config"
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
