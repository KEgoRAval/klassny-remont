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
   echo "--- service status ---"
   systemctl --no-pager --full status klassny-remont || true
   echo "--- service logs ---"
   journalctl -u klassny-remont -n 100 --no-pager || true
   echo "--- listeners ---"
   ss -ltnp | grep -E ":(3020|3021|3000)\b" || true
   echo "--- application files ---"
   ls -ld ~/apps/klassny-remont/current ~/apps/klassny-remont/current/dist ~/apps/klassny-remont/current/node_modules 2>/dev/null || true
   echo "--- environment markers ---"
   grep -E "^(NODE_ENV|HOST|PORT|CANONICAL_ORIGIN|SITE_NAME)=" ~/apps/klassny-remont/shared/.env || true'
