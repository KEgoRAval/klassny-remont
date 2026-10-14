import { PRICE_LIST } from "./priceList";
import type { Extraction } from "./compute";

/**
 * Reads a design project with the Claude API and returns quantities for the Level price list.
 * The model returns numbers only, through a forced tool call; prices and wording stay in code.
 *
 * Env: ANTHROPIC_API_KEY (required), ESTIMATE_MODEL (default claude-opus-5-5).
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 10 * 60 * 1000;

export const RULES = `Ты сметчик компании «Классный ремонт» (ремонт квартир под ключ, Москва). По дизайн-проекту квартиры определи объёмы работ для сметы по прайсу Level. Цены не нужны — только количества.

Как читать проект:
- Просмотри все листы: обмерный план, демонтаж, монтаж, техплан, сантехника, свет, электрика, тёплый пол, пол, потолок, развёртки, ведомости. Листы без текста (планы пола и потолка) тоже смотри по изображению. Если в ведомости чертежей есть листы, которых нет в файле, перечисли их в missingSheets.
- Объект и адрес — из штампа; площадь — по экспликации после перепланировки; высота — до потолка.
- Точки электрики — по легенде электроплана; если количеств нет, посчитай по плану.

Правила объёмов:
- Стены: если есть ведомость отделки стен — бери площади из неё. Иначе периметр × высота − проёмы по каждому помещению. Штукатурка — все стены, включая обе стороны новых перегородок, кроме ГКЛ. Базовая и финишная шпаклёвка — всё, кроме плитки. «Паутинка» и окраска — только окрашиваемые стены. «Обои под покраску» = паутинка + окраска. «Техническая покраска» = окраска без паутинки.
- Перегородки: по умолчанию газобетон (w_aerated, м² = длина × высота − проёмы). ГКЛ-перегородки (w_gkl_partition) — только если проект прямо говорит «гипсокартон».
- Демонтаж: если существующие перегородки — только разметка/первые ряды (≈300 мм), dem_markup = 1. Полноценные перегородки — dem_partitions в м².
- Стяжка: всегда, площадь пола; screedMm = разница отметок чернового и чистого пола (если нет — null).
- Потолок: ceiling = "gkl" если по проекту гипсокартон, "stretch" если натяжной, "unknown" если неясно. Для ГКЛ заполни каркас, обшивку, стыки, грунт, шпаклёвку, паутинку, финиш, покраску, отверстия под светильники, закладные под люстры. Для натяжного — только c_stretch (площадь).
- Пол: покрытие по спецификации; если плана пола нет — floorCoveringKnown = false и не заполняй покрытие.
- Плитка — по ведомости/развёрткам; t_backsplash = 1 при кухонном фартуке; гидроизоляция — по одной на мокрое помещение.
- Откосы — погонные метры по окнам, балконному блоку и входной двери; o_window_film — число окон.
- Электрика: el_box = все розетки + все выключатели; el_chase и el_chase_fill ≈ 40 м, el_cable ≈ 400 м для квартиры 55–70 м², пропорционально площади, не завышать. Тёплый пол — штуки (зоны/маты), не м².
- Смесители — только накладные; скрытые не считать. Если новые радиаторы/коллекторы — p_heating_manifold = 2.
- Не включай и не подменяй другими позициями: LED-ленту, блоки питания, световые линии, установку раковин/моек/диспоузера/фильтра, подключение техники, двери, перенос вентиляции, трассы кондиционеров, защиту от протечек, демонтаж сантехприборов и конвекторов, декоративные обои, молдинги, вывоз мусора, подъём материалов, уборку. Что из этого есть в проекте — перечисли в notIncluded.
- Позиции, которых нет в проекте, не заполняй (не ставь 0, просто пропусти).
- В assumptions кратко перечисли 3–6 главных допущений по объёмам.`;

function toolSchema() {
  const quantities: Record<string, unknown> = {};
  for (const item of PRICE_LIST) {
    if (item.optional) continue;
    quantities[item.id] = { type: "number", description: `${item.name}, ${item.unit}. ${item.hint}` };
  }
  return {
    name: "submit_quantities",
    description: "Return the quantities read from the design project.",
    input_schema: {
      type: "object",
      properties: {
        object: { type: "string", description: "Объект, как в штампе (например «Квартира, ЖК …»)" },
        address: { type: "string", description: "Адрес из штампа" },
        area: { type: "number", description: "Площадь квартиры по экспликации после перепланировки, м²" },
        ceilingHeight: { type: ["number", "null"], description: "Высота до потолка, м" },
        ceiling: { type: "string", enum: ["gkl", "stretch", "unknown"] },
        floorCoveringKnown: { type: "boolean" },
        screedMm: { type: ["number", "null"] },
        quantities: { type: "object", properties: quantities, additionalProperties: false },
        assumptions: { type: "array", items: { type: "string" } },
        notIncluded: { type: "array", items: { type: "string" } },
        missingSheets: { type: "array", items: { type: "string" } },
      },
      required: ["object", "address", "area", "ceiling", "floorCoveringKnown", "quantities", "assumptions", "notIncluded", "missingSheets"],
    },
  };
}

export type ProjectFile = { bytes: Uint8Array; mimeType: string };

function fileBlock(file: ProjectFile) {
  const data = Buffer.from(file.bytes).toString("base64");
  if (file.mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  return { type: "image", source: { type: "base64", media_type: file.mimeType, data } };
}

export async function extractQuantities(
  file: ProjectFile,
  fetcher: typeof fetch = fetch,
  config = { apiKey: process.env.ANTHROPIC_API_KEY ?? "", model: process.env.ESTIMATE_MODEL || "claude-opus-5-5" },
): Promise<Extraction> {
  if (!config.apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const tool = toolSchema();
  const response = await fetcher(API_URL, {
    method: "POST",
    headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 16_000,
      system: RULES,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: [fileBlock(file), { type: "text", text: "Определи объёмы работ по этому дизайн-проекту и верни их через submit_quantities." }] }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude API ${response.status}: ${detail}`.slice(0, 500));
  }
  const payload = (await response.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const call = payload.content?.find(block => block.type === "tool_use" && block.name === tool.name);
  if (!call?.input) throw new Error("Claude API returned no quantities");
  return normalizeExtraction(call.input);
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : []);

/** Accepts only known ids and numbers, whatever the model returned. */
export function normalizeExtraction(input: unknown): Extraction {
  const raw = (input ?? {}) as Record<string, unknown>;
  const quantities: Record<string, number> = {};
  const rawQuantities = (raw.quantities ?? {}) as Record<string, unknown>;
  for (const item of PRICE_LIST) {
    const value = num(rawQuantities[item.id]);
    if (value !== null && value > 0 && value < 100_000) quantities[item.id] = value;
  }
  const ceiling = raw.ceiling === "gkl" || raw.ceiling === "stretch" ? raw.ceiling : "unknown";
  return {
    object: typeof raw.object === "string" ? raw.object.slice(0, 200) : "",
    address: typeof raw.address === "string" ? raw.address.slice(0, 300) : "",
    area: num(raw.area) ?? 0,
    ceilingHeight: num(raw.ceilingHeight),
    ceiling,
    floorCoveringKnown: raw.floorCoveringKnown === true,
    screedMm: num(raw.screedMm),
    quantities,
    assumptions: strings(raw.assumptions),
    notIncluded: strings(raw.notIncluded),
    missingSheets: strings(raw.missingSheets),
  };
}
