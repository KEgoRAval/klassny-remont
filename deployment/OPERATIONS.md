# Классный Ремонт — эксплуатация на сервере

Приложение размещено на сервере в `/home/kegora/apps/klassny-remont`. Текущая версия обозначается символьной ссылкой `current`, а каждый релиз находится в отдельной директории `releases/<UTC timestamp>`. Постоянная конфигурация находится в `shared/.env` с правами доступа `0600`; секреты в этот документ не записываются.

Node.js‑приложение управляется `systemd` как `klassny-remont.service` и слушает только `127.0.0.1:3020`. Внешний HTTP‑трафик принимает Nginx на порту 80 и проксирует к приложению. UFW разрешает только SSH, HTTP и HTTPS. Для диагностики используйте `sudo systemctl status klassny-remont`, `sudo journalctl -u klassny-remont -n 100 --no-pager` и `sudo nginx -t`.

До подключения домена IP‑версия `http://89.117.149.68` маркируется заголовком `X-Robots-Tag: noindex, nofollow`, чтобы не создавать поисковый дубль. Для подключения `krem.moscow` и `www.krem.moscow` используйте `scripts/wait-for-dns-and-enable-https.sh`: он ждёт появления обеих A‑записей на публичном резолвере, выпускает сертификат Let's Encrypt, включает HTTP→HTTPS и `www`→основной домен. После активации каноническим адресом является `https://krem.moscow`. Внешние данные (база, файловое хранилище и Telegram) временно используют действующие серверные переменные WebDev; проект в Manus необходимо сохранять активным до плановой миграции этих компонентов.

## Журнал заявок

Каждая заявка с сайта сначала записывается в файл‑журнал и только потом отправляется в Telegram. Путь задаётся переменной `LEADS_JOURNAL_PATH`; на сервере это `/home/kegora/apps/klassny-remont/shared/leads/leads.jsonl`. Файл лежит вне директорий релизов, поэтому переживает выкладки, и создаётся с правами `600` (читает только пользователь `kegora`).

Формат — одна JSON‑запись на строку: `{"type":"lead", "id", "receivedAt", "lead": {...}}` при получении заявки и `{"type":"delivered", "id", "at"}` после того, как Telegram её принял. Если Telegram недоступен, посетитель всё равно видит подтверждение, а приложение раз в две минуты повторяет отправку всех недоставленных заявок младше семи дней; в сообщении при этом указано фактическое время получения.

Посмотреть заявки, которые ещё не дошли до Telegram:

```bash
cd /home/kegora/apps/klassny-remont/shared/leads
grep '"type":"lead"' leads.jsonl | grep -v -F -f <(grep -o '"type":"delivered","id":"[^"]*"' leads.jsonl | cut -d'"' -f8) || true
```

В журнале хранятся имена и телефоны. Его нужно включить в резервные копии и в правила хранения и удаления персональных данных; публиковать и пересылать файл нельзя.

### Файлы дизайн‑проектов

К заявке из формы контактов можно приложить дизайн‑проект: PDF, JPG, PNG или WebP до 20 МБ. Тип проверяется сервером по первым байтам файла, а не по расширению. Файл записывается в папку `attachments` рядом с журналом (`/home/kegora/apps/klassny-remont/shared/leads/attachments/`, права `700` на папку и `600` на файлы), в журнале остаются только имя, тип, размер и имя файла в этой папке (`attachment.storedAs`). В Telegram файл уходит одним сообщением вместе с заявкой (текст заявки — подпись к документу). После того как Telegram его принял, копия на сервере удаляется; если Telegram недоступен, файл ждёт повторной отправки вместе с заявкой. Файлы недоставленных заявок старше семи дней не удаляются автоматически — их нужно разобрать вручную вместе с журналом.

Nginx пропускает тела запросов до 5 МБ, а для `/api/trpc/leads.submit` — до 30 МБ (файл передаётся в base64, это примерно +33 %).

## Выкладка

### С самого сервера (основной способ)

Скрипт `deployment/release-from-github.sh` собирает релиз прямо на сервере из GitHub (репозиторий публичный, токен не нужен) и включает его. Отдельная машина для выкладки не нужна — достаточно SSH‑доступа пользователя `kegora`:

```bash
ssh -t kegora@89.117.149.68
curl -fsSL https://raw.githubusercontent.com/KEgoRAval/klassny-remont/main/deployment/release-from-github.sh -o /tmp/release.sh
bash /tmp/release.sh
```

Скрипт берёт текущий коммит `main` (или ветку/тег первым аргументом), скачивает именно его, ставит зависимости, собирает, переключает `current` через `activate-release.sh`, ставит HTTPS‑конфиг Nginx из репозитория (при ошибке `nginx -t` возвращает прежний), проверяет, что сайт отвечает на `127.0.0.1:3020` и на https://krem.moscow/, и оставляет 5 последних релизов. Коммит релиза записан в `releases/<id>/RELEASE_COMMIT`. `sudo` спросит пароль `kegora`.

