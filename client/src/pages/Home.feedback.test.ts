import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const metadata = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

describe("lead form feedback", () => {
  it("shows sending content in both lead submission paths", () => {
    expect(source).toContain('<SendingContent label="Отправляем заявку" />');
    expect(source).toContain('<SendingContent label="Заявка отправляется" />');
    expect(source).toContain("disabled={submitLead.isPending}");
    expect(source).toContain("disabled={submitContactLead.isPending}");
  });

  it("opens one thank-you dialog after either successful form submission", () => {
    expect(source).toContain("function ThankYouModal");
    expect(source).toContain("onSuccess={showThankYou}");
    expect(source).toContain("showThankYou(contactName)");
    expect(source).toContain("<ThankYouModal name={thankYouName}");
  });

  it("uses a 40,000 ₽/m² rational renovation rate without exposing material ratios", () => {
    expect(source).toContain("const workRate = 40_000");
    expect(source).toContain("const materialsRatio = 0.55");
    expect(source).toContain("Рациональный ремонт — от 40 000 ₽/м²");
    expect(source).toContain("Материалы — отдельной строкой в смете");
    expect(source).not.toContain("≈ 55% от стоимости работ");
    expect(source).not.toContain("materialLevel");
  });

  it("offers an active worksite visit and removes redundant navigation links", () => {
    expect(source).toContain("Пригласим вас");
    expect(source).toContain("на объект в работе.");
    expect(source).not.toContain("Познакомиться с командой");
    expect(source).not.toContain(">Все проекты <");
  });

  it("uses the supplied phone number for calls and local business metadata", () => {
    expect(source).toContain('href="tel:+79779480672"');
    expect(source).toContain("8 (977) 948‑06‑72");
    expect(metadata).toContain('"telephone":"+7 977 948-06-72"');
  });
});
