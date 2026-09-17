import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { sendLeadToTelegram } from "./telegram";

const leadInput = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(80),
  phone: z.string().trim().min(6, "Укажите телефон").max(40),
  service: z.string().trim().min(2).max(120),
  area: z.number().int().min(50).max(250),
  materialLabel: z.string().trim().min(2).max(80),
  workEstimate: z.number().int().min(0).max(50_000_000),
  materialsEstimate: z.number().int().min(0).max(50_000_000),
  totalEstimate: z.number().int().min(0).max(100_000_000),
  source: z.enum(["calculator", "contact"]),
});

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
      try {
        await sendLeadToTelegram(input);
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
