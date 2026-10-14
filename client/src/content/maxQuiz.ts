/**
 * Questions and the preliminary estimate for the MAX mini-app (/max).
 *
 * By the owner's decision the page shows only the lower bound, "from 40 000 ₽/м²" for
 * work, as the rest of the site does: real prices spread too widely for a range.
 */
export const WORK_RATE_FROM = 40_000;

export type PropertyTypeId = "new-bare" | "whitebox" | "secondary";
export type DesignStatusId = "ready" | "in-progress" | "none";

export type PropertyType = {
  id: PropertyTypeId;
  label: string;
  hint: string;
};

export const PROPERTY_TYPES: readonly PropertyType[] = [
  { id: "new-bare", label: "Новостройка без отделки", hint: "Бетон, без стяжки и штукатурки" },
  { id: "whitebox", label: "Новостройка White Box", hint: "Стяжка и штукатурка от застройщика" },
  { id: "secondary", label: "Вторичка", hint: "Нужен демонтаж старой отделки" },
];

export const DESIGN_STATUSES: readonly { id: DesignStatusId; label: string }[] = [
  { id: "ready", label: "Да, проект готов" },
  { id: "in-progress", label: "В работе у дизайнера" },
  { id: "none", label: "Нет проекта" },
];

export const MAX_AREA = { min: 20, max: 400, step: 1, initial: 70 } as const;

export function clampArea(area: number): number {
  if (!Number.isFinite(area)) return MAX_AREA.initial;
  return Math.min(MAX_AREA.max, Math.max(MAX_AREA.min, Math.round(area)));
}

export function propertyType(id: PropertyTypeId): PropertyType {
  return PROPERTY_TYPES.find(type => type.id === id) ?? PROPERTY_TYPES[0];
}

/** Cost of work from 40 000 ₽/м², the same figure the site's calculator shows. */
export function estimateFrom(area: number): number {
  return clampArea(area) * WORK_RATE_FROM;
}

export function designStatusLabel(id: DesignStatusId): string {
  return DESIGN_STATUSES.find(status => status.id === id)?.label ?? "";
}
