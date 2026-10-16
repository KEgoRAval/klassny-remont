import type { Express, Request, Response } from "express";
import { escapeHtml, sendTextToTelegram } from "./telegram";
import { ChannelStore, POST_HELP, parsePostCommand, reusableMedia } from "./maxChannel";

/**
 * MAX messenger bot: answers "Start" with a greeting and a button that opens the /max mini-app.
 * A text message gets a "Передать менеджеру" button; pressing it shares the user's phone, and
 * the question with that phone is sent to the operator's Telegram (the button press is the
 * consent, described in the privacy policy, section #max).
 *
 * Configured from the server environment (deployment/shared/.env):
 *   MAX_BOT_TOKEN       token from business.max.ru → the bot → Интеграция
 *   MAX_WEBHOOK_SECRET  any 5–256 chars of A-Z a-z 0-9 _ - ; MAX sends it back with every update
 *   MAX_BOT_USERNAME    the bot's public nick; enables the "open mini-app" button
 *   CANONICAL_ORIGIN    https://krem.moscow (already set for the sitemap)
 * Optional: MAX_API_BASE (default https://platform-api2.max.ru).
 *
 * With the token and secret set, the server subscribes the webhook on start.
 * GET /api/max/status shows whether that worked, without exposing any secret.
 */

export const MAX_WEBHOOK_PATH = "/api/max/webhook";
export const MAX_SECRET_HEADER = "x-max-bot-api-secret";
const MINI_APP_PATH = "/max?utm_source=max_bot";
const PHONE = "8 (977) 948‑06‑72";

export type MaxConfig = {
  token: string;
  secret: string;
  username: string;
  origin: string;
  apiBase: string;
};

export function maxConfig(env: NodeJS.ProcessEnv = process.env): MaxConfig | null {
  const token = env.MAX_BOT_TOKEN?.trim() ?? "";
  const secret = env.MAX_WEBHOOK_SECRET?.trim() ?? "";
  const origin = (env.CANONICAL_ORIGIN ?? "").trim().replace(/\/+$/, "");
  if (!token || !secret || !origin) return null;
  return {
    token,
    secret,
    username: (env.MAX_BOT_USERNAME ?? "").trim().replace(/^@/, ""),
    origin,
    apiBase: (env.MAX_API_BASE ?? "https://platform-api2.max.ru").trim().replace(/\/+$/, ""),
  };
}

type Button =
  | { type: "open_app"; text: string; web_app: string }
  | { type: "link"; text: string; url: string }
  | { type: "request_contact"; text: string };

export function replyButtons(config: Pick<MaxConfig, "username" | "origin">): Button[][] {
  const url = `${config.origin}${MINI_APP_PATH}`;
  // The mini-app opens inside MAX; the link is the fallback when the nick is not configured.
  return config.username
    ? [[{ type: "open_app", text: "Рассчитать ремонт", web_app: config.username }], [{ type: "link", text: "Открыть в браузере", url }]]
    : [[{ type: "link", text: "Рассчитать ремонт", url }]];
}

export const WELCOME_TEXT = [
  "Здравствуйте! Это «Классный ремонт» — ремонт квартир под ключ в Москве.",
  "",
  "Пришлите дизайн-проект — сделаем смету за 2 часа в рабочее время, бесплатно. Нет проекта — ответьте на 3 вопроса и узнайте ориентир по стоимости работ.",
  "",
  "Нажмите кнопку ниже 👇",
].join("\n");

export const QUESTION_TEXT = [
  "Получили ваше сообщение. Чтобы менеджер ответил, нажмите «Передать менеджеру» — мы получим ваш вопрос и номер телефона и перезвоним в рабочее время.",
  "",
  "Нажимая кнопку, вы соглашаетесь на обработку имени, телефона и текста сообщения и их передачу оператору через Telegram: krem.moscow/privacy-policy#max",
  "",
  "Или сразу посчитайте ремонт по кнопке ниже.",
].join("\n");

export const MANAGER_TEXT = [
  "Нажмите «Передать менеджеру» — мы получим ваш номер и перезвоним в рабочее время. Можно сначала написать вопрос сообщением.",
  "",
  "Нажимая кнопку, вы соглашаетесь на обработку имени, телефона и текста сообщения и их передачу оператору через Telegram: krem.moscow/privacy-policy#max",
].join("\n");

