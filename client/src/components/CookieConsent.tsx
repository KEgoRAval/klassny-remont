import { useEffect, useState } from "react";

const STORAGE_KEY = "klassny-remont-cookie-choice";
const ACKNOWLEDGED = "accepted";

function loadAnalytics() {
  const endpoint = (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined)?.replace(/\/+$/, "");
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;
  if (!endpoint || !websiteId || document.querySelector("script[data-klassny-remont-analytics]")) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = `${endpoint}/umami`;
  script.dataset.websiteId = websiteId;
  script.dataset.klassnyRemontAnalytics = "true";
  document.head.appendChild(script);
}

// Site storage can be blocked by the browser; the notice must not break the page then.
function readAcknowledged(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === ACKNOWLEDGED;
  } catch {
    return false;
  }
}

function storeAcknowledged() {
  try {
    window.localStorage.setItem(STORAGE_KEY, ACKNOWLEDGED);
  } catch {
    // The notice will simply be shown again on the next visit.
  }
}

/**
 * Cookie notice. The Yandex Metrika counter loads with the page for every
 * visitor (see client/index.html), so this is a notice with a link to the
 * policy, not a choice. Umami is added once the visitor has seen the notice.
 */
export function CookieConsent() {
  const [acknowledged, setAcknowledged] = useState(true);

  useEffect(() => {
    const seen = readAcknowledged();
    setAcknowledged(seen);
    if (seen) loadAnalytics();
  }, []);

  const acknowledge = () => {
    storeAcknowledged();
    setAcknowledged(true);
    loadAnalytics();
  };

  if (acknowledged) return null;

  return (
    <aside className="cookie-consent" role="region" aria-label="Уведомление о cookies">
      <div className="cookie-consent-main">
        <div className="cookie-consent-copy"><b>Cookies</b><p>Сайт использует cookies и Яндекс Метрику, чтобы понимать, как им пользуются. Продолжая пользоваться сайтом, вы соглашаетесь с этим.</p></div>
        <div className="cookie-consent-actions"><a className="cookie-settings" href="/privacy-policy#cookies">Подробнее</a><button type="button" className="cookie-accept" onClick={acknowledge}>Понятно</button></div>
      </div>
    </aside>
  );
}
