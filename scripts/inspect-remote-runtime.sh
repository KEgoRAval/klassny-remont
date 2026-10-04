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
   echo "--- node ---"
   node --version
   npm --version
   corepack --version 2>/dev/null || true
   command -v pnpm || true
   echo "--- sudo ---"
   sudo -V | head -1'
