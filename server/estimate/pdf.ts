import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { Estimate } from "./compute";

/** Client PDF in the reference format (Кузнечная 84): A4 portrait, all columns on one page width. */

const FONT_DIR_CANDIDATES = [
  process.env.ESTIMATE_FONT_DIR,
  path.resolve(process.cwd(), "server/assets/fonts"),
  path.resolve(process.cwd(), "../server/assets/fonts"),
].filter(Boolean) as string[];

function fontDir(): string {
  const dir = FONT_DIR_CANDIDATES.find(candidate => fs.existsSync(path.join(candidate, "DejaVuSans.ttf")));
  if (!dir) throw new Error("DejaVu fonts not found (server/assets/fonts)");
  return dir;
}

export const formatNumber = (value: number) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }).replace(/ | /g, " ");

const COLUMNS = [
  { key: "no", title: "№", width: 30, align: "left" },
  { key: "name", title: "Наименование работ", width: 205, align: "left" },
  { key: "unit", title: "Ед. изм.", width: 40, align: "center" },
  { key: "qty", title: "Кол-во", width: 48, align: "right" },
  { key: "price", title: "Цена, ₽", width: 55, align: "right" },
  { key: "sum", title: "Сумма, ₽", width: 65, align: "right" },
  { key: "note", title: "Примечание", width: 92, align: "left" },
] as const;

export const VALIDITY_NOTE =
  "Настоящее Приложение (Смета) актуально в течение 14 календарных дней с момента составления. Стоимость, объём и количество работ определяются в момент заключения Договора, без учёта материалов.";

export function renderEstimatePdf(estimate: Estimate, date = new Date()): Promise<Buffer> {
  const dir = fontDir();
  const doc = new PDFDocument({ size: "A4", margins: { top: 36, bottom: 40, left: 30, right: 30 }, info: { Title: `Смета — ${estimate.object}` } });
  doc.registerFont("r", path.join(dir, "DejaVuSans.ttf"));
  doc.registerFont("b", path.join(dir, "DejaVuSans-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", chunk => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const tableWidth = COLUMNS.reduce((acc, col) => acc + col.width, 0);
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const pad = 3;

  doc.font("b").fontSize(15).text("Смета на работы", left, doc.y);
  doc.moveDown(0.5);
  const dated = date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  const head: [string, string][] = [
    ["Объект", estimate.object],
    ["Адрес", estimate.address || "—"],
    ["Площадь", `${formatNumber(estimate.area)} м²`],
    ["Итого", `${formatNumber(estimate.total)} ₽`],
    ["Дата", dated],
  ];
  for (const [label, value] of head) {
    const y = doc.y;
    doc.font("b").fontSize(9).text(label, left, y, { width: 70 });
    doc.font(label === "Итого" ? "b" : "r").fontSize(9).text(value, left + 70, y, { width: tableWidth - 70 });
    doc.moveDown(0.2);
  }
  doc.moveDown(0.6);

  const cellHeight = (values: string[], font: string, size: number) => {
    doc.font(font).fontSize(size);
    return Math.max(...values.map((value, i) => doc.heightOfString(value, { width: COLUMNS[i].width - pad * 2 }))) + pad * 2;
  };

  const drawRow = (values: string[], opts: { font?: string; size?: number; fill?: string } = {}) => {
    const font = opts.font ?? "r";
    const size = opts.size ?? 7.5;
    const height = cellHeight(values, font, size);
    if (doc.y + height > bottom()) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (opts.fill) doc.save().rect(left, y, tableWidth, height).fill(opts.fill).restore();
    let x = left;
    COLUMNS.forEach((col, i) => {
      doc.rect(x, y, col.width, height).lineWidth(0.4).strokeColor("#9a9a9a").stroke();
      doc.fillColor("#111").font(font).fontSize(size).text(values[i] ?? "", x + pad, y + pad, { width: col.width - pad * 2, align: col.align });
      x += col.width;
    });
    doc.x = left;
    doc.y = y + height;
  };

  const drawSpanRow = (label: string, value: string, fill: string) => {
    const height = 16;
    if (doc.y + height > bottom()) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    doc.save().rect(left, y, tableWidth, height).fill(fill).restore();
    doc.rect(left, y, tableWidth, height).lineWidth(0.4).strokeColor("#9a9a9a").stroke();
    const sumX = left + COLUMNS.slice(0, 5).reduce((acc, col) => acc + col.width, 0);
    doc.fillColor("#111").font("b").fontSize(8).text(label, left + pad, y + 4, { width: sumX - left - pad * 2 });
    doc.text(value, sumX + pad, y + 4, { width: COLUMNS[5].width - pad * 2, align: "right" });
    doc.x = left;
    doc.y = y + height;
  };

  function drawHeader() {
    drawRow(COLUMNS.map(col => col.title), { font: "b", size: 7.5, fill: "#e9e4dc" });
  }

  drawHeader();
  estimate.sections.forEach((section, index) => {
    drawSpanRow(`${index + 1}. ${section.title}`, "", "#f4f1ec");
    for (const line of section.lines) {
      drawRow([
        line.no,
        line.name,
        line.unit,
        line.qty === null ? "" : formatNumber(line.qty),
        line.price === null ? "" : formatNumber(line.price),
        line.qty === null || line.price === null ? (line.price === null && line.qty !== null ? "—" : "") : formatNumber(line.sum),
        line.note,
      ]);
    }
    drawSpanRow("Итого по разделу", formatNumber(section.total), "#ffffff");
  });
  drawSpanRow("ИТОГО ПО СМЕТЕ", formatNumber(estimate.total), "#e9e4dc");

  if (doc.y + 70 > bottom()) doc.addPage();
  doc.moveDown(1);
  doc.fillColor("#111").font("r").fontSize(8).text(VALIDITY_NOTE, left, doc.y, { width: tableWidth });
  doc.moveDown(2);
  const y = doc.y;
  doc.font("r").fontSize(9).text("Подрядчик ____________ /____________/", left, y);
  doc.text("Заказчик ____________ /____________/", left + tableWidth / 2 + 10, y);

  doc.end();
  return done;
}
