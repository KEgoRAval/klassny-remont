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

export const ATTACHMENT_REJECTED_MESSAGE = "Приложите PDF или изображение (JPG, PNG, WebP) размером до 20 МБ.";
/** The first consent edition that names an attached file; earlier editions cannot carry one. */
export const ATTACHMENT_CONSENT_VERSION = "2026-10-10";
export const ATTACHMENT_CONSENT_MESSAGE = "Обновите страницу, чтобы приложить файл: изменился текст согласия.";

export const leadInput = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(80),
  phone: z.string().trim().min(6, "Укажите телефон").max(40),
  service: z.string().trim().min(2).max(120),
  area: z.number().int().min(50).max(250),
  materialLabel: z.string().trim().min(2).max(80),
  workEstimate: z.number().int().min(0).max(50_000_000),
  // Sent by pages opened before the calculator switched to the cost of work only; accepted and dropped.
  materialsEstimate: z.number().int().min(0).max(50_000_000).optional(),
  totalEstimate: z.number().int().min(0).max(100_000_000).optional(),
  source: z.enum(["calculator", "contact"]),
  personalDataConsent: z.literal(true, { error: "Необходимо согласие на обработку персональных данных" }),
  telegramConsent: z.literal(true, { error: "Необходимо согласие на передачу заявки в Telegram" }),
  // Previous editions are still accepted so a page opened before a release can submit its form.
  consentVersion: z.enum(["2026-09-17", "2026-10-04", "2026-10-10"]),
  policyVersion: z.enum(["2026-09-17", "2026-10-04", "2026-10-10"]),
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
  if (consentVersion !== ATTACHMENT_CONSENT_VERSION || policyVersion !== ATTACHMENT_CONSENT_VERSION) {
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
      const { attachment, materialsEstimate: _materials, totalEstimate: _total, ...fields } = input;
      const file = readLeadAttachment(input);
      const lead: LeadNotification = file ? { ...fields, attachment: file.description } : fields;
      try {
        // The lead is written to disk before Telegram is contacted; see leadPipeline.ts.
        await submitLead(lead, leadPipelineDeps(), file?.bytes);
        return { success: true } as const;
      } catch (error) {
        console.error("[Lead notification]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось отправить заявку. Пожалуйста, позвоните нам или повторите попытку.",
        });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
