import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const validLead = {
  name: "Анна",
  phone: "+7 999 123 45 67",
  service: "Ремонт квартиры под ключ",
  area: 100,
  materialLabel: "Рациональный",
  workEstimate: 4_000_000,
  source: "calculator" as const,
  personalDataConsent: true as const,
  telegramConsent: true as const,
  consentVersion: "2026-09-17" as const,
  policyVersion: "2026-09-17" as const,
};

const publicContext = { user: null, req: { protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

describe("leads.submit", () => {
  const saved = { ...process.env };
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "leads-submit-"));
    process.env.LEADS_JOURNAL_PATH = join(dir, "leads.jsonl");
    // Telegram and the database are both unavailable in this scenario.
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    process.env = { ...saved };
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a lead and keeps it on disk when Telegram cannot be reached", async () => {
    const result = await appRouter.createCaller(publicContext).leads.submit(validLead);

    expect(result).toEqual({ success: true });
    const journal = readFileSync(process.env.LEADS_JOURNAL_PATH!, "utf8");
    expect(journal).toContain("+7 999 123 45 67");
    expect(journal).not.toContain('"type":"delivered"');
  });

  it("tells the visitor to call when the lead could be neither saved nor delivered", async () => {
    // A path under a device file can never be created, so the journal write fails.
    process.env.LEADS_JOURNAL_PATH = "/dev/null/leads.jsonl";

    await expect(appRouter.createCaller(publicContext).leads.submit(validLead)).rejects.toThrow(/позвоните/);
  });
});
