import { describe, expect, it } from "vitest";
import { leadInput } from "./routers";

const validLead = {
  name: "Анна",
  phone: "+7 999 123 45 67",
  service: "Ремонт квартиры под ключ",
  area: 100,
  materialLabel: "Рациональный",
  workEstimate: 4_000_000,
  source: "calculator" as const,
  personalDataConsent: true as const,
  telegramConsent: true as const,
  consentVersion: "2026-09-17" as const,
  policyVersion: "2026-09-17" as const,
};

describe("lead consent validation", () => {
  it("accepts the cost of work only, and an older page that still sends materials and total", () => {
    expect(leadInput.safeParse(validLead).success).toBe(true);
    expect(leadInput.safeParse({ ...validLead, materialsEstimate: 2_200_000, totalEstimate: 6_200_000 }).success).toBe(true);
  });

  it("accepts a complete versioned consent", () => {
    expect(leadInput.safeParse(validLead).success).toBe(true);
  });

  it("rejects a lead that omits personal data consent", () => {
    expect(leadInput.safeParse({ ...validLead, personalDataConsent: false }).success).toBe(false);
  });

  it("rejects a lead that omits consent for Telegram delivery", () => {
    expect(leadInput.safeParse({ ...validLead, telegramConsent: false }).success).toBe(false);
  });

  it("accepts the edition of 4 October 2026", () => {
    expect(leadInput.safeParse({ ...validLead, consentVersion: "2026-10-04", policyVersion: "2026-10-04" }).success).toBe(true);
  });

  it("still accepts the previous edition from a page opened before the release", () => {
    expect(leadInput.safeParse({ ...validLead, consentVersion: "2026-09-17", policyVersion: "2026-09-17" }).success).toBe(true);
  });

  it("rejects an unknown policy edition", () => {
    expect(leadInput.safeParse({ ...validLead, policyVersion: "2000-01-01" }).success).toBe(false);
  });

  it("rejects an unknown consent version", () => {
    expect(leadInput.safeParse({ ...validLead, consentVersion: "2000-01-01" }).success).toBe(false);
  });
});
