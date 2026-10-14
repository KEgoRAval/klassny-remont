import { mkdtempSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const pdf = Buffer.from("%PDF-1.4\n%test\n").toString("base64");
const lead = {
  name: "Анна",
  phone: "+7 999 123 45 67",
  service: "MAX: Смета по дизайн-проекту",
  area: 60,
  materialLabel: "Не указан",
  workEstimate: 2_400_000,
  source: "contact" as const,
  personalDataConsent: true as const,
  telegramConsent: true as const,
  consentVersion: "2026-10-14" as const,
  policyVersion: "2026-10-14" as const,
  attachment: { fileName: "project.pdf", data: pdf },
};
const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

describe("automatic estimate on lead submission", () => {
  const saved = { ...process.env };
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "estimate-submit-"));
    process.env.LEADS_JOURNAL_PATH = join(dir, "leads.jsonl");
    process.env.ANTHROPIC_API_KEY = "test";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    process.env = { ...saved };
    rmSync(dir, { recursive: true, force: true });
  });
  const jobs = () => (existsSync(join(dir, "estimates")) ? readdirSync(join(dir, "estimates")) : []);

  it("queues an estimate for a project sent with an email under the new consent", async () => {
    await appRouter.createCaller(ctx).leads.submit({ ...lead, email: "anna@mail.ru" });
    expect(jobs()).toHaveLength(1);
  });

  it("does not queue without a way to deliver, under an older consent, or with the feature off", async () => {
    await appRouter.createCaller(ctx).leads.submit(lead);
    await appRouter.createCaller(ctx).leads.submit({ ...lead, email: "anna@mail.ru", consentVersion: "2026-10-10", policyVersion: "2026-10-10" });
    await appRouter.createCaller(ctx).leads.submit({ ...lead, maxInitData: "user=%7B%22id%22%3A1%7D&hash=00" });
    delete process.env.ANTHROPIC_API_KEY;
    await appRouter.createCaller(ctx).leads.submit({ ...lead, email: "anna@mail.ru" });
    expect(jobs()).toHaveLength(0);
  });

  it("rejects a malformed email", async () => {
    await expect(appRouter.createCaller(ctx).leads.submit({ ...lead, email: "not-an-email" })).rejects.toThrow();
  });
});
