import { useEffect, useState } from "react";

type CookieChoice = "accepted" | "declined" | null;
const STORAGE_KEY = "klassny-remont-cookie-choice";

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

export function CookieConsent() {
  const [choice, setChoice] = useState<CookieChoice>(null);

  useEffect(() => {
    const restoreChoice = () => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "accepted") {
        setChoice("accepted");
        loadAnalytics();
      } else if (saved === "declined") {
        setChoice("declined");
      } else {
        setChoice(null);
      }
    };

    restoreChoice();
    window.addEventListener("cookie-preferences", restoreChoice);
    return () => window.removeEventListener("cookie-preferences", restoreChoice);
  }, []);

  const choose = (nextChoice: Exclude<CookieChoice, null>) => {
    window.localStorage.setItem(STORAGE_KEY, nextChoice);
    setChoice(nextChoice);
    if (nextChoice === "accepted") loadAnalytics();
  };

  if (choice) return null;

  return (
    <aside className="cookie-consent" role="region" aria-label="Настройки cookies">
      <div><b>Настройки cookies</b><p>Технически необходимые данные помогают сайту работать. Аналитику подключаем только с вашего согласия. Подробнее — в <a href="/privacy-policy#cookies">Политике обработки персональных данных</a>.</p></div>
      <div className="cookie-consent-actions"><button type="button" className="cookie-decline" onClick={() => choose("declined")}>Только необходимые</button><button type="button" className="cookie-accept" onClick={() => choose("accepted")}>Разрешить аналитику</button></div>
    </aside>
  );
}
