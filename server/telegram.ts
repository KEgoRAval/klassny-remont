export type LeadNotification = {
  name: string;
  phone: string;
  service: string;
  area: number;
  materialLabel: string;
  workEstimate: number;
  materialsEstimate: number;
  totalEstimate: number;
  source: "calculator" | "contact";
  personalDataConsent: true;
  telegramConsent: true;
  consentVersion: "2026-09-17" | "2026-10-04";
  policyVersion: "2026-09-17" | "2026-10-04";
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatRubles = (amount: number) => `${amount.toLocaleString("ru-RU")} ₽`;

export type LeadDeliveryOptions = {
  /** ISO time the lead was received, set when it is delivered by a later retry. */
  delayedSince?: string;
};

const TELEGRAM_TIMEOUT_MS = 10_000;

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
  const source = lead.source === "calculator" ? "Калькулятор" : "Контактная форма";
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
    `<b>Материалы:</b> ${escapeHtml(lead.materialLabel)}`,
    `<b>Работы:</b> от ${formatRubles(lead.workEstimate)}`,
    `<b>Материалы:</b> от ${formatRubles(lead.materialsEstimate)}`,
    `<b>Ориентир:</b> от ${formatRubles(lead.totalEstimate)}`,
    "",
    `<b>Согласия:</b> обработка ПД и передача в Telegram — получены (${lead.consentVersion})`,
  ].join("\n");
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

  const response = await fetcher(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: formatLeadMessage(lead, options),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
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
