import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const legal = readFileSync(resolve(process.cwd(), "client/src/pages/Legal.tsx"), "utf8");
const cookieConsent = readFileSync(resolve(process.cwd(), "client/src/components/CookieConsent.tsx"), "utf8");
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

  it("loads analytics only after an affirmative cookie choice", () => {
    expect(html).not.toContain("data-website-id");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
    expect(html).toContain("/manus-storage/");
    expect(cookieConsent).toContain('choose("accepted")');
    expect(cookieConsent).toContain('choose("declined")');
    expect(cookieConsent).toContain('window.localStorage.setItem');
    expect(cookieConsent).toContain("loadAnalytics()");
  });
});
