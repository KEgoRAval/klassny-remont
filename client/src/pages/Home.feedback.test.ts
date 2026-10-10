import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const mediaSource = readFileSync(resolve(process.cwd(), "client/src/content/media.ts"), "utf8");
const seo = readFileSync(resolve(process.cwd(), "client/src/ssr/prefetch.ts"), "utf8");
const llms = readFileSync(resolve(process.cwd(), "client/public/llms.txt"), "utf8");
const pricing = readFileSync(resolve(process.cwd(), "client/public/pricing.md"), "utf8");

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

  it("requires consent to processing and Telegram delivery in every homepage form", () => {
    expect(source).toContain("<PersonalDataConsent formId=\"lead-modal\"");
    expect(source).toContain("<PersonalDataConsent formId=\"contact-form\"");
    expect(source).toContain("setShowConsentValidation(true)");
    expect(source).toContain("setShowContactConsentValidation(true)");
    expect(source).toContain("showValidation={showConsentValidation}");
    expect(source).toContain("showValidation={showContactConsentValidation}");
    expect(source).toContain("onConsentInvalid={() => setShowConsentValidation(true)}");
    expect(source).toContain("onConsentInvalid={() => setShowContactConsentValidation(true)}");
  });

  it("uses a 40,000 ₽/m² rational renovation rate without exposing material ratios", () => {
    expect(source).toContain("const workRate = 40_000");
    expect(source).not.toContain("materialsRatio");
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
    expect(seo).toContain('telephone: "+7 977 948-06-72"');
  });

  it("displays the supplied sole proprietor registration details", () => {
    expect(source).toContain("ИП Бережной Егор Юрьевич");
    expect(seo).toContain('legalName: "ИП Бережной Егор Юрьевич"');
    expect(source).toContain("ОГРНИП");
    expect(source).toContain("321527500117786");
    expect(source).toContain("ИНН");
    expect(source).toContain("773166101203");
    expect(source).toContain("ОКПО");
    expect(source).toContain("2011448980");
  });

  it("presents four individual projects without status or visualization labels", () => {
    expect(source).toContain("ЖК Very");
    expect(source).toContain("ЖК Ever");
    expect(source).toContain("ЖК Остров");
    expect(source).toContain("ЖК Level");
    expect(source).not.toContain("Проект в работе");
    expect(source).not.toContain("Интерьерная визуализация");
    expect(source).not.toContain("интерьерные визуализации");
    expect(source).toContain("siteImages.veryLiving.src");
    expect(mediaSource).toContain("/media/very-enhanced-living_6019bd19.webp");
    expect(source).toContain("siteImages.veryEntry.src");
    expect(mediaSource).toContain("/media/very-enhanced-entry_0f41baa0.webp");
    expect(source).toContain("siteImages.veryBedroom.src");
    expect(mediaSource).toContain("/media/very-enhanced-bedroom_262c2040.webp");
    expect(source).toContain("siteImages.veryBathroom.src");
    expect(mediaSource).toContain("/media/very-enhanced-bathroom_c918e00d.webp");
  });

  it("uses a stable unique key for each portfolio card", () => {
    expect(source).toContain("key={project.image}");
    expect(source).not.toContain("key={project.title}");
  });

  it("uses a single four-item portfolio data set", () => {
    expect(source).toContain("const projectCards");
    expect(source).not.toContain("veryProjectCards");
    expect(source).not.toContain("everProjectCards");
    expect(source).toContain("siteImages.everLiving.src");
    expect(mediaSource).toContain("/media/ever-enhanced-living_6eb96fe0.webp");
    expect(source).toContain("siteImages.everBedroom.src");
    expect(mediaSource).toContain("/media/ever-enhanced-bedroom_5f368637.webp");
    expect(source).toContain("siteImages.veryBedroom.src");
    expect(mediaSource).toContain("/media/very-enhanced-bedroom_262c2040.webp");
    expect(source).toContain("siteImages.everEntry.src");
    expect(mediaSource).toContain("/media/ever-enhanced-entry_054ed219.webp");
  });

  it("provides direct local answers and matching FAQ schema for AI search", () => {
    expect(source).toContain("Сколько стоит ремонт квартиры в Москве?");
    expect(source).toContain("Можно ли увидеть ваш объект до договора?");
    expect(source).toContain("Как контролируется смета и изменения по ходу работ?");
    expect(seo).toContain('"@type": "FAQPage"');
    expect(seo).toContain('"HomeAndConstructionBusiness"');
    expect(seo).toContain('areaServed');
  });

  it("promises a preliminary estimate within 2 hours everywhere", () => {
    const blog = readFileSync(resolve(process.cwd(), "client/src/pages/Blog.tsx"), "utf8");
    const llmsFull = readFileSync(resolve(process.cwd(), "client/public/llms-full.txt"), "utf8");
    for (const [name, text] of Object.entries({ home: source, blog, seo, llms, llmsFull, pricing })) {
      expect(text, name).not.toMatch(/24\s*час/);
    }
    expect(source).toContain("<b>Смета</b><span>за 2 часа</span>");
    expect(source).toContain("Получить смету за 2 часа");
    expect(source).toContain("пришлём предварительный расчёт за 2 часа");
    expect(source).toContain("<b>в течение 2 часов</b>");
    expect(seo).toContain("Предварительный расчёт за 2 часа.");
    expect(pricing).toContain("в течение 2 часов");
  });

  it("shows only the cost of work in the calculator", () => {
    expect(source).toContain("<span>Стоимость работ</span><output");
    expect(source).toContain("от {workEstimate.toLocaleString(\"ru-RU\")} ₽");
    expect(source).toContain('const calculator = { area, materialLabel: "Рациональный", workEstimate };');
    expect(source).not.toContain("totalEstimate");
    expect(source).not.toContain("materialsEstimate");
  });

  it("uses the 1a wordmark in the header and footer and the 1a icon as favicon", () => {
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(source).toContain('<KremLogo />');
    expect(source).toContain('<KremLogo size="footer" />');
    expect(source).not.toContain("brand-mark");
    expect(html).toContain('<link rel="icon" href="/krem-icon.svg"');
  });

  it("ships the logo files with the lettering converted to outlines", () => {
    for (const file of ["krem-logo.svg", "krem-icon.svg"]) {
      const svg = readFileSync(resolve(process.cwd(), "client/public", file), "utf8");
      expect(svg, file).not.toContain("<text");
      expect(svg, file).not.toContain("font-family");
      expect(svg, file).toContain("<path");
      expect(svg, file).toContain('role="img"');
    }
  });

  it("offers the design-project upload in the contact form with a note on what not to attach", () => {
    expect(source).toContain("const DESIGN_FILE_UPLOAD_ENABLED = true;");
    expect(source).toContain("accept={DESIGN_FILE_ACCEPT}");
    expect(source).toContain("attachment });");
    expect(source).toContain("Не прикладывайте паспортные данные и другие документы, не нужные для расчёта.");
  });

  it("provides machine-readable pricing and company information", () => {
    expect(llms).toContain("Классный Ремонт — ИП Бережной Егор Юрьевич");
    expect(llms).toContain("от 40 000 ₽/м²");
    expect(pricing).toContain("Стоимость работ начинается **от 40 000 ₽ за м²**");
    expect(pricing).toContain("Ориентировочный срок ремонта начинается от **4 месяцев**");
  });
});
