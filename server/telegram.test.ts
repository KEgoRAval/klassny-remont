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
};

describe("Telegram lead delivery", () => {
  it("formats contact details and calculator choices for Telegram", () => {
    const message = formatLeadMessage(sampleLead);

    expect(message).toContain("<b>Новая заявка — Классный Ремонт</b>");
    expect(message).toContain("Анна &lt;тест&gt;");
    expect(message).toContain("100 м²");
    expect(message).toContain("Рациональный");
    expect(message).toContain("6 200 000 ₽");
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
});
