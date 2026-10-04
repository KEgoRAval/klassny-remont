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
   systemctl is-enabled --quiet klassny-remont
   systemctl is-active --quiet klassny-remont
   curl -fsS --max-time 20 http://127.0.0.1:3020/ | grep -q "Классный Ремонт"
   curl -fsSI --max-time 20 http://127.0.0.1/ | sed -n "1p"
   curl -fsSI --max-time 20 http://127.0.0.1/manus-storage/hero-living-room_277d141a.jpg | sed -n "1p"'

echo "--- public response ---"
curl -fsSIL --max-time 30 http://89.117.149.68/ | sed -n '1,8p'
