import { describe, expect, it } from "vitest";

describe("Telegram bot credentials", () => {
  it("authenticates with Telegram getMe", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    expect(token, "TELEGRAM_BOT_TOKEN must be configured").toBeTruthy();
    expect(chatId, "TELEGRAM_CHAT_ID must be configured").toBe("-1003381799698");

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { is_bot?: boolean };
    };

    expect(response.ok).toBe(true);
    expect(payload.ok).toBe(true);
    expect(payload.result?.is_bot).toBe(true);
  }, 15_000);
});
