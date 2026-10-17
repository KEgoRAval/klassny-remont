import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { buildEstimate, estimateProblems, type Estimate, type Extraction } from "./compute";
import { extractQuantities, type ProjectFile } from "./extract";
import { formatNumber, renderEstimatePdf } from "./pdf";
import { maxConfig, sendMaxFile } from "../maxBot";
import { escapeHtml, sendDocumentToTelegram, sendTextToTelegram } from "../telegram";

/**
 * Automatic estimates for leads that came with a design project.
 *
 * A job is a folder next to the lead journal: job.json, the project file until it has been
 * read, and estimate.pdf. The worker reads the project right away, sends Egor a copy in
 * Telegram, and delivers the PDF to the client ESTIMATE_DELAY_MINUTES (default 72) after
 * the lead: by the MAX bot when the lead came from the mini-app inside MAX, else by email.
 *
 * Env: ANTHROPIC_API_KEY (turns the feature on), ESTIMATE_DELAY_MINUTES,
 * ESTIMATE_AUTO_SEND=off (keep making copies for Egor, send nothing to clients),
 * SMTP_URL + MAIL_FROM (+ MAIL_FROM_NAME) for email delivery.
 */

export type Delivery = { kind: "max"; userId: number } | { kind: "email"; address: string };

export type EstimateJob = {
  id: string;
  createdAt: string;
  dueAt: string;
  status: "queued" | "ready" | "held" | "sent" | "failed";
  client: { name: string; phone: string };
  delivery: Delivery;
  file: { name: string; mimeType: string };
  attempts: number;
  total?: number;
  perSquareMeter?: number;
  error?: string;
  sentAt?: string;
};

export type JobDeps = {
  dir: string;
  now: () => number;
  extract: (file: ProjectFile) => Promise<Extraction>;
  render: (estimate: Estimate) => Promise<Buffer>;
  notifyOwner: (pdf: Buffer | null, fileName: string, html: string) => Promise<void>;
  deliver: (job: EstimateJob, pdf: Buffer, estimate: { total: number; perSquareMeter: number }) => Promise<void>;
  autoSend: boolean;
};

const MAX_ATTEMPTS = 3;
export const PDF_NAME = "estimate.pdf";

export const estimatesEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const estimateDelayMinutes = () => {
  const value = Number(process.env.ESTIMATE_DELAY_MINUTES);
  return Number.isFinite(value) && value >= 0 ? value : 72;
};

const jobFile = (dir: string, id: string) => path.join(dir, id, "job.json");
const projectFile = (dir: string, id: string) => path.join(dir, id, "project");

function writeJob(dir: string, job: EstimateJob) {
  const target = jobFile(dir, job.id);
  fs.writeFileSync(`${target}.tmp`, JSON.stringify(job, null, 2));
  fs.renameSync(`${target}.tmp`, target);
}

export function readJobs(dir: string): EstimateJob[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(id => {
    try {
      return [JSON.parse(fs.readFileSync(jobFile(dir, id), "utf8")) as EstimateJob];
    } catch {
      return [];
    }
  });
}

