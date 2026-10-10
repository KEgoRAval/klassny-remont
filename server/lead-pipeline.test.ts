import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAttachmentStore, type LeadAttachmentStore } from "./leadAttachments";
import { createLeadJournal, type LeadJournal } from "./leadJournal";
import { retryPendingLeads, submitLead, type LeadPipelineDeps } from "./leadPipeline";
import type { LeadNotification } from "./telegram";

const sampleLead: LeadNotification = {
  name: "Анна",
  phone: "+7 999 123 45 67",
  service: "Ремонт квартиры под ключ",
  area: 100,
  materialLabel: "Рациональный",
  workEstimate: 4_000_000,
  source: "calculator",
  personalDataConsent: true,
  telegramConsent: true,
  consentVersion: "2026-09-17",
  policyVersion: "2026-09-17",
};

const telegramDown = async () => {
  throw new Error("Telegram delivery failed: 502");
};

describe("lead pipeline", () => {
  let dir = "";
  let journal: LeadJournal;
  let now = new Date("2026-10-04T12:00:00Z");
  let attachments: LeadAttachmentStore;
  let sent: Array<{ lead: LeadNotification; delayedSince?: string; attachment?: Uint8Array }> = [];
  let consents: string[] = [];
  const deps = (overrides: Partial<LeadPipelineDeps> = {}): LeadPipelineDeps => ({
    journal,
    attachments,
    sendToTelegram: async (lead, options) => {
      sent.push({ lead, delayedSince: options?.delayedSince, attachment: options?.attachment });
    },
    recordConsent: async lead => {
      consents.push(lead.phone);
    },
    log: () => {},
    ...overrides,
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lead-pipeline-"));
    now = new Date("2026-10-04T12:00:00Z");
    journal = createLeadJournal(join(dir, "leads.jsonl"), () => now);
    attachments = createAttachmentStore(join(dir, "attachments"));
    sent = [];
    consents = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("has the lead on disk before Telegram is contacted", async () => {
    let waitingWhenTelegramWasCalled = -1;

    await submitLead(sampleLead, deps({
      sendToTelegram: async () => {
        waitingWhenTelegramWasCalled = (await journal.pending()).length;
      },
    }));

    expect(waitingWhenTelegramWasCalled).toBe(1);
  });

  it("accepts the lead and keeps it waiting when Telegram is down", async () => {
    const result = await submitLead(sampleLead, deps({ sendToTelegram: telegramDown }));

    expect(result).toEqual({ saved: true, delivered: false });
    expect((await journal.pending()).map(entry => entry.lead.phone)).toEqual(["+7 999 123 45 67"]);
  });

  it("clears the lead from the waiting list once Telegram accepts it", async () => {
    const result = await submitLead(sampleLead, deps());

    expect(result).toEqual({ saved: true, delivered: true });
    expect(sent).toHaveLength(1);
    expect(await journal.pending()).toEqual([]);
  });

  it("still delivers the lead when the journal cannot be written", async () => {
    const brokenJournal: LeadJournal = {
      record: async () => {
        throw new Error("EACCES");
      },
      markDelivered: async () => {},
      pending: async () => [],
    };

    const result = await submitLead(sampleLead, deps({ journal: brokenJournal }));

    expect(result).toEqual({ saved: false, delivered: true });
    expect(sent).toHaveLength(1);
  });

  it("rejects the submission only when the lead was neither saved nor delivered", async () => {
    const brokenJournal: LeadJournal = {
      record: async () => {
        throw new Error("EACCES");
      },
      markDelivered: async () => {},
      pending: async () => [],
    };

    await expect(submitLead(sampleLead, deps({ journal: brokenJournal, sendToTelegram: telegramDown }))).rejects.toThrow();
  });

  it("does not fail the submission when the consent record cannot be stored", async () => {
    const result = await submitLead(sampleLead, deps({
      recordConsent: async () => {
        throw new Error("database unavailable");
      },
    }));

    expect(result).toEqual({ saved: true, delivered: true });
  });

  it("records the consent even when Telegram is down", async () => {
    await submitLead(sampleLead, deps({ sendToTelegram: telegramDown }));

    expect(consents).toEqual(["+7 999 123 45 67"]);
  });

  describe("retrying waiting leads", () => {
    it("delivers a waiting lead later and says when it was received", async () => {
      await submitLead(sampleLead, deps({ sendToTelegram: telegramDown }));
      now = new Date("2026-10-04T12:05:00Z");

      const delivered = await retryPendingLeads(deps());

      expect(delivered).toBe(1);
      expect(sent).toHaveLength(1);
      expect(sent[0].lead.phone).toBe("+7 999 123 45 67");
      expect(sent[0].delayedSince).toBe("2026-10-04T12:00:00.000Z");
      expect(await journal.pending()).toEqual([]);
    });

    it("leaves the lead waiting when Telegram is still down", async () => {
      await submitLead(sampleLead, deps({ sendToTelegram: telegramDown }));
      now = new Date("2026-10-04T12:05:00Z");

      const delivered = await retryPendingLeads(deps({ sendToTelegram: telegramDown }));

      expect(delivered).toBe(0);
      expect(await journal.pending()).toHaveLength(1);
    });

    it("does not touch a lead whose first delivery attempt may still be running", async () => {
      await submitLead(sampleLead, deps({ sendToTelegram: telegramDown }));
      now = new Date("2026-10-04T12:00:20Z");

      expect(await retryPendingLeads(deps())).toBe(0);
      expect(sent).toHaveLength(0);
    });

    it("does not resend a lead that was already delivered", async () => {
      await submitLead(sampleLead, deps());
      now = new Date("2026-10-04T12:05:00Z");

      expect(await retryPendingLeads(deps())).toBe(0);
      expect(sent).toHaveLength(1);
    });

    it("does not send the same lead twice when the delivery mark cannot be written", async () => {
      await submitLead(sampleLead, deps({ sendToTelegram: telegramDown }));
      now = new Date("2026-10-04T12:05:00Z");
      const cannotMark: LeadJournal = {
        ...journal,
        markDelivered: async () => {
          throw new Error("ENOSPC");
        },
      };

      await retryPendingLeads(deps({ journal: cannotMark }));
      await retryPendingLeads(deps({ journal: cannotMark }));

      expect(sent).toHaveLength(1);
    });
  });

  describe("with an attached design project", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 design project");
    const leadWithFile: LeadNotification = {
      ...sampleLead,
      source: "contact",
      attachment: { fileName: "Проект.pdf", mimeType: "application/pdf", size: pdf.length },
    };
    const storedFiles = () => (existsSync(join(dir, "attachments")) ? readdirSync(join(dir, "attachments")) : []);

    it("stores the file before the lead is journaled and sends both together", async () => {
      let filesWhenJournaled = -1;
      const watching: LeadJournal = {
        ...journal,
        record: async lead => {
          filesWhenJournaled = storedFiles().length;
          return journal.record(lead);
        },
      };

      await submitLead(leadWithFile, deps({ journal: watching }), pdf);

      expect(filesWhenJournaled).toBe(1);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.attachment).toEqual(pdf);
      expect(sent[0]?.lead.attachment?.storedAs).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    });

    it("deletes the server copy once Telegram has the file", async () => {
      await submitLead(leadWithFile, deps(), pdf);

      expect(storedFiles()).toEqual([]);
    });

    it("keeps the file while Telegram is down and sends it with the retried lead", async () => {
      await submitLead(leadWithFile, deps({ sendToTelegram: telegramDown }), pdf);
      expect(storedFiles()).toHaveLength(1);
      now = new Date("2026-10-04T12:05:00Z");

      expect(await retryPendingLeads(deps())).toBe(1);

      expect(new Uint8Array(sent[0]!.attachment!)).toEqual(pdf);
      expect(sent[0]?.delayedSince).toBe("2026-10-04T12:00:00.000Z");
      expect(storedFiles()).toEqual([]);
    });

    it("still delivers the lead when the file cannot be stored", async () => {
      const brokenStore: LeadAttachmentStore = {
        ...attachments,
        save: async () => {
          throw new Error("ENOSPC");
        },
      };

      const result = await submitLead(leadWithFile, deps({ attachments: brokenStore }), pdf);

      expect(result).toEqual({ saved: true, delivered: true });
      expect(sent[0]?.attachment).toEqual(pdf);
      expect(sent[0]?.lead.attachment?.storedAs).toBeUndefined();
    });

    it("retries a lead whose file went missing, telling the manager instead of losing the lead", async () => {
      await submitLead(leadWithFile, deps({ sendToTelegram: telegramDown }), pdf);
      rmSync(join(dir, "attachments"), { recursive: true, force: true });
      now = new Date("2026-10-04T12:05:00Z");

      expect(await retryPendingLeads(deps())).toBe(1);
      expect(sent[0]?.attachment).toBeUndefined();
      expect(sent[0]?.lead.attachment?.fileName).toBe("Проект.pdf");
    });
  });
});
