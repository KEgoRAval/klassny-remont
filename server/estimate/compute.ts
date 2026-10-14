import { PRICE_BY_ID, PRICE_LIST, SECTIONS, screedPrice, type SectionId } from "./priceList";

/** What the model reads from a design project. Quantities are keyed by price-list id. */
export type Extraction = {
  object: string;
  address: string;
  /** Area after redevelopment, m². */
  area: number;
  ceilingHeight: number | null;
  ceiling: "gkl" | "stretch" | "unknown";
  floorCoveringKnown: boolean;
  screedMm: number | null;
  quantities: Record<string, number>;
  /** Shown only to Egor. */
  assumptions: string[];
  notIncluded: string[];
  missingSheets: string[];
};

export type EstimateLine = {
  no: string;
  name: string;
  unit: string;
  qty: number | null;
  price: number | null;
  sum: number;
  note: string;
};

export type Estimate = {
  object: string;
  address: string;
  area: number;
  sections: { id: SectionId; title: string; lines: EstimateLine[]; total: number }[];
  total: number;
  perSquareMeter: number;
};

const roundQty = (value: number) => Math.round(value * 100) / 100;

export function buildEstimate(extraction: Extraction): Estimate {
  const q = { ...extraction.quantities };
  const area = roundQty(extraction.area);

  // Ceiling: a stretch ceiling is one row under a separate contract; plasterboard is priced in full.
  if (extraction.ceiling === "stretch") {
    for (const item of PRICE_LIST) if (item.section === 5 && item.id !== "c_stretch") delete q[item.id];
    if (!(q.c_stretch > 0)) q.c_stretch = area;
  } else {
    delete q.c_stretch;
  }
  // Screed is always counted.
  if (!(q.f_screed > 0)) q.f_screed = area;
  // Temporary utilities are always part of the job.
  q.o_temporary = 1;

  const sections: Estimate["sections"] = [];
  for (const id of Object.keys(SECTIONS).map(Number) as SectionId[]) {
    const lines: EstimateLine[] = [];
    for (const item of PRICE_LIST.filter(entry => entry.section === id)) {
      const raw = q[item.id];
      const qty = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? roundQty(raw) : null;
      const coveringPlaceholder = item.id === "f_engineered" && !extraction.floorCoveringKnown && qty === null;
      if (qty === null && !item.optional && !coveringPlaceholder) continue;

      let { name, price } = item;
      let note = item.note ?? "";
      if (item.id === "f_screed") ({ name, price } = screedPrice(extraction.screedMm));
      if (coveringPlaceholder) note = "покрытие уточняется";
      const sum = qty !== null && price !== null ? Math.round(qty * price) : 0;
      lines.push({ no: `${id}.${lines.length + 1}`, name, unit: item.unit, qty, price, sum, note });
    }
    if (lines.length) sections.push({ id, title: SECTIONS[id], lines, total: lines.reduce((acc, line) => acc + line.sum, 0) });
  }
  // Renumber sections consecutively so an empty section leaves no gap.
  sections.forEach((section, index) => section.lines.forEach((line, i) => { line.no = `${index + 1}.${i + 1}`; }));

  const total = sections.reduce((acc, section) => acc + section.total, 0);
  return {
    object: extraction.object.trim() || "Квартира",
    address: extraction.address.trim(),
    area,
    sections,
    total,
    perSquareMeter: area > 0 ? Math.round(total / area) : 0,
  };
}

/** Reasons an estimate must not go to a client automatically. */
export function estimateProblems(estimate: Estimate): string[] {
  const problems: string[] = [];
  if (!(estimate.area >= 15 && estimate.area <= 500)) problems.push(`площадь ${estimate.area} м² вне 15–500`);
  if (estimate.total <= 0) problems.push("итог 0 ₽");
  // Real projects land around 35–80 тыс./м² for work; far outside means the plan was misread.
  if (estimate.perSquareMeter && (estimate.perSquareMeter < 20_000 || estimate.perSquareMeter > 120_000)) {
    problems.push(`${estimate.perSquareMeter.toLocaleString("ru-RU")} ₽/м² — вне 20–120 тыс.`);
  }
  return problems;
}

export { PRICE_BY_ID };