/** Stores the project and queues the estimate. Called right after the lead is saved. */
export function enqueueEstimate(
  dir: string,
  input: { client: EstimateJob["client"]; delivery: Delivery; file: { name: string; mimeType: string; bytes: Uint8Array } },
  now = Date.now(),
  delayMinutes = estimateDelayMinutes(),
): EstimateJob {
  const id = `${new Date(now).toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  fs.mkdirSync(path.join(dir, id), { recursive: true, mode: 0o700 });
  fs.writeFileSync(projectFile(dir, id), input.file.bytes, { mode: 0o600 });
  const job: EstimateJob = {
    id,
    createdAt: new Date(now).toISOString(),
    dueAt: new Date(now + delayMinutes * 60_000).toISOString(),
    status: "queued",
    client: input.client,
    delivery: input.delivery,
    file: { name: input.file.name, mimeType: input.file.mimeType },
    attempts: 0,
  };
  writeJob(dir, job);
  return job;
}

const moscowTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const deliveryLabel = (delivery: Delivery) => (delivery.kind === "max" ? "в бот MAX" : `на ${delivery.address}`);

export function ownerCaption(job: EstimateJob, estimate: Estimate, extraction: Extraction, problems: string[], autoSend: boolean): string {
  const list = (title: string, items: string[]) => (items.length ? [`<b>${title}:</b> ${escapeHtml(items.join("; "))}`] : []);
  const fate = problems.length
    ? `⛔️ <b>Клиенту НЕ отправлена:</b> ${escapeHtml(problems.join("; "))}. Проверьте и отправьте вручную.`
    : autoSend
      ? `⏱ Уйдёт клиенту ${deliveryLabel(job.delivery)} в ${moscowTime(job.dueAt)} (МСК).`
      : "⏸ Автоотправка выключена — клиенту не отправляется.";
  return [
    "🧾 <b>Автосмета — Классный Ремонт</b>",
    `<b>Клиент:</b> ${escapeHtml(job.client.name)}, ${escapeHtml(job.client.phone)}`,
    `<b>Объект:</b> ${escapeHtml(estimate.object)}, ${formatNumber(estimate.area)} м²`,
    `<b>Итого:</b> ${formatNumber(estimate.total)} ₽ (${formatNumber(estimate.perSquareMeter)} ₽/м²)`,
    ...(extraction.ceiling === "unknown" ? ["<b>Потолок:</b> из проекта неясно, посчитан ГКЛ"] : []),
    ...list("Допущения", extraction.assumptions),
    ...list("Не включено", extraction.notIncluded),
    ...list("Нет листов", extraction.missingSheets),
    "",
    fate,
  ].join("\n");
}

async function generate(job: EstimateJob, deps: JobDeps) {
  const bytes = fs.readFileSync(projectFile(deps.dir, job.id));
  const extraction = await deps.extract({ bytes, mimeType: job.file.mimeType });
  const estimate = buildEstimate(extraction);
  const problems = estimateProblems(estimate);
  const pdf = await deps.render(estimate);
  fs.writeFileSync(path.join(deps.dir, job.id, PDF_NAME), pdf, { mode: 0o600 });
  job.total = estimate.total;
  job.perSquareMeter = estimate.perSquareMeter;
  job.status = problems.length || !deps.autoSend ? "held" : "ready";
  job.error = problems.length ? problems.join("; ") : undefined;
  writeJob(deps.dir, job);
  // The project has been read; per the privacy policy it is not kept any longer.
  fs.rmSync(projectFile(deps.dir, job.id), { force: true });
  await deps.notifyOwner(pdf, `Смета ${estimate.object}.pdf`, ownerCaption(job, estimate, extraction, problems, deps.autoSend)).catch(error =>
    console.error("[Estimate] copy to Telegram failed:", error instanceof Error ? error.message : error));
}

async function fail(job: EstimateJob, deps: JobDeps, stage: string, error: unknown) {
  job.attempts += 1;
  job.error = `${stage}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 400);
  console.error(`[Estimate] ${job.id} ${job.error}`);
  if (job.attempts < MAX_ATTEMPTS) {
    writeJob(deps.dir, job);
    return;
  }
  job.status = "failed";
  writeJob(deps.dir, job);
  fs.rmSync(projectFile(deps.dir, job.id), { force: true });
  await deps.notifyOwner(null, "", [
    "⚠️ <b>Автосмета не получилась</b>",
    `<b>Клиент:</b> ${escapeHtml(job.client.name)}, ${escapeHtml(job.client.phone)}`,
    `<b>Причина:</b> ${escapeHtml(job.error)}`,
    "Клиенту ничего не отправлено — посчитайте вручную по проекту из заявки.",
  ].join("\n")).catch(() => {});
}

/** One pass over the queue: read new projects, deliver estimates that are due. */
export async function processEstimates(deps: JobDeps): Promise<void> {
  for (const job of readJobs(deps.dir)) {
    if (job.status === "queued") {
      try {
        await generate(job, deps);
      } catch (error) {
        await fail(job, deps, "расчёт", error);
      }
      continue;
    }
    if (job.status === "ready" && deps.now() >= Date.parse(job.dueAt)) {
      if (!deps.autoSend) continue;
      try {
        const pdf = fs.readFileSync(path.join(deps.dir, job.id, PDF_NAME));
        await deps.deliver(job, pdf, { total: job.total ?? 0, perSquareMeter: job.perSquareMeter ?? 0 });
        job.status = "sent";
        job.sentAt = new Date(deps.now()).toISOString();
        job.error = undefined;
        writeJob(deps.dir, job);
        await deps.notifyOwner(null, "", `✅ Смета отправлена клиенту ${escapeHtml(job.client.name)} (${escapeHtml(job.client.phone)}) ${escapeHtml(deliveryLabel(job.delivery))}.`).catch(() => {});
      } catch (error) {
        job.attempts += 1;
        job.error = `отправка: ${error instanceof Error ? error.message : String(error)}`.slice(0, 400);
        if (job.attempts >= MAX_ATTEMPTS + 2) {
          job.status = "failed";
          await deps.notifyOwner(null, "", `⚠️ Смету не удалось отправить клиенту ${escapeHtml(job.client.name)} (${escapeHtml(job.client.phone)}): ${escapeHtml(job.error)}. Отправьте вручную.`).catch(() => {});
        }
        writeJob(deps.dir, job);
      }
    }
  }
}

