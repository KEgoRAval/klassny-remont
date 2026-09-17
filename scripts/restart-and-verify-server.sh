#!/usr/bin/env bash
set -euo pipefail

export SSH_ASKPASS=/home/ubuntu/.ssh/klassny-remont-askpass.sh
export SSH_ASKPASS_REQUIRE=force
export DISPLAY=manus-deploy:0

{
  /home/ubuntu/.ssh/klassny-remont-askpass.sh
  cat <<'REMOTE'
systemctl restart klassny-remont
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if systemctl is-active --quiet klassny-remont && curl -fsS --max-time 15 http://127.0.0.1:3020/ | grep -q 'Классный Ремонт'; then
    systemctl is-enabled --quiet klassny-remont
    echo 'Restart recovery verified.'
    exit 0
  fi
  sleep 2
done
journalctl -u klassny-remont -n 100 --no-pager >&2
exit 1
REMOTE
} | setsid ssh \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=20 \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  kegora@89.117.149.68 \
  "sudo -S -p '' bash -s"
