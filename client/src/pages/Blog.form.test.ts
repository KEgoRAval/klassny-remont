import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Blog.tsx"), "utf8");

describe("residential complex estimate form", () => {
  it("renders a dedicated calculator on geo articles", () => {
    expect(source).toContain("function ComplexEstimateForm");
    expect(source).toContain('post.category === "ЖК Москвы" && <ComplexEstimateForm');
    expect(source).toContain("data-complex={complexName}");
  });

  it("submits the auto-filled complex name through the existing lead endpoint", () => {
    expect(source).toContain("trpc.leads.submit.useMutation");
    expect(source).toContain("service: `Расчёт ремонта в ${complexName}`");
    expect(source).toContain('source: "calculator"');
    expect(source).toContain("setSubmitted(true)");
  });

  it("requires separate processing and Telegram consent before submission", () => {
    expect(source).toContain("PersonalDataConsent");
    expect(source).toContain("if (!personalDataConsent || !telegramConsent) { setShowConsentValidation(true); return; }");
    expect(source).toContain("personalDataConsent, telegramConsent");
    expect(source).toContain("PERSONAL_DATA_CONSENT_VERSION");
    expect(source).toContain("showValidation={showConsentValidation}");
    expect(source).toContain("onConsentInvalid={() => setShowConsentValidation(true)}");
  });

  it("keeps the price estimate transparent without showing materials ratio", () => {
    expect(source).toContain("area * 40_000");
    expect(source).not.toContain("materialsEstimate");
    expect(source).not.toContain("totalEstimate");
    expect(source).toContain("Материалы и индивидуальные решения — отдельной строкой после замера.");
    expect(source).not.toContain("≈ 55% от стоимости работ");
  });
});