export function clientMessage(name: string, total: number, perSquareMeter: number): string {
  return [
    `Здравствуйте${name ? `, ${name}` : ""}!`,
    "",
    `Подготовили смету на работы по вашему дизайн-проекту: ${formatNumber(total)} ₽ (${formatNumber(perSquareMeter)} ₽/м²), без учёта материалов.`,
    "Смета действует 14 дней; итоговую стоимость фиксируем в договоре после замера. Менеджер свяжется с вами, чтобы обсудить детали.",
    "",
    "Классный ремонт · 8 (977) 948‑06‑72 · krem.moscow",
  ].join("\n");
}

const EMAIL = /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/;

/**
 * The envelope sender. Yandex rejects a bare login ("501 5.1.7 Bad address mailbox syntax"), which is
 * what MAIL_FROM holds when the login was typed without the domain: take the first full address among
 * MAIL_FROM and the SMTP login, and complete a bare Yandex login with @yandex.ru.
 */
export function senderAddress(env: NodeJS.ProcessEnv): string | null {
  const clean = (value: string | undefined) => (value ?? "").trim().replace(/^["'<]+|["'>]+$/g, "");
  let login = "";
  let host = "";
  try {
    const url = new URL(env.SMTP_URL ?? "");
    login = decodeURIComponent(url.username);
    host = url.hostname;
  } catch {
    // no SMTP_URL: only MAIL_FROM can give the address
  }
  for (const candidate of [clean(env.MAIL_FROM), clean(login)]) {
    if (EMAIL.test(candidate)) return candidate;
  }
  const bare = clean(env.MAIL_FROM) || clean(login);
  if (bare && !bare.includes("@") && /(^|\.)yandex\.(ru|com)$/.test(host)) return `${bare}@yandex.ru`;
  return null;
}

export async function deliverEstimate(job: EstimateJob, pdf: Buffer, estimate: { total: number; perSquareMeter: number }) {
  const text = clientMessage(job.client.name, estimate.total, estimate.perSquareMeter);
  const fileName = "Смета Классный ремонт.pdf";
  if (job.delivery.kind === "max") {
    const config = maxConfig();
    if (!config) throw new Error("бот MAX не настроен");
    await sendMaxFile(config, job.delivery.userId, pdf, fileName, text);
    return;
  }
  const url = process.env.SMTP_URL;
  const from = senderAddress(process.env);
  if (!url || !from) throw new Error("почта не настроена: в MAIL_FROM нужен полный адрес ящика, например name@yandex.ru");
  await nodemailer.createTransport(url).sendMail({
    from: { name: process.env.MAIL_FROM_NAME || "Классный ремонт", address: from },
    to: job.delivery.address,
    subject: "Смета на ремонт — Классный ремонт",
    text,
    attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
  });
}

export function liveJobDeps(dir: string): JobDeps {
  return {
    dir,
    now: Date.now,
    extract: file => extractQuantities(file),
    render: estimate => renderEstimatePdf(estimate),
    notifyOwner: (pdf, fileName, html) => (pdf ? sendDocumentToTelegram(pdf, fileName, html) : sendTextToTelegram(html)),
    deliver: deliverEstimate,
    autoSend: (process.env.ESTIMATE_AUTO_SEND ?? "on").toLowerCase() !== "off",
  };
}

/** Runs the queue every minute; jobs survive restarts because they live on disk. */
export function startEstimateWorker(dir: string, intervalMs = 60_000): () => void {
  if (!estimatesEnabled()) {
    console.log("[Estimate] automatic estimates off (no ANTHROPIC_API_KEY)");
    return () => {};
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processEstimates(liveJobDeps(dir));
    } catch (error) {
      console.error("[Estimate] worker failed", error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
