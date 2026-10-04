import { describe, expect, it, vi } from "vitest";
import { formatLeadMessage, sendLeadToTelegram } from "./telegram";

const sampleLead = {
  name: "Анна <тест>",
  phone: "+7 999 123 45 67",
  service: "Ремонт квартиры под ключ",
  area: 100,
  materialLabel: "Рациональный",
  workEstimate: 4_000_000,
  materialsEstimate: 2_200_000,
  totalEstimate: 6_200_000,
  source: "calculator" as const,
  personalDataConsent: true as const,
  telegramConsent: true as const,
  consentVersion: "2026-09-17" as const,
  policyVersion: "2026-09-17" as const,
};

describe("Telegram lead delivery", () => {
  it("formats contact details and calculator choices for Telegram", () => {
    const message = formatLeadMessage(sampleLead);

    expect(message).toContain("<b>Новая заявка — Классный Ремонт</b>");
    expect(message).toContain("Анна &lt;тест&gt;");
    expect(message).toContain("100 м²");
    expect(message).toContain("Рациональный");
    expect(message).toContain("6 200 000 ₽");
    expect(message).toContain("обработка ПД и передача в Telegram — получены (2026-09-17)");
  });

  it("preserves the auto-filled residential complex in an estimate request", () => {
    const message = formatLeadMessage({ ...sampleLead, service: "Расчёт ремонта в ЖК «ЗИЛАРТ»" });

    expect(message).toContain("Расчёт ремонта в ЖК «ЗИЛАРТ»");
  });

  it("sends a formatted message using server-only credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await sendLeadToTelegram(sampleLead, fetcher, { token: "secret-token", chatId: "-100123" });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.telegram.org/botsecret-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(request.body)).toMatchObject({ chat_id: "-100123", parse_mode: "HTML" });
  });

  it("says when a late-delivered lead was actually received, in Moscow time", () => {
    const message = formatLeadMessage(sampleLead, { delayedSince: "2026-10-04T12:00:00.000Z" });

    expect(message).toContain("Доставлено с задержкой");
    expect(message).toContain("04.10.2026, 15:00");
  });

  it("does not mention a delay for a lead delivered straight away", () => {
    expect(formatLeadMessage(sampleLead)).not.toContain("задержк");
  });

  it("passes the delay note through to the message it sends", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await sendLeadToTelegram(sampleLead, fetcher, { token: "secret-token", chatId: "-100123" }, { delayedSince: "2026-10-04T12:00:00.000Z" });

    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body).text).toContain("Доставлено с задержкой");
  });

  it("puts a time limit on the request so a hanging Telegram cannot hold the form", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await sendLeadToTelegram(sampleLead, fetcher, { token: "secret-token", chatId: "-100123" });

    expect(fetcher.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
  });
});
