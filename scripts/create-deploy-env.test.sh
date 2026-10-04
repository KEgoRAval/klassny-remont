#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

export DATABASE_URL="mysql://example"
export JWT_SECRET="secret"
export OAUTH_SERVER_URL="https://oauth.example"
export OWNER_OPEN_ID="owner"
export VITE_APP_ID="app"
export BUILT_IN_FORGE_API_URL="https://forge.example"
export BUILT_IN_FORGE_API_KEY="forge-secret"
export TELEGRAM_BOT_TOKEN="bot-token"
export TELEGRAM_CHAT_ID="-100123"
export VITE_ANALYTICS_ENDPOINT="https://analytics.example"
export VITE_ANALYTICS_WEBSITE_ID="website"

"$project_root/scripts/create-deploy-env.sh" "$temp_dir/.env"
set -a
. "$temp_dir/.env"
set +a

[[ "$SITE_NAME" == "Классный Ремонт" ]]
[[ "$CANONICAL_ORIGIN" == "https://krem.moscow" ]]
[[ "${LEADS_JOURNAL_PATH:-}" == "/home/kegora/apps/klassny-remont/shared/leads/leads.jsonl" ]]
[[ "$(stat -c '%a' "$temp_dir/.env")" == "600" ]]
printf 'Deployment environment quoting verified.\n'