/** The command menu MAX shows next to the message field. */
export const BOT_COMMANDS = [
  { name: "raschet", description: "Рассчитать ремонт" },
  { name: "manager", description: "Связаться с менеджером" },
  { name: "start", description: "Начать сначала" },
];

export const THANKS_TEXT = `Спасибо! Передали ваш вопрос менеджеру — перезвоним в рабочее время. Срочно — звоните: ${PHONE}.`;
export const FORWARD_FAILED_TEXT = `Не получилось передать сообщение. Пожалуйста, позвоните: ${PHONE}.`;

const CONTACT_BUTTON: Button = { type: "request_contact", text: "Передать менеджеру" };

export function messageBody(text: string, config: Pick<MaxConfig, "username" | "origin">, extra: Button[][] = []) {
  return {
    text,
    attachments: [{ type: "inline_keyboard", payload: { buttons: [...extra, ...replyButtons(config)] } }],
  };
}

type MaxUser = { user_id?: number; is_bot?: boolean; first_name?: string; last_name?: string | null; username?: string | null };
type MaxAttachment = { type?: string; payload?: { vcf_info?: string | null; max_info?: MaxUser | null; token?: string } };
type MaxUpdate = {
  update_type?: string;
  user?: MaxUser;
  chat_id?: number;
  is_channel?: boolean;
  message?: {
    sender?: MaxUser | null;
    recipient?: { chat_type?: string };
    body?: { text?: string | null; attachments?: MaxAttachment[] | null };
  };
};

/** Phone from a shared contact's vCard: the first TEL line, digits and a leading + kept. */
export function phoneFromVcf(vcf: string | null | undefined): string | null {
  const line = vcf?.split(/\r?\n/).find(row => /^TEL[;:]/i.test(row));
  const raw = line?.slice(line.lastIndexOf(":") + 1).trim() ?? "";
  const phone = raw.replace(/[^\d+]/g, "");
  return phone.replace(/\D/g, "").length >= 10 ? phone : null;
}

