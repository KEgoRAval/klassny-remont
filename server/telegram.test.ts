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

  describe("with an attached design project", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 test");
    const leadWithFile = {
      ...sampleLead,
      attachment: { fileName: "Проект <кухня>.pdf", mimeType: "application/pdf" as const, size: 3_355_443, storedAs: "x.pdf" },
    };

    it("sends the lead as the caption of one document, so text and file arrive together", async () => {
      const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

      await sendLeadToTelegram(leadWithFile, fetcher, { token: "secret-token", chatId: "-100123" }, { attachment: pdf });

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.telegram.org/botsecret-token/sendDocument");
      const form = fetcher.mock.calls[0]?.[1].body as FormData;
      expect(form.get("chat_id")).toBe("-100123");
      expect(form.get("parse_mode")).toBe("HTML");
      expect(form.get("caption")).toContain("<b>Дизайн-проект:</b> Проект &lt;кухня&gt;.pdf (3,2 МБ) — во вложении");
      const document = form.get("document") as File;
      expect(document.name).toBe("Проект <кухня>.pdf");
      expect(document.type).toBe("application/pdf");
      expect(new Uint8Array(await document.arrayBuffer())).toEqual(pdf);
    });

    it("keeps the caption within Telegram's 1024-character limit even for the longest form input", () => {
      const longest = {
        ...leadWithFile,
        name: "Я".repeat(80),
        phone: "9".repeat(40),
        service: "Р".repeat(120),
        attachment: { ...leadWithFile.attachment, fileName: `${"Ф".repeat(100)}.pdf` },
      };
      const caption = formatLeadMessage(longest, { attachment: pdf, delayedSince: "2026-10-04T12:00:00.000Z" });

      expect(caption.replace(/<[^>]+>/g, "").length).toBeLessThanOrEqual(1024);
    });

    it("tells the manager to ask for the file again when it could not be kept", async () => {
      const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

      await sendLeadToTelegram(leadWithFile, fetcher, { token: "secret-token", chatId: "-100123" });

      expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.telegram.org/botsecret-token/sendMessage");
      expect(JSON.parse(fetcher.mock.calls[0]?.[1].body).text).toContain("файл не сохранился, попросите клиента прислать его ещё раз");
    });

    it("fails the delivery when Telegram rejects the document, so the lead is retried with its file", async () => {
      const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 413, text: async () => "Request Entity Too Large" });

      await expect(sendLeadToTelegram(leadWithFile, fetcher, { token: "secret-token", chatId: "-100123" }, { attachment: pdf })).rejects.toThrow("413");
    });
  });

  it("does not mention a design project when none was attached", () => {
    expect(formatLeadMessage(sampleLead)).not.toContain("Дизайн-проект");
  });
});
