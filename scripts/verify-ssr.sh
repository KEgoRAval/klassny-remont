#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:4101}"
UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
PASS=0

assert_contains() {
  local content="$1" needle="$2" label="$3"
  if printf '%s' "$content" | grep -F -- "$needle" >/dev/null; then
    printf '[PASS] %s\n' "$label"
    PASS=$((PASS + 1))
  else
    printf '[FAIL] %s — missing: %s\n' "$label" "$needle" >&2
    exit 1
  fi
}

home="$(curl -fsS --compressed -A "$UA" "$BASE/")"
assert_contains "$home" '<div id="root">' 'SSR root is present'
assert_contains "$home" 'Интерьеры,' 'SSR body contains hero text'
assert_contains "$home" 'Сколько стоит ремонт квартиры в Москве?' 'SSR body contains FAQ answer target'
assert_contains "$home" '<title>Ремонт квартир под ключ в Москве — Классный Ремонт</title>' 'SEO title is present'
assert_contains "$home" 'name="description"' 'Meta description is present'
assert_contains "$home" 'property="og:title"' 'Open Graph title is present'
assert_contains "$home" 'property="og:image" content="http://localhost:4101/manus-storage/' 'Open Graph image is absolute'
assert_contains "$home" 'rel="canonical" href="http://localhost:4101/"' 'Canonical is present'
assert_contains "$home" '"@type":"FAQPage"' 'FAQ JSON-LD is present'

blog="$(curl -fsS --compressed -A "$UA" "$BASE/blog")"
assert_contains "$blog" '<title>Блог о ремонте квартир в Москве — Классный Ремонт</title>' 'Blog title is present'
assert_contains "$blog" 'Сколько стоит ремонт квартиры в Москве в 2026 году' 'Blog index contains practical article'
assert_contains "$blog" 'Ремонт в ЖК «ВЭРИ на Ботанической»' 'Blog index contains geo article'
assert_contains "$blog" 'Ремонт в ЖК «ЗИЛАРТ»' 'Blog index contains additional geo article'
assert_contains "$blog" 'Ремонт в Luzhniki Collection' 'Blog index contains requested geo article'
assert_contains "$blog" 'rel="canonical" href="http://localhost:4101/blog"' 'Blog canonical is present'

article="$(curl -fsS --compressed -A "$UA" "$BASE/blog/stoimost-remonta-kvartiry-v-moskve-2026")"
assert_contains "$article" '<title>Сколько стоит ремонт квартиры в Москве в 2026 году — Классный Ремонт</title>' 'Article title is present'
assert_contains "$article" 'Что означает «от 40 000 ₽/м²»' 'Article body is server-rendered'
assert_contains "$article" 'property="article:published_time" content="2026-09-17"' 'Article publication metadata is present'
assert_contains "$article" '"@type":"BlogPosting"' 'Article structured data is present'
assert_contains "$article" '"@type":"BreadcrumbList"' 'Article breadcrumb schema is present'
assert_contains "$article" '"@id":"http://localhost:4101/blog/stoimost-remonta-kvartiry-v-moskve-2026#article"' 'Article schema uses canonical URLs'
assert_contains "$article" 'rel="canonical" href="http://localhost:4101/blog/stoimost-remonta-kvartiry-v-moskve-2026"' 'Article canonical is present'

sobytie_article="$(curl -fsS --compressed -A "$UA" "$BASE/blog/remont-v-zhk-sobytie-v-moskve")"
assert_contains "$sobytie_article" '<title>Ремонт в ЖК «Событие»: особенности квартир в разных кварталах — Классный Ремонт</title>' 'Requested article title is present'
assert_contains "$sobytie_article" 'Рассчитать стоимость' 'Requested article contains complex estimate form'
assert_contains "$sobytie_article" 'ЖК «Событие»' 'Requested article auto-fills complex name'
assert_contains "$sobytie_article" '"@type":"BlogPosting"' 'Requested article structured data is present'

robots="$(curl -fsS "$BASE/robots.txt")"
assert_contains "$robots" 'User-agent: YandexBot' 'Robots permits Yandex crawler'
assert_contains "$robots" 'User-agent: PerplexityBot' 'Robots permits Perplexity crawler'
assert_contains "$robots" "Sitemap: $BASE/sitemap.xml" 'Robots links sitemap'

sitemap="$(curl -fsS "$BASE/sitemap.xml")"
assert_contains "$sitemap" "<loc>$BASE/</loc>" 'Sitemap contains canonical home URL'
assert_contains "$sitemap" "<loc>$BASE/blog</loc>" 'Sitemap contains blog index'
assert_contains "$sitemap" "<loc>$BASE/blog/remont-v-zhk-ever-v-moskve</loc>" 'Sitemap contains geo article'
assert_contains "$sitemap" "<loc>$BASE/blog/remont-v-zhk-zilart-v-moskve</loc>" 'Sitemap contains additional geo article'
assert_contains "$sitemap" "<loc>$BASE/blog/remont-v-luzhniki-collection-v-moskve</loc>" 'Sitemap contains requested geo article'

privacy_policy="$(curl -fsS --compressed -A "$UA" "$BASE/privacy-policy")"
assert_contains "$privacy_policy" '<title>Политика обработки персональных данных — Классный Ремонт</title>' 'Privacy policy title is present'
assert_contains "$privacy_policy" 'name="robots" content="noindex, follow"' 'Privacy policy is noindex'
assert_contains "$privacy_policy" 'Передача заявки через Telegram' 'Privacy policy discloses Telegram delivery'

consent_page="$(curl -fsS --compressed -A "$UA" "$BASE/personal-data-consent")"
assert_contains "$consent_page" '<title>Согласие на обработку персональных данных — Классный Ремонт</title>' 'Consent page title is present'
assert_contains "$consent_page" 'Отдельное согласие на Telegram' 'Consent page is server-rendered'

llms="$(curl -fsS "$BASE/llms.txt")"
assert_contains "$llms" 'ИП Бережной Егор Юрьевич' 'llms.txt contains legal entity'
assert_contains "$llms" 'от 40 000 ₽/м²' 'llms.txt contains price threshold'
assert_contains "$llms" 'Приёмка квартиры в новостройке' 'llms.txt links blog knowledge'

llms_full="$(curl -fsS "$BASE/llms-full.txt")"
assert_contains "$llms_full" 'ЖК «Остров»' 'llms-full.txt maps geo articles'
assert_contains "$llms_full" 'ЖК «Ривер Парк Коломенское»' 'llms-full.txt maps new geo article'
assert_contains "$llms_full" 'Luzhniki Collection' 'llms-full.txt maps requested geo article'

pricing="$(curl -fsS "$BASE/pricing.md")"
assert_contains "$pricing" 'Что входит в стоимость работ' 'Machine-readable price methodology is public'

not_found_code="$(curl -s -o /tmp/klassny-remont-404.html -w '%{http_code}' -A "$UA" "$BASE/not-a-page")"
if [[ "$not_found_code" != "404" ]]; then
  echo "[FAIL] Unknown page must return 404, got $not_found_code" >&2
  exit 1
fi
not_found="$(cat /tmp/klassny-remont-404.html)"
assert_contains "$not_found" 'name="robots" content="noindex, follow"' '404 page is noindex'

printf '== SEO SSR verification passed: %s checks ==\n' "$PASS"
