import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const componentSource = readFileSync(resolve(process.cwd(), "client/src/components/MessengerQuickActions.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("messenger quick actions", () => {
  it("renders accessible direct WhatsApp and Telegram shortcuts", () => {
    expect(appSource).toContain("<MessengerQuickActions />");
    expect(componentSource).toContain('aria-label="Быстрая связь"');
    expect(componentSource).toContain("https://wa.me/79779480672");
    expect(componentSource).toContain("https://t.me/Klrem1_bot?start=site");
    expect(componentSource).toContain('aria-label="Написать в Telegram"');
    expect(componentSource).toContain('aria-label="Написать в WhatsApp"');
    expect(homeSource).toContain("https://t.me/Klrem1_bot?start=site");
    expect(homeSource).toContain('href="tel:+79779480672"');
  });

  it("keeps the controls compact until focused or hovered", () => {
    expect(styles).toContain(".messenger-quick-actions");
    expect(styles).toContain(".messenger-quick-label");
    expect(styles).toContain(".messenger-quick-actions:hover .messengers a");
    expect(styles).toContain(".messenger-quick-actions:focus-within .messengers a");
    expect(styles).toContain(".cookie-consent~.messenger-quick-actions");
  });
});
