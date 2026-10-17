#!/usr/bin/env bash
# Turns on automatic estimates. Run as kegora on the server; secrets are asked without echo:
#
#   curl -fsSL https://raw.githubusercontent.com/KEgoRAval/klassny-remont/main/deployment/setup-estimates.sh -o ~/setup-estimates.sh
#   bash ~/setup-estimates.sh
#
# Writes ANTHROPIC_API_KEY, SMTP_URL, MAIL_FROM and MAIL_FROM_NAME into shared/.env (other lines are kept),
# checks the key and the mail login, restarts the site.
set -euo pipefail

app_root="/home/kegora/apps/klassny-remont"
env_file="$app_root/shared/.env"

if [[ "$(id -un)" != "kegora" ]]; then
  echo "Run this as kegora, not $(id -un)." >&2
  exit 1
fi
[[ -f "$env_file" ]] || { echo "Deployment environment is missing: $env_file" >&2; exit 1; }

read -r -s -p "Ключ Claude API (console.anthropic.com → API keys, начинается с sk-ant-): " api_key; echo
api_key="$(printf '%s' "$api_key" | tr -d '[:space:]')"
[[ "$api_key" == sk-ant-* ]] || { echo "Это не похоже на ключ Claude API — ничего не изменено." >&2; exit 1; }
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://api.anthropic.com/v1/models -H "x-api-key: $api_key" -H "anthropic-version: 2023-06-01" || true)"
echo "Проверка ключа: HTTP $code"
[[ "$code" == 200 ]] || { echo "Ключ не принят — ничего не изменено." >&2; exit 1; }

echo
echo "Почта для отправки смет клиентам (например, Яндекс 360 или Mail.ru для домена)."
read -r -p "SMTP-сервер [smtp.yandex.ru]: " smtp_host; smtp_host="${smtp_host:-smtp.yandex.ru}"
read -r -p "Адрес ящика полностью (name@yandex.ru или name@вашдомен.ru): " smtp_user
smtp_user="$(printf '%s' "$smtp_user" | tr -d '[:space:]')"
if [[ "$smtp_user" != *@* && "$smtp_host" == smtp.yandex.ru ]]; then smtp_user="${smtp_user}@yandex.ru"; fi
[[ "$smtp_user" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || { echo "Нужен полный адрес ящика — ничего не изменено." >&2; exit 1; }
read -r -s -p "Пароль приложения для этого ящика: " smtp_pass; echo
read -r -p "Имя отправителя [Классный ремонт]: " sender; sender="${sender:-Классный ремонт}"
enc() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }
smtp_url="smtps://$(enc "$smtp_user"):$(enc "$smtp_pass")@${smtp_host}:465"

if [[ -d "$app_root/current/node_modules/nodemailer" ]]; then
  SMTP_URL="$smtp_url" node -e '
    const m = require(process.argv[1]);
    m.createTransport(process.env.SMTP_URL).verify().then(() => console.log("Почта: вход выполнен"), e => { console.error("Почта: " + e.message); process.exit(1); });
  ' "$app_root/current/node_modules/nodemailer" || { echo "Не удалось войти в почту — ничего не изменено." >&2; exit 1; }
else
  echo "nodemailer ещё не установлен в текущем релизе — проверю почту после следующего деплоя."
fi

tmp="$(mktemp)"
grep -vE '^(ANTHROPIC_API_KEY|SMTP_URL|MAIL_FROM|MAIL_FROM_NAME)=' "$env_file" > "$tmp" || true
{
  printf 'ANTHROPIC_API_KEY=%s\n' "$api_key"
  printf 'SMTP_URL=%s\n' "$smtp_url"
  printf 'MAIL_FROM=%s\n' "$smtp_user"
  printf 'MAIL_FROM_NAME=%s\n' "$sender"
} >> "$tmp"
install -m 0600 "$tmp" "$env_file"
rm -f "$tmp"
echo "Записано в $env_file"

sudo systemctl restart klassny-remont
sleep 5
sudo journalctl -u klassny-remont -n 30 --no-pager | grep -E '\[Estimate\]|\[MAX\]|Server running' || true
echo
echo "Готово. Выключить отправку клиентам (копии вам останутся): добавьте ESTIMATE_AUTO_SEND=off в $env_file и перезапустите сайт."
