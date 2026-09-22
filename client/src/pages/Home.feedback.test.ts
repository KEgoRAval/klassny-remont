import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const seo = readFileSync(resolve(process.cwd(), "client/src/ssr/prefetch.ts"), "utf8");
const llms = readFileSync(resolve(process.cwd(), "client/public/llms.txt"), "utf8");
const pricing = readFileSync(resolve(process.cwd(), "client/public/pricing.md"), "utf8");

 describe("Planpoint landing page", () => {
  it("shows a loading state and disables both lead submission paths", () => {
    expect(source).toContain('<SendingContent label="Отправляем заявку" />');
    expect(source).toContain("disabled={submitLead.isPending}");
    expect(source).toContain("disabled={submitContactLead.isPending}");
  });

  it("provides success feedback for both lead paths", () => {
    expect(source).toContain("function ThankYouModal");
    expect(source).toContain("setThankYouName(name)");
    expect(source).toContain("setContactSent(true)");
    expect(source).toContain("<ThankYouModal name={thankYouName}");
  });

  it("requires separate consent for processing and Telegram delivery in every homepage form", () => {
    expect(source).toContain('<PersonalDataConsent formId="planpoint-lead-modal"');
    expect(source).toContain('<PersonalDataConsent formId="planpoint-contact"');
    expect(source).toContain("setShowConsentValidation(true)");
    expect(source).toContain("setShowContactConsentValidation(true)");
    expect(source).toContain("showValidation={showConsentValidation}");
    expect(source).toContain("showValidation={showContactConsentValidation}");
  });

  it("offers a responsive Planpoint hero, portfolio, process, estimate, FAQ, and contact sections", () => {
    expect(source).toContain("Ремонт, который");
    expect(source).toContain("const projects = [");
    expect(source).toContain('id="projects"');
    expect(source).toContain('id="process"');
    expect(source).toContain('id="prices"');
    expect(source).toContain("Пять шагов");
    expect(source).toContain("Понимайте");
    expect(source).toContain("Частые вопросы");
    expect(source).toContain('id="contact"');
  });

  it("uses the supplied phone number and preserves the four portfolio projects", () => {
    expect(source).toContain('href="tel:+79779480672"');
    expect(source).toContain("8 (977) 948-06-72");
    expect(source).toContain("ЖК Very");
    expect(source).toContain("ЖК Ever");
    expect(source).toContain("ЖК Остров");
    expect(source).toContain("ЖК Level");
    expect(source).toContain("very-enhanced-living_6019bd19.png");
    expect(source).toContain("very-enhanced-entry_0f41baa0.png");
    expect(source).toContain("very-enhanced-bedroom_262c2040.png");
    expect(source).toContain("ever-enhanced-living_6eb96fe0.png");
  });

  it("keeps local business metadata and AI-search machine-readable content", () => {
    expect(seo).toContain('telephone: "+7 977 948-06-72"');
    expect(seo).toContain('legalName: "ИП Бережной Егор Юрьевич"');
    expect(seo).toContain('"@type": "FAQPage"');
    expect(seo).toContain('"HomeAndConstructionBusiness"');
    expect(seo).toContain("areaServed");
    expect(llms).toContain("Классный Ремонт — ИП Бережной Егор Юрьевич");
    expect(llms).toContain("от 40 000 ₽/м²");
    expect(pricing).toContain("Стоимость работ начинается **от 40 000 ₽ за м²**");
  });
});
