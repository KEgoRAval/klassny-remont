#!/usr/bin/env bash
set -euo pipefail

export SSH_ASKPASS=/home/ubuntu/.ssh/klassny-remont-askpass.sh
export SSH_ASKPASS_REQUIRE=force
export DISPLAY=manus-deploy:0

setsid ssh \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=20 \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  kegora@89.117.149.68 \
  'set -eu
   echo "--- identity ---"
   whoami
   hostnamectl --static
   uname -srmo
   echo "--- system ---"
   . /etc/os-release
   printf "%s %s\n" "$ID" "$VERSION_ID"
   echo "--- privileges ---"
   sudo -n true && echo "passwordless-sudo" || echo "sudo-password-required"
   echo "--- resources ---"
   nproc
   free -h
   df -h /
   echo "--- network services ---"
   ss -ltnp || true
   echo "--- firewall ---"
   sudo ufw status verbose || true
   echo "--- tooling ---"
   command -v nginx || true
   command -v node || true
   command -v pnpm || true
   command -v certbot || true
   echo "--- web roots ---"
   ls -ld /var/www /srv /opt 2>/dev/null || true'