const fullName = (user: MaxUser) => [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Без имени";

export function formatQuestion(user: MaxUser, phone: string, texts: string[]): string {
  const handle = user.username ? ` (@${escapeHtml(user.username)})` : "";
  const body = texts.length
    ? escapeHtml(texts.join("\n")).slice(0, 3000)
    : "<i>без текста — просит перезвонить</i>";
  return [
    "💬 <b>Вопрос из бота MAX</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(fullName(user))}${handle}`,
    `<b>Телефон:</b> ${escapeHtml(phone)}`,
    "",
    "<b>Сообщение:</b>",
    body,
  ].join("\n");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HINT_EVERY_MS = 10 * 60 * 1000;
const MAX_TEXTS = 5;
const MAX_TEXT_LENGTH = 1000;
const MAX_USERS = 5000;

/** Recent messages per user, waiting for the user to share a phone. Kept in memory for a day. */
export class Inbox {
  private entries = new Map<number, { texts: string[]; updatedAt: number; hintAt: number }>();
  constructor(private now: () => number = Date.now) {}

  private entry(userId: number) {
    const now = this.now();
    this.entries.forEach((item, id) => { if (now - item.updatedAt > DAY_MS) this.entries.delete(id); });
    let item = this.entries.get(userId);
    if (!item) {
      if (this.entries.size >= MAX_USERS) this.entries.delete(this.entries.keys().next().value!);
      item = { texts: [], updatedAt: now, hintAt: 0 };
      this.entries.set(userId, item);
    }
    item.updatedAt = now;
    return item;
  }

  /** Stores a message; true when the user should get the "Передать менеджеру" hint now. */
  add(userId: number, text: string): boolean {
    const item = this.entry(userId);
    item.texts = [...item.texts, text.slice(0, MAX_TEXT_LENGTH)].slice(-MAX_TEXTS);
    if (this.now() - item.hintAt < HINT_EVERY_MS) return false;
    item.hintAt = this.now();
    return true;
  }

  texts(userId: number): string[] {
    return this.entries.get(userId)?.texts ?? [];
  }

  clear(userId: number) {
    this.entries.delete(userId);
  }
}

type Deps = {
  reply: (userId: number, text: string, extra?: Button[][]) => Promise<void>;
  toTelegram: (html: string) => Promise<void>;
  inbox: Inbox;
  channels?: ChannelStore;
  /** Publishes a post to a channel; returns the new message id when MAX gives one. */
  publish?: (chatId: number, text: string, media: { type: "image" | "video"; payload: { token: string } }[], pin: boolean) => Promise<PublishResult>;
  channelTitle?: (chatId: number) => Promise<string | undefined>;
  now?: () => number;
};

const ATTACHMENT_LABELS: Record<string, string> = { image: "фото", video: "видео", audio: "аудио", file: "файл", sticker: "стикер", location: "геопозиция" };

/** Reacts to one update. Ignores bots and anything outside a private dialog. */
export async function handleUpdate(update: MaxUpdate, deps: Deps): Promise<void> {
  if (update.update_type === "bot_added" && update.is_channel && update.chat_id && update.user?.user_id && deps.channels) {
    const title = await deps.channelTitle?.(update.chat_id).catch(() => undefined);
    deps.channels.add({ chatId: update.chat_id, ownerUserId: update.user.user_id, title, addedAt: new Date(deps.now?.() ?? Date.now()).toISOString() });
    await deps.toTelegram(`📣 Бот MAX добавлен администратором канала${title ? ` «${escapeHtml(title)}»` : ""}. Публиковать посты с кнопкой может ${escapeHtml(fullName(update.user))} — через сообщение боту с /post.`).catch(() => {});
    await deps.reply(update.user.user_id, POST_HELP).catch(() => {});
    return;
  }
  if (update.update_type === "bot_removed" && update.chat_id && deps.channels) {
    deps.channels.remove(update.chat_id);
    return;
  }
  if (update.update_type === "bot_started") {
    const user = update.user;
    if (!user?.user_id || user.is_bot) return;
    await deps.reply(user.user_id, WELCOME_TEXT);
    return;
  }
  if (update.update_type !== "message_created") return;
  const sender = update.message?.sender;
  if (!sender?.user_id || sender.is_bot) return;
  const chatType = update.message?.recipient?.chat_type;
  if (chatType && chatType !== "dialog") return;
  const userId = sender.user_id;
  const attachments = update.message?.body?.attachments ?? [];

  const contact = attachments.find(item => item.type === "contact");
  if (contact) {
    const owner = contact.payload?.max_info?.user_id;
    const phone = phoneFromVcf(contact.payload?.vcf_info);
    // Only the user's own contact, shared with the button, counts as their phone.
    if (!phone || (owner && owner !== userId)) {
      await deps.reply(userId, `Не удалось получить номер. Нажмите «Передать менеджеру» ещё раз или позвоните: ${PHONE}.`, [[CONTACT_BUTTON]]);
      return;
    }
    try {
      await deps.toTelegram(formatQuestion(sender, phone, deps.inbox.texts(userId)));
    } catch (error) {
      console.error("[MAX] question not delivered to Telegram:", error instanceof Error ? error.message : error);
      await deps.reply(userId, FORWARD_FAILED_TEXT);
      return;
    }
    deps.inbox.clear(userId);
    await deps.reply(userId, THANKS_TEXT);
    return;
  }

  const text = update.message?.body?.text?.trim();
  const post = parsePostCommand(text);
  if (post && deps.channels && deps.publish) {
    const owned = deps.channels.ownedBy(userId);
    if (owned.length) {
      const media = reusableMedia(attachments);
      if (!post.text && !media.length) {
        await deps.reply(userId, POST_HELP);
        return;
      }
      for (const channel of owned) {
        const name = channel.title ? ` «${channel.title}»` : "";
        let result: PublishResult;
        try {
          result = await deps.publish(channel.chatId, post.text, media, post.pin);
        } catch (error) {
          await deps.reply(userId, `Не получилось опубликовать в канал${name}: ${error instanceof Error ? error.message.slice(0, 200) : "ошибка"}`);
          return;
        }
        if (post.pin && !result.pinned) {
          await deps.reply(userId, `Опубликовано в канал${name} ✅, но закрепить не получилось — у бота нет права закреплять сообщения. Закрепите пост вручную или дайте боту это право и в следующий раз используйте /postpin.`);
        } else {
          await deps.reply(userId, `Опубликовано${result.pinned ? " и закреплено" : ""} в канал${name} ✅`);
        }
      }
      return;
    }
  }
  const command = text?.match(/^\/([a-z_]+)(?:@\S+)?$/i)?.[1]?.toLowerCase();
  if (command) {
    if (command === "manager") {
      await deps.reply(userId, MANAGER_TEXT, [[CONTACT_BUTTON]]);
    } else {
      // /start, /raschet and anything unknown: the greeting with the mini-app button.
      await deps.reply(userId, WELCOME_TEXT);
    }
    return;
  }
  const extras = attachments
    .filter(item => item.type && item.type !== "inline_keyboard")
    .map(item => `[${ATTACHMENT_LABELS[item.type!] ?? "вложение"}]`);
  const note = [text, ...extras].filter(Boolean).join(" ");
  if (!note) return;
  if (deps.inbox.add(userId, note)) await deps.reply(userId, QUESTION_TEXT, [[CONTACT_BUTTON]]);
}

async function callMax(config: MaxConfig, method: "GET" | "POST" | "PATCH" | "PUT", path: string, body: unknown, fetcher: typeof fetch) {
  const response = await fetcher(`${config.apiBase}${path}`, {
    method,
    headers: { Authorization: config.token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`MAX ${method} ${path.split("?")[0]} failed: ${response.status} ${detail}`.slice(0, 300));
  }
  return response.json().catch(() => ({}));
}

/**
 * Sends a file to a user: get an upload URL, upload the bytes, then send a message with the token.
 * MAX may answer "attachment.not.ready" right after an upload; that is retried a few times.
 */
export async function sendMaxFile(
  config: MaxConfig,
  userId: number,
  bytes: Uint8Array,
  fileName: string,
  text: string,
  fetcher: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<void> {
  const endpoint = (await callMax(config, "POST", "/uploads?type=file", undefined, fetcher)) as { url?: string };
  if (!endpoint.url) throw new Error("MAX returned no upload URL");
  const form = new FormData();
  form.append("data", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), fileName);
  const uploaded = await fetcher(endpoint.url, { method: "POST", headers: { Authorization: config.token }, body: form, signal: AbortSignal.timeout(60_000) });
  if (!uploaded.ok) throw new Error(`MAX upload failed: ${uploaded.status}`);
  const info = (await uploaded.json().catch(() => ({}))) as { token?: string };
  if (!info.token) throw new Error("MAX upload returned no token");
  const body = { text, attachments: [{ type: "file", payload: { token: info.token } }] };
  for (let attempt = 1; ; attempt++) {
    try {
      await callMax(config, "POST", `/messages?user_id=${encodeURIComponent(String(userId))}`, body, fetcher);
      return;
    } catch (error) {
      const notReady = error instanceof Error && error.message.includes("attachment.not.ready");
      if (!notReady || attempt >= 5) throw error;
      await wait(2_000 * attempt);
    }
  }
}

export async function sendReply(config: MaxConfig, userId: number, text: string, fetcher: typeof fetch = fetch, extra: Button[][] = []) {
  await callMax(config, "POST", `/messages?user_id=${encodeURIComponent(String(userId))}`, messageBody(text, config, extra), fetcher);
}

const status: { configured: boolean; subscribed: boolean; lastError: string | null; lastReplyAt: string | null } = {
  configured: false,
  subscribed: false,
  lastError: null,
  lastReplyAt: null,
};

/** Errors may quote the API's answer; strip anything that looks like the token before showing them. */
const scrub = (message: string, config: MaxConfig) => message.split(config.token).join("[token]").split(config.secret).join("[secret]");

export async function subscribeWebhook(config: MaxConfig, fetcher: typeof fetch = fetch): Promise<void> {
  try {
    await callMax(config, "POST", "/subscriptions", {
      url: `${config.origin}${MAX_WEBHOOK_PATH}`,
      update_types: ["bot_started", "message_created", "bot_added", "bot_removed"],
      secret: config.secret,
    }, fetcher);
    status.subscribed = true;
    status.lastError = null;
    console.log("[MAX] webhook subscribed");
  } catch (error) {
    status.subscribed = false;
    status.lastError = scrub(String(error instanceof Error ? error.message : error), config);
    console.error("[MAX] webhook subscription failed:", status.lastError);
  }
}

export function registerMaxBotRoutes(
  app: Express,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
  toTelegram: (html: string) => Promise<void> = html => sendTextToTelegram(html),
  channels?: ChannelStore,
) {
  const config = maxConfig(env);
  status.configured = Boolean(config);
  const inbox = new Inbox();

  app.get("/api/max/status", (_req: Request, res: Response) => {
    res.set("Cache-Control", "no-store").json({ ...status, miniAppButton: Boolean(config?.username), channels: channels?.list().length ?? 0 });
  });

  app.post(MAX_WEBHOOK_PATH, (req: Request, res: Response) => {
    if (!config || req.get(MAX_SECRET_HEADER) !== config.secret) {
      res.status(401).end();
      return;
    }
    // MAX waits for a quick 200; the reply is sent afterwards.
    res.status(200).json({ ok: true });
    const deps: Deps = {
      inbox,
      toTelegram,
      channels,
      publish: (chatId, text, media, pin) => publishToChannel(config, chatId, text, media, pin, fetcher),
      channelTitle: async chatId => ((await callMax(config, "GET", `/chats/${chatId}`, undefined, fetcher)) as { title?: string }).title,
      reply: async (userId, text, extra) => {
        await sendReply(config, userId, text, fetcher, extra);
        status.lastReplyAt = new Date().toISOString();
      },
    };
    handleUpdate(req.body as MaxUpdate, deps).catch(error => {
      status.lastError = scrub(String(error instanceof Error ? error.message : error), config);
      console.error("[MAX] update failed:", status.lastError);
    });
  });

  return config;
}

export type PublishResult = { pinned: boolean; button: "open_app" | "link" };

/** Where the channel button leads: the mini-app inside MAX when the bot's nick is known. */
export function channelButtonUrl(config: Pick<MaxConfig, "username" | "origin">): string {
  return config.username
    ? `https://max.ru/${encodeURIComponent(config.username)}?startapp=channel`
    : `${config.origin}/max?utm_source=max_channel`;
}

/**
 * Posts to a channel with a "Рассчитать ремонт" button. MAX does not accept open_app buttons in
 * channels, so the button is a link: the bot's mini-app deep link (max.ru/<bot>?startapp=…),
 * which MAX opens as the mini-app inside the messenger; the site page only when the bot's nick
 * is not configured. A fresh video may need a moment.
 */
export async function publishToChannel(
  config: MaxConfig,
  chatId: number,
  text: string,
  media: { type: "image" | "video"; payload: { token: string } }[],
  pin: boolean,
  fetcher: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<PublishResult> {
  const keyboards: Button[][][] = [[[{ type: "link", text: "Рассчитать ремонт", url: channelButtonUrl(config) }]]];
  let lastError: unknown;
  for (const buttons of keyboards) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const result = (await callMax(config, "POST", `/messages?chat_id=${encodeURIComponent(String(chatId))}`, {
          text: text || null,
          attachments: [...media, { type: "inline_keyboard", payload: { buttons } }],
        }, fetcher)) as { message?: { body?: { mid?: string } } };
        const mid = result.message?.body?.mid;
        const button = buttons[0][0].type === "open_app" ? "open_app" : "link";
        // The post is out; a failed pin must not make it look unpublished (a retry would post it twice).
        let pinned = false;
        if (pin && mid) {
          try {
            await callMax(config, "PUT", `/chats/${chatId}/pin`, { message_id: mid, notify: false }, fetcher);
            pinned = true;
          } catch (error) {
            console.error("[MAX] pin failed:", scrub(error instanceof Error ? error.message : String(error), config));
          }
        }
        return { pinned, button };
      } catch (error) {
        lastError = error;
        const notReady = error instanceof Error && error.message.includes("attachment.not.ready");
        if (!notReady) break;
        await wait(2_000 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? new Error(scrub(lastError.message, config)) : new Error("публикация не удалась");
}

/** Called once the server listens: the webhook URL must already answer when MAX checks it. */
export function startMaxBot(config: MaxConfig | null, fetcher: typeof fetch = fetch) {
  if (!config) {
    console.log("[MAX] bot not configured (MAX_BOT_TOKEN / MAX_WEBHOOK_SECRET / CANONICAL_ORIGIN)");
    return;
  }
  void subscribeWebhook(config, fetcher);
  void setCommands(config, fetcher);
}

export async function setCommands(config: MaxConfig, fetcher: typeof fetch = fetch): Promise<void> {
  try {
    await callMax(config, "PATCH", "/me/commands", { commands: BOT_COMMANDS }, fetcher);
    console.log("[MAX] commands set");
  } catch (error) {
    console.error("[MAX] commands not set:", scrub(String(error instanceof Error ? error.message : error), config));
  }
}

/** For tests. */
export function resetMaxStatus() {
  Object.assign(status, { configured: false, subscribed: false, lastError: null, lastReplyAt: null });
}
