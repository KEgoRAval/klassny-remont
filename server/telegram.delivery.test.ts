import { describe, expect, it } from "vitest";
import { sendLeadToTelegram } from "./telegram";

describe("Telegram group delivery", () => {
  it("delivers a labeled integration check to the configured chat", async () => {
    await expect(
      sendLeadToTelegram({
        name: "Тест интеграции",
        phone: "—",
        service: "Проверка подключения сайта",
        area: 100,
        materialLabel: "Премиум",
        workEstimate: 4_000_000,
        materialsEstimate: 5_000_000,
        totalEstimate: 9_000_000,
        source: "contact",
      }),
    ).resolves.toBeUndefined();
  }, 15_000);
});
