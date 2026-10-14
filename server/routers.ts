import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  detectAttachmentType,
  MAX_ATTACHMENT_BASE64_LENGTH,
  MAX_ATTACHMENT_BYTES,
  safeAttachmentName,
} from "./leadAttachments";
import { leadPipelineDeps } from "./leadService";
import { submitLead } from "./leadPipeline";
import type { LeadNotification } from "./telegram";
import { enqueueEstimate, estimateDelayMinutes, estimatesEnabled, type Delivery } from "./estimate/jobs";
import { estimatesPath } from "./leadService";
import { verifyMaxInitData } from "./maxInitData";

export const ATTACHMENT_REJECTED_MESSAGE = "Приложите PDF или изображение (JPG, PNG, WebP) размером до 20 МБ.";
/** Consent editions that name an attached file; earlier editions cannot carry one. */
export const ATTACHMENT_CONSENT_VERSIONS = ["2026-10-10", "2026-10-14"] as const;
/** The first edition that covers sending the file to Claude for an automatic estimate. */
export const AUTO_ESTIMATE_CONSENT_VERSION = "2026-10-14";
export const ATTACHMENT_CONSENT_MESSAGE = "Обновите страницу, чтобы приложить файл: изменился текст согласия.";

export const leadInput = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(80),
  phone: z.string().trim().min(6, "Укажите телефон").max(40),
  service: z.string().trim().min(2).max(120),
  // The site calculator sends 50–250 m²; the MAX mini-app asks for the exact area.
  area: z.number().int().min(20).max(400),
  materialLabel: z.string().trim().min(2).max(80),
  workEstimate: z.number().int().min(0).max(50_000_000),
  // Sent by pages opened before the calculator switched to the cost of work only; accepted and dropped.
  materialsEstimate: z.number().int().min(0).max(50_000_000).optional(),
  totalEstimate: z.number().int().min(0).max(100_000_000).optional(),
  source: z.enum(["calculator", "contact"]),
  /** Where the form was opened: the site itself or the MAX mini-app. Not stored in the database. */
  channel: z.enum(["site", "max"]).optional(),
  /** For the automatic estimate when the lead is not from inside MAX. */
  email: z.string().trim().max(120).email("Укажите корректный email").optional().or(z.literal("").transform(() => undefined)),
  /** Launch data of the MAX mini-app; verified on the server to know whom the bot may write to. */
  maxInitData: z.string().max(4096).optional(),
  personalDataConsent: z.literal(true, { error: "Необходимо согласие на обработку персональных данных" }),
  telegramConsent: z.literal(true, { error: "Необходимо согласие на передачу заявки в Telegram" }),
  // Previous editions are still accepted so a page opened before a release can submit its form.
  consentVersion: z.enum(["2026-09-17", "2026-10-04", "2026-10-10", "2026-10-14"]),
  policyVersion: z.enum(["2026-09-17", "2026-10-04", "2026-10-10", "2026-10-14"]),
  /** Optional design project from the contact form, as base64. Its type is checked from the bytes. */
  attachment: z
    .object({
      fileName: z.string().trim().min(1).max(255),
      data: z.string().min(1).max(MAX_ATTACHMENT_BASE64_LENGTH, ATTACHMENT_REJECTED_MESSAGE),
    })
    .optional(),
});

/** Turns the submitted file into bytes plus the description the journal keeps. */
export function readLeadAttachment({ attachment, consentVersion, policyVersion }: Pick<z.infer<typeof leadInput>, "attachment" | "consentVersion" | "policyVersion">) {
  if (!attachment) return undefined;
  // A file may only travel under the consent text that names it.
  const editions: readonly string[] = ATTACHMENT_CONSENT_VERSIONS;
  if (!editions.includes(consentVersion) || !editions.includes(policyVersion)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: ATTACHMENT_CONSENT_MESSAGE });
  }
  const bytes = Buffer.from(attachment.data, "base64");
  const mimeType = detectAttachmentType(bytes);
  if (!mimeType || bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: ATTACHMENT_REJECTED_MESSAGE });
  }
  return {
    bytes,
    description: { fileName: safeAttachmentName(attachment.fileName, mimeType), mimeType, size: bytes.length },
  };
}

/** Whom the automatic estimate goes to: the verified MAX user first, else the email from the form. */
export function estimateDelivery(maxInitData: string | undefined, email: string | undefined): Delivery | null {
  const max = verifyMaxInitData(maxInitData, process.env.MAX_BOT_TOKEN ?? "");
  if (max) return { kind: "max", userId: max.userId };
  if (email) return { kind: "email", address: email };
  return null;
}

function autoEstimateNote(delivery: Delivery): string {
  const at = new Date(Date.now() + estimateDelayMinutes() * 60_000).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
  return `считается; клиенту ${delivery.kind === "max" ? "в бот MAX" : `на ${delivery.address}`} в ${at} (МСК), копия придёт сюда`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  leads: router({
    submit: publicProcedure.input(leadInput).mutation(async ({ input }) => {
      const { attachment, materialsEstimate: _materials, totalEstimate: _total, maxInitData, ...fields } = input;
      const file = readLeadAttachment(input);
      // Only a lead given under the edition that names the automatic estimate gets one.
      const estimateConsent = fields.consentVersion === AUTO_ESTIMATE_CONSENT_VERSION && fields.policyVersion === AUTO_ESTIMATE_CONSENT_VERSION;
      const delivery = file && estimateConsent && estimatesEnabled() ? estimateDelivery(maxInitData, fields.email) : null;
      const lead: LeadNotification = file ? { ...fields, attachment: file.description } : fields;
      if (delivery) lead.autoEstimate = autoEstimateNote(delivery);
      try {
        // The lead is written to disk before Telegram is contacted; see leadPipeline.ts.
        await submitLead(lead, leadPipelineDeps(), file?.bytes);
      } catch (error) {
        console.error("[Lead notification]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось отправить заявку. Пожалуйста, позвоните нам или повторите попытку.",
        });
      }
      if (file && delivery) {
        try {
          enqueueEstimate(estimatesPath(), {
            client: { name: fields.name, phone: fields.phone },
            delivery,
            file: { name: file.description.fileName, mimeType: file.description.mimeType, bytes: file.bytes },
          });
        } catch (error) {
          // The lead itself is already saved and on its way; the estimate is a bonus.
          console.error("[Estimate] could not queue", error);
        }
      }
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
