import type { Express, Request, Response } from "express";

/**
 * MAX messenger bot: answers "Start" and any message with a short greeting and a button
 * that opens the /max mini-app. Without this the bot stays silent after "Start".
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

type MaxConfig = {
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
  | { type: "link"; text: string; url: string };

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

export const FOLLOW_UP_TEXT = [
  "Чтобы мы посчитали ремонт, откройте форму по кнопке ниже — там можно приложить дизайн-проект.",
  "",
  `Удобнее голосом — позвоните: ${PHONE}.`,
].join("\n");

export function messageBody(text: string, config: Pick<MaxConfig, "username" | "origin">) {
  return {
    text,
    attachments: [{ type: "inline_keyboard", payload: { buttons: replyButtons(config) } }],
  };
}

type MaxUser = { user_id?: number; is_bot?: boolean };
type MaxUpdate = {
  update_type?: string;
  user?: MaxUser;
  message?: { sender?: MaxUser | null; recipient?: { chat_type?: string } };
};

/** Which reply an update gets, and to whom. Ignores bots and anything outside a private dialog. */
export function replyFor(update: MaxUpdate): { userId: number; text: string } | null {
  if (update.update_type === "bot_started") {
    const user = update.user;
    if (!user?.user_id || user.is_bot) return null;
    return { userId: user.user_id, text: WELCOME_TEXT };
  }
  if (update.update_type === "message_created") {
    const sender = update.message?.sender;
    if (!sender?.user_id || sender.is_bot) return null;
    if (update.message?.recipient?.chat_type && update.message.recipient.chat_type !== "dialog") return null;
    return { userId: sender.user_id, text: FOLLOW_UP_TEXT };
  }
  return null;
}

async function callMax(config: MaxConfig, method: "GET" | "POST", path: string, body: unknown, fetcher: typeof fetch) {
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

export async function sendReply(config: MaxConfig, userId: number, text: string, fetcher: typeof fetch = fetch) {
  await callMax(config, "POST", `/messages?user_id=${encodeURIComponent(String(userId))}`, messageBody(text, config), fetcher);
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
      update_types: ["bot_started", "message_created"],
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

export function registerMaxBotRoutes(app: Express, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  const config = maxConfig(env);
  status.configured = Boolean(config);

  app.get("/api/max/status", (_req: Request, res: Response) => {
    res.set("Cache-Control", "no-store").json({ ...status, miniAppButton: Boolean(config?.username) });
  });

  app.post(MAX_WEBHOOK_PATH, (req: Request, res: Response) => {
    if (!config || req.get(MAX_SECRET_HEADER) !== config.secret) {
      res.status(401).end();
      return;
    }
    // MAX waits for a quick 200; the reply is sent afterwards.
    res.status(200).json({ ok: true });
    const reply = replyFor(req.body as MaxUpdate);
    if (!reply) return;
    sendReply(config, reply.userId, reply.text, fetcher)
      .then(() => { status.lastReplyAt = new Date().toISOString(); })
      .catch(error => {
        status.lastError = scrub(String(error instanceof Error ? error.message : error), config);
        console.error("[MAX] reply failed:", status.lastError);
      });
  });

  return config;
}

/** Called once the server listens: the webhook URL must already answer when MAX checks it. */
export function startMaxBot(config: MaxConfig | null, fetcher: typeof fetch = fetch) {
  if (!config) {
    console.log("[MAX] bot not configured (MAX_BOT_TOKEN / MAX_WEBHOOK_SECRET / CANONICAL_ORIGIN)");
    return;
  }
  void subscribeWebhook(config, fetcher);
}

/** For tests. */
export function resetMaxStatus() {
  Object.assign(status, { configured: false, subscribed: false, lastError: null, lastReplyAt: null });
}
