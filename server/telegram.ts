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
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatRubles = (amount: number) => `${amount.toLocaleString("ru-RU")} ₽`;

export function formatLeadMessage(lead: LeadNotification): string {
  const source = lead.source === "calculator" ? "Калькулятор" : "Контактная форма";

  return [
    "<b>Новая заявка — Классный Ремонт</b>",
    "",
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
  ].join("\n");
}

export async function sendLeadToTelegram(
  lead: LeadNotification,
  fetcher: typeof fetch = fetch,
  config = {
    token: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  },
): Promise<void> {
  if (!config.token || !config.chatId) {
    throw new Error("Telegram is not configured");
  }

  const response = await fetcher(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: formatLeadMessage(lead),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
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
