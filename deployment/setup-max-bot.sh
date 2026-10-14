#!/usr/bin/env bash
# Connects the MAX bot to the site so it answers "Start" with the mini-app button.
# Run as kegora on the server; it asks for the bot token without echoing it:
#
#   curl -fsSL https://raw.githubusercontent.com/KEgoRAval/klassny-remont/main/deployment/setup-max-bot.sh -o /tmp/setup-max.sh
#   bash /tmp/setup-max.sh
#
# Writes MAX_BOT_TOKEN, MAX_BOT_USERNAME and a generated MAX_WEBHOOK_SECRET into
# shared/.env (other lines are kept), restarts the site and shows /api/max/status.
set -euo pipefail

env_file="/home/kegora/apps/klassny-remont/shared/.env"

if [[ "$(id -un)" != "kegora" ]]; then
  echo "Run this as kegora, not $(id -un)." >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "Deployment environment is missing: $env_file" >&2
  exit 1
fi

read -r -s -p "Токен бота MAX (business.max.ru → бот → Интеграция): " token; echo
read -r -p "Ник бота в MAX (как в ссылке на бота, без @): " username
token="$(printf '%s' "$token" | tr -d '[:space:]')"
username="$(printf '%s' "$username" | tr -d '[:space:]@')"
if [[ -z "$token" ]]; then
  echo "Токен пустой — ничего не изменено." >&2
  exit 1
fi
if [[ ! "$username" =~ ^[A-Za-z0-9_]*$ ]]; then
  echo "В нике могут быть только латинские буквы, цифры и _." >&2
  exit 1
fi
secret="$(openssl rand -hex 24)"

# MAX's API may use a certificate from the Russian national root CA, which Node does not
# trust by default. Check the token first; add that root for this app only if it is needed.
api="https://platform-api2.max.ru/me"
probe='fetch(process.argv[1],{headers:{Authorization:process.env.T}}).then(async r=>{console.log("HTTP "+r.status);process.exit(r.ok?0:2)}).catch(e=>{console.log(String(e.cause&&e.cause.code||e.message));process.exit(3)})'
extra_ca=""
set +e
result="$(T="$token" node -e "$probe" "$api")"; code=$?
if [[ $code == 3 ]]; then
  ca="/home/kegora/apps/klassny-remont/shared/russian_trusted_root_ca.pem"
  curl -fsSL https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt -o "$ca"
  result="$(T="$token" NODE_EXTRA_CA_CERTS="$ca" node -e "$probe" "$api")"; code=$?
  [[ $code == 3 ]] || extra_ca="$ca"
fi
set -e
echo "Проверка токена в MAX: $result"
if [[ $code != 0 ]]; then
  echo "MAX не принял токен или недоступен — ничего не изменено. Проверьте токен в кабинете бота." >&2
  exit 1
fi

tmp="$(mktemp)"
grep -vE '^(MAX_BOT_TOKEN|MAX_WEBHOOK_SECRET|MAX_BOT_USERNAME|NODE_EXTRA_CA_CERTS)=' "$env_file" > "$tmp" || true
{
  printf 'MAX_BOT_TOKEN=%s\n' "$token"
  printf 'MAX_WEBHOOK_SECRET=%s\n' "$secret"
  printf 'MAX_BOT_USERNAME=%s\n' "$username"
  [[ -z "$extra_ca" ]] || printf 'NODE_EXTRA_CA_CERTS=%s\n' "$extra_ca"
} >> "$tmp"
grep -q '^CANONICAL_ORIGIN=' "$tmp" || printf 'CANONICAL_ORIGIN=https://krem.moscow\n' >> "$tmp"
install -m 0600 "$tmp" "$env_file"
rm -f "$tmp"
echo "Записано в $env_file"

sudo systemctl restart klassny-remont
sleep 6
echo "Статус бота:"
curl -fsS --max-time 10 http://127.0.0.1:3020/api/max/status; echo
