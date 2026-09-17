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

  it("displays the supplied sole proprietor registration details", () => {
    expect(source).toContain("ОГРНИП");
    expect(source).toContain("321527500117786");
    expect(source).toContain("ИНН");
    expect(source).toContain("773166101203");
    expect(source).toContain("ОКПО");
    expect(source).toContain("2011448980");
  });

  it("presents the ЖК Very project without status or visualization labels", () => {
    expect(source).toContain("ЖК Very");
    expect(source).toContain("51,4 м²");
    expect(source).not.toContain("Проект в работе");
    expect(source).not.toContain("Интерьерная визуализация");
    expect(source).not.toContain("интерьерные визуализации");
    expect(source).toContain("very-enhanced-living_6019bd19.png");
    expect(source).toContain("very-enhanced-entry_0f41baa0.png");
    expect(source).toContain("very-enhanced-bedroom_262c2040.png");
    expect(source).toContain("very-enhanced-bathroom_c918e00d.png");
  });

  it("uses a stable unique key for each portfolio card", () => {
    expect(source).toContain("key={project.image}");
    expect(source).not.toContain("key={project.title}");
  });

  it("presents ЖК Ever as a distinct portfolio case", () => {
    expect(source).toContain("const everProjectCards");
    expect(source).toContain("ЖК Ever · Москва");
    expect(source).toContain("Квартира 101,9 м² · Москва.");
    expect(source).toContain("ever-enhanced-living_6eb96fe0.png");
    expect(source).toContain("ever-enhanced-entry_054ed219.png");
    expect(source).toContain("ever-enhanced-bedroom_5f368637.png");
    expect(source).toContain("ever-enhanced-shower_967e9d92.png");
  });
});
