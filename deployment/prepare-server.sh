#!/usr/bin/env bash
set -euo pipefail

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx ufw unattended-upgrades

install -d -m 0755 /var/www/certbot
install -d -o kegora -g kegora -m 0755 /home/kegora/apps/klassny-remont/releases
install -d -o kegora -g kegora -m 0750 /home/kegora/apps/klassny-remont/shared

install -m 0644 -o root -g root /home/kegora/staging/klassny-remont.service /etc/systemd/system/klassny-remont.service
install -m 0644 -o root -g root /home/kegora/staging/klassny-remont.nginx.conf /etc/nginx/sites-available/klassny-remont
ln -sfn /etc/nginx/sites-available/klassny-remont /etc/nginx/sites-enabled/klassny-remont
rm -f /etc/nginx/sites-enabled/default

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

nginx -t
systemctl daemon-reload
systemctl enable nginx
systemctl restart nginx
systemctl enable klassny-remont

printf 'Server preparation complete.\n'
