import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Inbox, handleUpdate, maxConfig, publishToChannel } from "./maxBot";
import { ChannelStore, POST_HELP, parsePostCommand, reusableMedia } from "./maxChannel";

const env = { MAX_BOT_TOKEN: "tok", MAX_WEBHOOK_SECRET: "sec_1", MAX_BOT_USERNAME: "klassny_bot", CANONICAL_ORIGIN: "https://krem.moscow" } as NodeJS.ProcessEnv;

describe("MAX channel posts", () => {
  let dir = "";
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "max-channel-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function harness() {
    const replies: string[] = [];
    const telegram: string[] = [];
    const published: { chatId: number; text: string; media: unknown[]; pin: boolean }[] = [];
    const channels = new ChannelStore(path.join(dir, "max-channels.json"));
    const deps = {
      inbox: new Inbox(),
      channels,
      reply: async (_u: number, text: string) => { replies.push(text); },
      toTelegram: async (html: string) => { telegram.push(html); },
      publish: async (chatId: number, text: string, media: unknown[], pin: boolean) => { published.push({ chatId, text, media, pin }); },
      channelTitle: async () => "Классный ремонт",
    };
    return { deps, replies, telegram, published, channels };
  }

  const ownerMessage = (text: string, attachments: unknown[] = [], userId = 7) => ({
    update_type: "message_created",
    message: { sender: { user_id: userId, first_name: "Егор", is_bot: false }, recipient: { chat_type: "dialog" }, body: { text, attachments } },
  });

  it("remembers the channel and who added the bot", async () => {
    const h = harness();
    await handleUpdate({ update_type: "bot_added", chat_id: -100, is_channel: true, user: { user_id: 7, first_name: "Егор" } }, h.deps);
    expect(h.channels.list()).toMatchObject([{ chatId: -100, ownerUserId: 7, title: "Классный ремонт" }]);
    expect(h.replies).toEqual([POST_HELP]);
    expect(h.telegram[0]).toContain("добавлен администратором канала «Классный ремонт»");
  });

  it("publishes the owner's /post with photos and video, and pins /postpin", async () => {
    const h = harness();
    h.channels.add({ chatId: -100, ownerUserId: 7, addedAt: "" });
    const media = [{ type: "video", payload: { token: "v1", url: "x" } }, { type: "image", payload: { token: "p1", url: "y" } }, { type: "file", payload: { token: "f1" } }];
    await handleUpdate(ownerMessage("/postpin Готовая кухня в ЖК Very", media), h.deps);
    expect(h.published).toEqual([{ chatId: -100, text: "Готовая кухня в ЖК Very", media: [{ type: "video", payload: { token: "v1" } }, { type: "image", payload: { token: "p1" } }], pin: true }]);
    expect(h.replies.at(-1)).toContain("закреплено");
  });

  it("does not let anyone else publish", async () => {
    const h = harness();
    h.channels.add({ chatId: -100, ownerUserId: 7, addedAt: "" });
    await handleUpdate(ownerMessage("/post реклама", [], 99), h.deps);
    expect(h.published).toHaveLength(0);
  });

  it("forgets a channel the bot was removed from", async () => {
    const h = harness();
    h.channels.add({ chatId: -100, ownerUserId: 7, addedAt: "" });
    await handleUpdate({ update_type: "bot_removed", chat_id: -100 }, h.deps);
    expect(h.channels.list()).toEqual([]);
  });

  it("parses commands", () => {
    expect(parsePostCommand("/post")).toEqual({ pin: false, text: "" });
    expect(parsePostCommand("/postpin  привет\nмир")).toEqual({ pin: true, text: "привет\nмир" });
    expect(parsePostCommand("post")).toBeNull();
    expect(parsePostCommand("/poster")).toBeNull();
    expect(reusableMedia([{ type: "sticker", payload: { token: "s" } }])).toEqual([]);
  });

  it("falls back to a link button when MAX refuses the mini-app button, and pins by message id", async () => {
    const calls: { url: string; method?: string; body: string }[] = [];
    let first = true;
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method, body: String(init.body) });
      if (url.includes("/messages") && first) { first = false; return new Response("button.not.allowed", { status: 400 }); }
      return new Response(JSON.stringify({ message: { body: { mid: "m1" } } }), { status: 200 });
    }) as unknown as typeof fetch;
    await publishToChannel(maxConfig(env)!, -100, "Текст", [], true, fetcher, async () => {});
    expect(calls[0].body).toContain("open_app");
    expect(calls[1].body).toContain('"type":"link"');
    expect(calls[1].body).toContain("utm_source=max_channel");
    expect(calls[2]).toMatchObject({ url: "https://platform-api2.max.ru/chats/-100/pin", method: "PUT" });
  });
});
