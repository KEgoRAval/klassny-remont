/**
 * Preliminary estimate for the MAX mini-app (/max).
 *
 * Rates are for the cost of work only, per m², and are the single place to tune the
 * price range a visitor sees before leaving a phone number. The lower bound never goes
 * below the 40 000 ₽/м² the rest of the site promises.
 *
 * TODO(owner): confirm the ranges. Starting points:
 * - new build without finishing: reference estimate Кузнечная 84 came out at ~43 900 ₽/м²;
 * - White Box: less rough work, but the developer's plaster and screed are often redone;
 * - secondary housing: demolition, levelling and new utilities on top of the base work.
 */
export type PropertyTypeId = "new-bare" | "whitebox" | "secondary";
export type DesignStatusId = "ready" | "in-progress" | "none";

export type PropertyType = {
  id: PropertyTypeId;
  label: string;
  hint: string;
  rateFrom: number;
  rateTo: number;
};

export const PROPERTY_TYPES: readonly PropertyType[] = [
  { id: "new-bare", label: "Новостройка без отделки", hint: "Бетон, без стяжки и штукатурки", rateFrom: 40_000, rateTo: 46_000 },
  { id: "whitebox", label: "Новостройка White Box", hint: "Стяжка и штукатурка от застройщика", rateFrom: 40_000, rateTo: 44_000 },
  { id: "secondary", label: "Вторичка", hint: "Нужен демонтаж старой отделки", rateFrom: 44_000, rateTo: 52_000 },
];

export const DESIGN_STATUSES: readonly { id: DesignStatusId; label: string }[] = [
  { id: "ready", label: "Да, проект готов" },
  { id: "in-progress", label: "В работе у дизайнера" },
  { id: "none", label: "Нет проекта" },
];

export const MAX_AREA = { min: 20, max: 400, step: 1, initial: 70 } as const;

/** Rounded to 10 000 ₽ so the range reads as an estimate, not a quote. */
const roundTo10k = (value: number) => Math.round(value / 10_000) * 10_000;

export function clampArea(area: number): number {
  if (!Number.isFinite(area)) return MAX_AREA.initial;
  return Math.min(MAX_AREA.max, Math.max(MAX_AREA.min, Math.round(area)));
}

export function propertyType(id: PropertyTypeId): PropertyType {
  return PROPERTY_TYPES.find(type => type.id === id) ?? PROPERTY_TYPES[0];
}

export function estimateRange(area: number, typeId: PropertyTypeId): { from: number; to: number } {
  const type = propertyType(typeId);
  const safeArea = clampArea(area);
  return { from: roundTo10k(safeArea * type.rateFrom), to: roundTo10k(safeArea * type.rateTo) };
}

export function designStatusLabel(id: DesignStatusId): string {
  return DESIGN_STATUSES.find(status => status.id === id)?.label ?? "";
}
