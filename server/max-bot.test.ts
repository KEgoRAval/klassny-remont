import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FORWARD_FAILED_TEXT, Inbox, MANAGER_TEXT, setCommands, MAX_SECRET_HEADER, QUESTION_TEXT, THANKS_TEXT, WELCOME_TEXT, handleUpdate, maxConfig, phoneFromVcf, registerMaxBotRoutes, replyButtons, resetMaxStatus, subscribeWebhook } from "./maxBot";

const env = {
  MAX_BOT_TOKEN: "tok_123",
  MAX_WEBHOOK_SECRET: "sec_456",
  MAX_BOT_USERNAME: "@klassny_bot",
  CANONICAL_ORIGIN: "https://krem.moscow/",
} as NodeJS.ProcessEnv;

type Call = { url: string; init: RequestInit };

function harness(now = { t: 1_000_000 }) {
  const replies: { userId: number; text: string; buttons?: unknown }[] = [];
  const forwarded: string[] = [];
  let telegramFails = false;
  const deps = {
    inbox: new Inbox(() => now.t),
    reply: async (userId: number, text: string, extra?: unknown) => { replies.push({ userId, text, buttons: extra }); },
    toTelegram: async (html: string) => { if (telegramFails) throw new Error("down"); forwarded.push(html); },
  };
  return { deps, replies, forwarded, now, failTelegram: () => { telegramFails = true; } };
}

const userMessage = (text: string, extra: Record<string, unknown> = {}) => ({
  update_type: "message_created",
  message: { sender: { user_id: 8, first_name: "Анна", last_name: "К.", username: "anna_k", is_bot: false }, recipient: { chat_type: "dialog" }, body: { text, ...extra } },
});
const contactMessage = (vcf: string, owner = 8) => userMessage("", { attachments: [{ type: "contact", payload: { vcf_info: vcf, max_info: { user_id: owner } } }] });
const VCF = "BEGIN:VCARD\nVERSION:3.0\nFN:Анна К.\nTEL;TYPE=cell:+7 (916) 123-45-67\nEND:VCARD";

describe("MAX bot replies", () => {
  it("greets on Start", async () => {
    const h = harness();
    await handleUpdate({ update_type: "bot_started", user: { user_id: 7, is_bot: false } }, h.deps);
    expect(h.replies).toEqual([{ userId: 7, text: WELCOME_TEXT, buttons: undefined }]);
  });

  it("offers to pass a question to the manager, once per 10 minutes", async () => {
    const h = harness();
    await handleUpdate(userMessage("Сколько стоит санузел 5 м²?"), h.deps);
    await handleUpdate(userMessage("И сроки?"), h.deps);
    expect(h.replies).toHaveLength(1);
    expect(h.replies[0].text).toBe(QUESTION_TEXT);
    expect(JSON.stringify(h.replies[0].buttons)).toContain("request_contact");
    h.now.t += 11 * 60 * 1000;
    await handleUpdate(userMessage("Алло?"), h.deps);
    expect(h.replies).toHaveLength(2);
  });

  it("sends the question with the shared phone to Telegram and thanks the user", async () => {
    const h = harness();
    await handleUpdate(userMessage("Сколько стоит санузел 5 м²?"), h.deps);
    await handleUpdate(userMessage("<b>и сроки</b>"), h.deps);
    await handleUpdate(contactMessage(VCF), h.deps);
    expect(h.forwarded).toHaveLength(1);
    expect(h.forwarded[0]).toContain("Вопрос из бота MAX");
    expect(h.forwarded[0]).toContain("Анна К. (@anna_k)");
    expect(h.forwarded[0]).toContain("+79161234567");
    expect(h.forwarded[0]).toContain("Сколько стоит санузел 5 м²?\n&lt;b&gt;и сроки&lt;/b&gt;");
    expect(h.replies.at(-1)?.text).toBe(THANKS_TEXT);
    // Sent once; a second contact without new messages is a plain call-back request.
    await handleUpdate(contactMessage(VCF), h.deps);
    expect(h.forwarded[1]).toContain("без текста");
  });

  it("does not forward someone else's contact", async () => {
    const h = harness();
    await handleUpdate(contactMessage(VCF, 99), h.deps);
    expect(h.forwarded).toHaveLength(0);
  });

  it("keeps the question and tells the user to call when Telegram is down", async () => {
    const h = harness();
    h.failTelegram();
    await handleUpdate(userMessage("Вопрос"), h.deps);
    await handleUpdate(contactMessage(VCF), h.deps);
    expect(h.replies.at(-1)?.text).toBe(FORWARD_FAILED_TEXT);
    expect(h.deps.inbox.texts(8)).toEqual(["Вопрос"]);
  });

  it("stays quiet for bots and group chats", async () => {
    const h = harness();
    await handleUpdate({ update_type: "bot_started", user: { user_id: 7, is_bot: true } }, h.deps);
    await handleUpdate({ update_type: "message_created", message: { sender: { user_id: 8 }, recipient: { chat_type: "chat" }, body: { text: "hi" } } }, h.deps);
    expect(h.replies).toHaveLength(0);
  });

  it("answers menu commands without storing them as questions", async () => {
    const h = harness();
    await handleUpdate(userMessage("/raschet"), h.deps);
    await handleUpdate(userMessage("/manager"), h.deps);
    await handleUpdate(userMessage("/start"), h.deps);
    expect(h.replies.map(r => r.text)).toEqual([WELCOME_TEXT, MANAGER_TEXT, WELCOME_TEXT]);
    expect(JSON.stringify(h.replies[1].buttons)).toContain("request_contact");
    expect(h.deps.inbox.texts(8)).toEqual([]);
  });

  it("sets the command menu", async () => {
    const calls: Call[] = [];
    const fetcher = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await setCommands(maxConfig(env)!, fetcher);
    expect(calls[0].url).toBe("https://platform-api2.max.ru/me/commands");
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0].init.body)).commands.map((c: { name: string }) => c.name)).toEqual(["raschet", "manager", "start"]);
  });

  it("reads the phone from a vCard", () => {
    expect(phoneFromVcf(VCF)).toBe("+79161234567");
    expect(phoneFromVcf("TEL:89161234567")).toBe("89161234567");
    expect(phoneFromVcf("FN:x")).toBeNull();
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
  registerMaxBotRoutes(app, env, fetcher, async () => {});
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
      update_types: ["bot_started", "message_created", "bot_added", "bot_removed"],
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
