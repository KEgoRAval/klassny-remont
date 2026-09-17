import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

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

  it("uses a 40,000 ₽/m² rational renovation rate and 55% materials estimate", () => {
    expect(source).toContain("const workRate = 40_000");
    expect(source).toContain("const materialsRatio = 0.55");
    expect(source).toContain("Рациональный ремонт — от 40 000 ₽/м²");
    expect(source).not.toContain("materialLevel");
  });
});
