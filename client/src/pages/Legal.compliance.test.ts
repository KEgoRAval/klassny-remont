import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const legal = readFileSync(resolve(process.cwd(), "client/src/pages/Legal.tsx"), "utf8");
const cookieConsent = readFileSync(resolve(process.cwd(), "client/src/components/CookieConsent.tsx"), "utf8");
const personalDataConsent = readFileSync(resolve(process.cwd(), "client/src/components/PersonalDataConsent.tsx"), "utf8");
const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

describe("personal data legal pages", () => {
  it("publishes policy and standalone consent routes", () => {
    expect(app).toContain('path={"/privacy-policy"}');
    expect(app).toContain('path={"/personal-data-consent"}');
    expect(legal).toContain("Политика обработки");
    expect(legal).toContain("Согласие на обработку");
    expect(legal).toContain("ИП Бережной Егор Юрьевич");
    expect(legal).toContain('section id="cookies"');
  });

  it("discloses Telegram transfer and withdrawal path", () => {
    expect(legal).toContain("Передача заявки через Telegram");
    expect(legal).toContain("трансграничную передачу");
    expect(legal).toContain("8 (977) 948‑06‑72");
  });

  it("keeps third-party fonts and the Umami script out of the page shell", () => {
    expect(html).not.toContain("data-website-id");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
    expect(html).toContain('url("/fonts/');
    expect(html).not.toContain("/manus-storage/");
  });

  it("tells visitors about cookies and analytics as a notice, not as a choice it does not honour", () => {
    expect(cookieConsent).toContain("Продолжая пользоваться сайтом");
    expect(cookieConsent).toContain("Яндекс Метрик");
    expect(cookieConsent).toContain('href="/privacy-policy#cookies"');
    expect(cookieConsent).toContain("Понятно");
    for (const stale of ["Только необходимые", "Настроить", "Сохранить выбор", "только с согласия", "Разрешить аналитические"]) {
      expect(cookieConsent, stale).not.toContain(stale);
    }
  });

  it("does not load the Metrika counter from the cookie notice", () => {
    expect(cookieConsent).not.toContain("mc.yandex.ru");
    expect(cookieConsent).not.toContain("loadMetrika");
  });

  it("survives a browser that blocks site storage", () => {
    expect(cookieConsent).toContain("try {");
    expect(cookieConsent).toContain("catch");
  });

  it("describes analytics in the policy as it actually works", () => {
    const cookies = legal.slice(legal.indexOf('section id="cookies"'), legal.indexOf("</section>", legal.indexOf('section id="cookies"')));
    expect(cookies).toContain("Яндекс Метрик");
    expect(cookies).toContain("Вебвизор");
    expect(cookies).toContain("при открытии страниц сайта");
    expect(cookies).toContain("настройках браузера");
    for (const stale of ["не загружаются до выбора", "не используется", "Изменить выбор cookies", "может отклонить аналитику"]) {
      expect(cookies, stale).not.toContain(stale);
    }
  });

  it("does not promise a separate analytics permission anywhere else in the policy", () => {
    expect(legal).not.toContain("только после отдельного разрешения на cookies");
    expect(legal).toContain("веб‑аналитика (Яндекс Метрика, Umami)");
  });

  it("publishes the changed policy and the consent text that names it under one new edition date", () => {
    expect(legal).toContain('const CONSENT_VERSION = "2026-10-04"');
    expect(personalDataConsent).toContain('export const PERSONAL_DATA_CONSENT_VERSION = "2026-10-04"');
  });

  it("exposes an accessible custom error hint for unconfirmed consents", () => {
    expect(personalDataConsent).toContain("consent-validation-error");
    expect(personalDataConsent).toContain("consent-check-invalid");
    expect(personalDataConsent).toContain("consent-validation-tooltip");
    expect(personalDataConsent).toContain('role="alert"');
    expect(personalDataConsent).toContain("event.preventDefault(); onConsentInvalid?.()");
  });
});
