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
  'set -a; . /home/kegora/apps/klassny-remont/shared/.env; set +a
   node --input-type=module -e "const c=new AbortController();setTimeout(()=>c.abort(),15000);fetch(\`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}/getMe\`,{signal:c.signal}).then(async r=>({ok:r.ok,p:await r.json()})).then(({ok,p})=>{if(!ok||!p?.ok||!p?.result?.username)process.exit(3);console.log(p.result.username)}).catch(()=>process.exit(4));"'
