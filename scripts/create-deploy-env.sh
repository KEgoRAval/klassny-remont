#!/usr/bin/env bash
set -euo pipefail

output="${1:-deployment/.env.production}"
mkdir -p "$(dirname "$output")"
umask 077
: > "$output"

required=(
  DATABASE_URL
  JWT_SECRET
  OAUTH_SERVER_URL
  OWNER_OPEN_ID
  VITE_APP_ID
  BUILT_IN_FORGE_API_URL
  BUILT_IN_FORGE_API_KEY
  TELEGRAM_BOT_TOKEN
  TELEGRAM_CHAT_ID
  VITE_ANALYTICS_ENDPOINT
  VITE_ANALYTICS_WEBSITE_ID
)

for key in "${required[@]}"; do
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    printf 'Missing required deployment environment variable: %s\n' "$key" >&2
    exit 1
  fi
  printf '%s=%s\n' "$key" "$value" >> "$output"
done

cat >> "$output" <<'EOF'
NODE_ENV=production
HOST=127.0.0.1
PORT=3020
CANONICAL_ORIGIN=http://89.117.149.68
SITE_NAME=Классный Ремонт
EOF

chmod 600 "$output"
printf 'Deployment environment written with restricted permissions.\n'
