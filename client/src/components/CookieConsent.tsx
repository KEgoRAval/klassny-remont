import { useEffect, useState } from "react";
import { loadMetrika, metrikaCounterId, YANDEX_METRIKA_ID } from "@/lib/metrika";

type CookieChoice = "accepted" | "declined" | null;
const STORAGE_KEY = "klassny-remont-cookie-choice";

function loadAnalytics() {
  const counterId = metrikaCounterId(YANDEX_METRIKA_ID);
  if (counterId) loadMetrika(counterId);

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

export function CookieConsent() {
  const [choice, setChoice] = useState<CookieChoice>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const restoreChoice = () => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "accepted") {
        setAnalyticsEnabled(true);
        setChoice("accepted");
        loadAnalytics();
      } else if (saved === "declined") {
        setAnalyticsEnabled(false);
        setChoice("declined");
      } else {
        setAnalyticsEnabled(false);
        setChoice(null);
        setDetailsOpen(false);
      }
    };

    restoreChoice();
    window.addEventListener("cookie-preferences", restoreChoice);
    return () => window.removeEventListener("cookie-preferences", restoreChoice);
  }, []);

  const saveChoice = (allowAnalytics: boolean) => {
    const nextChoice = allowAnalytics ? "accepted" : "declined";
    window.localStorage.setItem(STORAGE_KEY, nextChoice);
    setAnalyticsEnabled(allowAnalytics);
    setChoice(nextChoice);
    if (allowAnalytics) loadAnalytics();
  };

  if (choice) return null;

  return (
    <aside className={detailsOpen ? "cookie-consent cookie-consent-expanded" : "cookie-consent"} role="region" aria-label="Настройки cookies">
      <div className="cookie-consent-main">
        <div className="cookie-consent-copy"><b>Cookies</b><p>Технические — для работы сайта. Аналитика — только с согласия.</p></div>
        <div className="cookie-consent-actions"><button type="button" className="cookie-settings" aria-expanded={detailsOpen} aria-controls="cookie-preferences" onClick={() => setDetailsOpen(!detailsOpen)}>Настроить</button><button type="button" className="cookie-accept" onClick={() => saveChoice(true)}>Принять</button></div>
      </div>
      {detailsOpen && <div className="cookie-preferences" id="cookie-preferences">
        <div className="cookie-preferences-heading"><p>Настройки cookies</p><a href="/privacy-policy#cookies">Подробнее в политике</a></div>
        <div className="cookie-category"><div><b>Необходимые</b><span>Нужны для работы сайта и форм.</span></div><em>Всегда включены</em></div>
        <label className="cookie-category cookie-category-toggle"><span><b>Аналитика</b><small>Помогает понять, как улучшать сайт. Необязательна.</small></span><input type="checkbox" checked={analyticsEnabled} onChange={(event) => setAnalyticsEnabled(event.target.checked)} aria-label="Разрешить аналитические cookies" /><i aria-hidden="true"></i></label>
        <div className="cookie-preferences-actions"><button type="button" className="cookie-decline" onClick={() => saveChoice(false)}>Только необходимые</button><button type="button" className="cookie-save" onClick={() => saveChoice(analyticsEnabled)}>Сохранить выбор</button></div>
      </div>}
    </aside>
  );
}
