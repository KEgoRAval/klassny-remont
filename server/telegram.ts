import type { LeadAttachment } from "./leadAttachments";

export type LeadNotification = {
  name: string;
  phone: string;
  service: string;
  area: number;
  materialLabel: string;
  /** The calculator estimates the cost of work only; materials go into the estimate as a separate line. */
  workEstimate: number;
  source: "calculator" | "contact";
  /** The MAX mini-app marks its leads; the site's own forms leave this out. */
  channel?: "site" | "max";
  personalDataConsent: true;
  telegramConsent: true;
  consentVersion: "2026-09-17" | "2026-10-04" | "2026-10-10";
  policyVersion: "2026-09-17" | "2026-10-04" | "2026-10-10";
  /** A design project the client attached to the contact form. */
  attachment?: LeadAttachment;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatRubles = (amount: number) => `${amount.toLocaleString("ru-RU")} ₽`;

const formatMegabytes = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} МБ`;

export type LeadDeliveryOptions = {
  /** ISO time the lead was received, set when it is delivered by a later retry. */
  delayedSince?: string;
  /** Bytes of lead.attachment. Absent when the file could not be kept; the message then says so. */
  attachment?: Uint8Array;
};

const TELEGRAM_TIMEOUT_MS = 10_000;
/** Uploading a design project of up to 20 MB takes longer than a text message. */
const TELEGRAM_UPLOAD_TIMEOUT_MS = 90_000;
/** Telegram's limit for a document caption, counted after HTML entities are parsed. */
const TELEGRAM_CAPTION_LIMIT = 1024;

const formatMoscowTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function formatLeadMessage(lead: LeadNotification, options: LeadDeliveryOptions = {}): string {
  const form = lead.source === "calculator" ? "Калькулятор" : "Контактная форма";
  const fromMax = lead.channel === "max";
  const source = fromMax ? `MAX · ${lead.source === "calculator" ? "предварительный расчёт" : "смета по дизайн-проекту"}` : form;
  const delayNote = options.delayedSince
    ? [`⚠️ <b>Доставлено с задержкой.</b> Заявка получена ${formatMoscowTime(options.delayedSince)} (МСК)`, ""]
    : [];

  return [
    "<b>Новая заявка — Классный Ремонт</b>",
    "",
    ...delayNote,
    `<b>Источник:</b> ${source}`,
    `<b>Клиент:</b> ${escapeHtml(lead.name)}`,
    `<b>Телефон:</b> ${escapeHtml(lead.phone)}`,
    `<b>Запрос:</b> ${escapeHtml(lead.service)}`,
    "",
    "<b>Параметры расчёта</b>",
    `<b>Площадь:</b> ${lead.area} м²`,
    `<b>${fromMax ? "Квартира" : "Уровень ремонта"}:</b> ${escapeHtml(lead.materialLabel)}`,
    `<b>Работы:</b> от ${formatRubles(lead.workEstimate)}`,
    ...attachmentLines(lead, options),
    "",
    `<b>Согласия:</b> обработка ПД и передача в Telegram — получены (${lead.consentVersion})`,
  ].join("\n");
}

function attachmentLines(lead: LeadNotification, options: LeadDeliveryOptions): string[] {
  if (!lead.attachment) return [];
  const file = `${escapeHtml(lead.attachment.fileName)} (${formatMegabytes(lead.attachment.size)})`;
  if (options.attachment) return ["", `<b>Дизайн-проект:</b> ${file} — во вложении`];
  return ["", `<b>Дизайн-проект:</b> ${file} — ⚠️ файл не сохранился, попросите клиента прислать его ещё раз`];
}

/** Length of an HTML message as Telegram counts it: tags removed, entities decoded, UTF-16 units. */
const visibleLength = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&(lt|gt|amp|quot);/g, "_").length;

async function callTelegram(
  fetcher: typeof fetch,
  token: string,
  method: "sendMessage" | "sendDocument",
  body: string | FormData,
  timeoutMs: number,
): Promise<void> {
  const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    ...(typeof body === "string" ? { headers: { "Content-Type": "application/json" } } : {}),
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram delivery failed: ${response.status} ${detail}`.slice(0, 300));
  }

  const payload = (await response.json()) as { ok?: boolean };
  if (!payload.ok) {
    throw new Error("Telegram delivery was rejected");
  }
}

function documentForm(chatId: string, lead: LeadNotification, bytes: Uint8Array, caption?: string): FormData {
  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  const attachment = lead.attachment!;
  form.append("document", new Blob([new Uint8Array(bytes)], { type: attachment.mimeType }), attachment.fileName);
  return form;
}

export async function sendLeadToTelegram(
  lead: LeadNotification,
  fetcher: typeof fetch = fetch,
  config = {
    token: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  },
  options: LeadDeliveryOptions = {},
): Promise<void> {
  if (!config.token || !config.chatId) {
    throw new Error("Telegram is not configured");
  }

  const text = formatLeadMessage(lead, options);
  const messageBody = () =>
    JSON.stringify({ chat_id: config.chatId, text, parse_mode: "HTML", disable_web_page_preview: true });

  if (!lead.attachment || !options.attachment) {
    await callTelegram(fetcher, config.token, "sendMessage", messageBody(), TELEGRAM_TIMEOUT_MS);
    return;
  }

  // One request carries both the lead and the file, so a retry never sends the text twice.
  if (visibleLength(text) <= TELEGRAM_CAPTION_LIMIT) {
    await callTelegram(fetcher, config.token, "sendDocument", documentForm(config.chatId, lead, options.attachment, text), TELEGRAM_UPLOAD_TIMEOUT_MS);
    return;
  }

  // A caption this long is not expected from the form's limits; keep the file first so a failed upload is retried whole.
  await callTelegram(fetcher, config.token, "sendDocument", documentForm(config.chatId, lead, options.attachment), TELEGRAM_UPLOAD_TIMEOUT_MS);
  await callTelegram(fetcher, config.token, "sendMessage", messageBody(), TELEGRAM_TIMEOUT_MS);
}

/** Sends a ready HTML message to the operator's chat; used for questions from the MAX bot. */
export async function sendTextToTelegram(
  html: string,
  fetcher: typeof fetch = fetch,
  config = {
    token: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  },
): Promise<void> {
  if (!config.token || !config.chatId) throw new Error("Telegram is not configured");
  const body = JSON.stringify({ chat_id: config.chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true });
  await callTelegram(fetcher, config.token, "sendMessage", body, TELEGRAM_TIMEOUT_MS);
}

export { escapeHtml };
