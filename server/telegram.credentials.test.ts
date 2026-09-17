import { describe, expect, it } from "vitest";

const itLive = process.env.RUN_EXTERNAL_TELEGRAM_TESTS === "true" ? it : it.skip;

describe("Telegram bot credentials", () => {
  it("keeps configured delivery credentials available to the application", () => {
    expect(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN must be configured").toBeTruthy();
    expect(process.env.TELEGRAM_CHAT_ID, "TELEGRAM_CHAT_ID must be configured").toBe("-1003381799698");
  });

  itLive("authenticates with Telegram getMe when external checks are enabled", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
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
