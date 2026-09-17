import { describe, expect, it } from "vitest";
import { sendLeadToTelegram } from "./telegram";

describe.skip("Telegram group delivery", () => {
  it("delivers a labeled integration check to the configured chat", async () => {
    await expect(
      sendLeadToTelegram({
        name: "Тест интеграции",
        phone: "—",
        service: "Проверка подключения сайта",
        area: 100,
        materialLabel: "Рациональный",
        workEstimate: 4_000_000,
        materialsEstimate: 2_200_000,
        totalEstimate: 6_200_000,
        source: "contact",
      }),
    ).resolves.toBeUndefined();
  }, 15_000);
});
