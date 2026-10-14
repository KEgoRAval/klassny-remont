import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FOLLOW_UP_TEXT, MAX_SECRET_HEADER, WELCOME_TEXT, maxConfig, registerMaxBotRoutes, replyButtons, replyFor, resetMaxStatus, subscribeWebhook } from "./maxBot";

const env = {
  MAX_BOT_TOKEN: "tok_123",
  MAX_WEBHOOK_SECRET: "sec_456",
  MAX_BOT_USERNAME: "@klassny_bot",
  CANONICAL_ORIGIN: "https://krem.moscow/",
} as NodeJS.ProcessEnv;

type Call = { url: string; init: RequestInit };

describe("MAX bot replies", () => {
  it("greets on Start and answers a user's message with the mini-app button", () => {
    expect(replyFor({ update_type: "bot_started", user: { user_id: 7, is_bot: false } })).toEqual({ userId: 7, text: WELCOME_TEXT });
    expect(replyFor({ update_type: "message_created", message: { sender: { user_id: 8, is_bot: false }, recipient: { chat_type: "dialog" } } })).toEqual({ userId: 8, text: FOLLOW_UP_TEXT });
  });

  it("stays quiet for bots, group chats and other updates", () => {
    expect(replyFor({ update_type: "bot_started", user: { user_id: 7, is_bot: true } })).toBeNull();
    expect(replyFor({ update_type: "message_created", message: { sender: { user_id: 8 }, recipient: { chat_type: "chat" } } })).toBeNull();
    expect(replyFor({ update_type: "message_removed" })).toBeNull();
  });

  it("opens the mini-app inside MAX and keeps a browser link", () => {
    const config = maxConfig(env)!;
    expect(config.origin).toBe("https://krem.moscow");
    expect(replyButtons(config)).toEqual([
      [{ type: "open_app", text: "Рассчитать ремонт", web_app: "klassny_bot" }],
      [{ type: "link", text: "Открыть в браузере", url: "https://krem.moscow/max?utm_source=max_bot" }],
    ]);
    expect(replyButtons({ ...config, username: "" })).toEqual([[{ type: "link", text: "Рассчитать ремонт", url: "https://krem.moscow/max?utm_source=max_bot" }]]);
  });

  it("is off until token, secret and origin are all set", () => {
    expect(maxConfig({ ...env, MAX_BOT_TOKEN: "" })).toBeNull();
    expect(maxConfig({ ...env, MAX_WEBHOOK_SECRET: undefined })).toBeNull();
  });
});

describe("MAX webhook endpoint", () => {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as unknown as typeof fetch;
  const app = express();
  app.use(express.json());
  registerMaxBotRoutes(app, env, fetcher);
  let origin = "";
  let close = () => {};

  beforeAll(async () => {
    await new Promise<void>(done => {
      const server = app.listen(0, "127.0.0.1", () => {
        origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        close = () => server.close();
        done();
      });
    });
  });
  afterAll(() => close());
  beforeEach(() => { calls.length = 0; });

  const post = (body: unknown, secret?: string) =>
    fetch(`${origin}/api/max/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { [MAX_SECRET_HEADER]: secret } : {}) },
      body: JSON.stringify(body),
    });

  it("rejects updates without the right secret", async () => {
    expect((await post({ update_type: "bot_started", user: { user_id: 1 } })).status).toBe(401);
    expect((await post({ update_type: "bot_started", user: { user_id: 1 } }, "wrong")).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("sends the greeting with the token in the Authorization header", async () => {
    expect((await post({ update_type: "bot_started", user: { user_id: 42, is_bot: false } }, "sec_456")).status).toBe(200);
    await new Promise(r => setTimeout(r, 50));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://platform-api2.max.ru/messages?user_id=42");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("tok_123");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.text).toBe(WELCOME_TEXT);
    expect(body.attachments[0].type).toBe("inline_keyboard");
  });

  it("reports status without secrets", async () => {
    const text = await fetch(`${origin}/api/max/status`).then(r => r.text());
    expect(JSON.parse(text)).toMatchObject({ configured: true, miniAppButton: true });
    expect(text).not.toContain("tok_123");
    expect(text).not.toContain("sec_456");
  });
});

describe("MAX webhook subscription", () => {
  beforeEach(() => resetMaxStatus());

  it("subscribes the site's webhook URL for Start and messages", async () => {
    const calls: Call[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await subscribeWebhook(maxConfig(env)!, fetcher);
    expect(calls[0].url).toBe("https://platform-api2.max.ru/subscriptions");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      url: "https://krem.moscow/api/max/webhook",
      update_types: ["bot_started", "message_created"],
      secret: "sec_456",
    });
  });

  it("keeps the token out of a reported error", async () => {
    const app = express();
    const fetcher = (async () => new Response("bad token tok_123", { status: 401 })) as unknown as typeof fetch;
    const config = registerMaxBotRoutes(app, env, fetcher)!;
    await subscribeWebhook(config, fetcher);
    const server = app.listen(0, "127.0.0.1");
    await new Promise(r => server.once("listening", r));
    const text = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/max/status`).then(r => r.text());
    server.close();
    expect(JSON.parse(text).subscribed).toBe(false);
    expect(text).toContain("[token]");
    expect(text).not.toContain("tok_123");
  });
});