Откат на предыдущий релиз:

```bash
ls -1 /home/kegora/apps/klassny-remont/releases
sudo ln -sfn /home/kegora/apps/klassny-remont/releases/<предыдущий id> /home/kegora/apps/klassny-remont/current
sudo systemctl restart klassny-remont
```

### Из песочницы Manus

Выкладывать скриптом `scripts/deploy-and-keep-https.sh`, а не `scripts/deploy-to-server.sh` напрямую. `deploy-to-server.sh` запускает `deployment/prepare-server.sh`, а тот ставит конфиг Nginx только для HTTP (`klassny-remont.nginx.conf`) — после включения HTTPS это выключало бы его при каждой выкладке. Новый скрипт делает обычную выкладку, затем, если на сервере есть сертификат для krem.moscow, ставит `klassny-remont.https.nginx.conf`, проверяет его `nginx -t` (при ошибке возвращает прежний конфиг), перезагружает Nginx и проверяет, что https://krem.moscow/ отвечает, а http:// перенаправляет на него. Без сертификата HTTP‑конфиг остаётся как есть.

## Яндекс Метрика

Счётчик № 113397509. Его стандартный код стоит в начале `<head>` шаблона `client/index.html` и загружается на каждой странице для каждого посетителя, с Вебвизором и картой кликов — так, как он выдан в интерфейсе Метрики. Номер счётчика продублирован в `client/src/lib/metrika.ts`; тест проверяет, что номера совпадают. По решению владельца поля имени и телефона в формах помечены классом `ym-record-keys`: Вебвизор записывает их содержимое, в том числе у посетителей, которые не отправили форму. Об этом сказано в разделе 5 политики. Чтобы вернуть звёздочки, замените класс на `ym-disable-keys` и поправьте это предложение политики.

Уведомление о cookies — именно уведомление со ссылкой на политику, а не выбор: оно не включает и не выключает Метрику. Сервис Umami подключается после нажатия «Понятно».

В интерфейсе Метрики нужно создать цели типа «JavaScript‑событие» с такими идентификаторами: `lead` (любая отправленная форма — её использовать в Директе), `lead_calculator`, `lead_contact`, `lead_blog`, `click_phone`, `click_telegram`, `click_whatsapp`. Переходы внутри сайта без перезагрузки страницы отправляются в Метрику как просмотры.


## Автодеплой из GitHub

Каждый мерж в `main` выкатывается workflow `.github/workflows/deploy.yml`: проверка типов на GitHub, затем SSH на сервер по ключу, который умеет только одно — запустить `/usr/local/sbin/klassny-ci-release` (это `deployment/ci-release.sh`). Скрипт собирает `main` от имени `kegora`, переключает `current`, перезапускает сервис и при неответе откатывается на предыдущий релиз. Конфиг Nginx автодеплой не трогает — его меняют ручным `release-from-github.sh`.

Разовая настройка (от `kegora` на сервере, sudo спросит пароль):

```bash
curl -fsSL https://raw.githubusercontent.com/KEgoRAval/klassny-remont/main/deployment/setup-ci-deploy.sh -o /tmp/setup-ci.sh
bash /tmp/setup-ci.sh
```

Скрипт печатает значения секретов `DEPLOY_SSH_KEY` и `DEPLOY_KNOWN_HOSTS` для GitHub → Settings → Secrets and variables → Actions. Изменения в `ci-release.sh` вступают в силу только после повторного запуска `setup-ci-deploy.sh`. Ручной запуск деплоя: GitHub → Actions → Deploy → Run workflow.

## Бот в MAX

Сайт отвечает боту MAX: на «Старт» и на любое сообщение в личке бот присылает приветствие с кнопкой мини-приложения `/max` (код — `server/maxBot.ts`). Подключение — один раз, от `kegora` на сервере:

```bash
curl -fsSL https://raw.githubusercontent.com/KEgoRAval/klassny-remont/main/deployment/setup-max-bot.sh -o /tmp/setup-max.sh
bash /tmp/setup-max.sh
```

Скрипт спросит токен бота (не отображается) и ник, проверит токен в API MAX, запишет `MAX_BOT_TOKEN`, `MAX_WEBHOOK_SECRET`, `MAX_BOT_USERNAME` в `shared/.env`, перезапустит сайт. При старте сайт сам подписывает вебхук `https://krem.moscow/api/max/webhook`. Состояние без секретов: `https://krem.moscow/api/max/status`. Если API MAX отдаёт сертификат национального УЦ, скрипт добавляет его только для этого приложения через `NODE_EXTRA_CA_CERTS`.
