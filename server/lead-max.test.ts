import { describe, expect, it } from "vitest";
import { leadInput } from "./routers";
import { formatLeadMessage, type LeadNotification } from "./telegram";

const maxLead: LeadNotification = {
  name: "Ольга",
  phone: "+7 900 000 00 00",
  service: "MAX: Предварительный расчёт · проект: нет проекта",
  area: 38,
  materialLabel: "Вторичка",
  workEstimate: 1_670_000,
  workEstimateMax: 1_980_000,
  source: "calculator",
  channel: "max",
  personalDataConsent: true,
  telegramConsent: true,
  consentVersion: "2026-10-10",
  policyVersion: "2026-10-10",
};

describe("MAX mini-app leads", () => {
  it("accepts small apartments and the channel mark", () => {
    const parsed = leadInput.parse({ ...maxLead });
    expect(parsed.area).toBe(38);
    expect(parsed.channel).toBe("max");
  });

  it("still rejects an area outside 20–400 m²", () => {
    expect(() => leadInput.parse({ ...maxLead, area: 10 })).toThrow();
    expect(() => leadInput.parse({ ...maxLead, area: 500 })).toThrow();
  });

  it("tells the team the lead came from MAX and what range the client saw", () => {
    const message = formatLeadMessage(maxLead).replace(/\u00a0|\u202f/g, " ");
    expect(message).toContain("MAX · предварительный расчёт");
    expect(message).toContain("<b>Квартира:</b> Вторичка");
    expect(message).toContain("1 670 000 ₽ – 1 980 000 ₽ (показано клиенту)");
  });

  it("leaves site leads formatted as before", () => {
    const { channel: _c, workEstimateMax: _m, ...siteLead } = maxLead;
    const message = formatLeadMessage({ ...siteLead, materialLabel: "Рациональный" }).replace(/\u00a0|\u202f/g, " ");
    expect(message).toContain("<b>Источник:</b> Калькулятор");
    expect(message).toContain("<b>Уровень ремонта:</b> Рациональный");
    expect(message).toContain("от 1 670 000 ₽");
  });
});
