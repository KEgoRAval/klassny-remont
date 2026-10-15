import path from "node:path";
import { createLeadConsent } from "./db";
import { createAttachmentStore } from "./leadAttachments";
import { createLeadJournal } from "./leadJournal";
import { retryPendingLeads, type LeadPipelineDeps } from "./leadPipeline";
import { sendLeadToTelegram } from "./telegram";

const RETRY_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Where leads are written before anything else happens to them. On the
 * server this must point outside the release directory (see
 * deployment/OPERATIONS.md), otherwise each release gets its own journal.
 */
export const leadJournalPath = () =>
  process.env.LEADS_JOURNAL_PATH || path.resolve(process.cwd(), "data", "leads.jsonl");

/** Channels the MAX bot administers, next to the journal so they survive releases. */
export const maxChannelsPath = () => path.join(path.dirname(leadJournalPath()), "max-channels.json");

/** Automatic estimate jobs, next to the journal so they survive releases. */
export const estimatesPath = () => path.join(path.dirname(leadJournalPath()), "estimates");

/** Client files waiting for Telegram, kept next to the journal so they survive releases too. */
export const leadAttachmentsPath = () => path.join(path.dirname(leadJournalPath()), "attachments");

export function leadPipelineDeps(): LeadPipelineDeps {
  return {
    journal: createLeadJournal(leadJournalPath()),
    attachments: createAttachmentStore(leadAttachmentsPath()),
    sendToTelegram: (lead, options) => sendLeadToTelegram(lead, fetch, undefined, options),
    recordConsent: lead =>
      createLeadConsent({
        name: lead.name,
        phone: lead.phone,
        service: lead.service,
        source: lead.source,
        personalDataConsent: 1,
        telegramConsent: 1,
        consentVersion: lead.consentVersion,
        policyVersion: lead.policyVersion,
      }),
  };
}

/** Periodically delivers leads that Telegram did not accept the first time. */
export function startLeadRetryLoop(intervalMs: number = RETRY_INTERVAL_MS): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const delivered = await retryPendingLeads(leadPipelineDeps());
      if (delivered > 0) console.log(`[Lead] delivered ${delivered} waiting lead(s) to Telegram`);
    } catch (error) {
      console.error("[Lead] retry loop failed", error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
