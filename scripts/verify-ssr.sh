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

robots="$(curl -fsS "$BASE/robots.txt")"
assert_contains "$robots" 'User-agent: YandexBot' 'Robots permits Yandex crawler'
assert_contains "$robots" 'User-agent: PerplexityBot' 'Robots permits Perplexity crawler'
assert_contains "$robots" "Sitemap: $BASE/sitemap.xml" 'Robots links sitemap'

sitemap="$(curl -fsS "$BASE/sitemap.xml")"
assert_contains "$sitemap" "<loc>$BASE/</loc>" 'Sitemap contains canonical home URL'

llms="$(curl -fsS "$BASE/llms.txt")"
assert_contains "$llms" 'ИП Бережной Егор Юрьевич' 'llms.txt contains legal entity'
assert_contains "$llms" 'от 40 000 ₽/м²' 'llms.txt contains price threshold'

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
