import type { LeadAttachmentStore } from "./leadAttachments";
import type { LeadJournal } from "./leadJournal";
import type { LeadDeliveryOptions, LeadNotification } from "./telegram";

export type LeadPipelineDeps = {
  journal: LeadJournal;
  /** Keeps a client's file until Telegram has it. */
  attachments: LeadAttachmentStore;
  sendToTelegram: (lead: LeadNotification, options?: LeadDeliveryOptions) => Promise<void>;
  recordConsent: (lead: LeadNotification) => Promise<void>;
  log?: (message: string, error: unknown) => void;
};

/** A first delivery attempt is given this long before a retry may pick the lead up. */
const FIRST_ATTEMPT_WINDOW_MS = 60_000;
/** Leads older than this are left for a person to pick up from the journal. */
const RETRY_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

// Leads Telegram accepted in this process. Guards against a second message if
// the delivery mark could not be written to the journal.
const deliveredInThisProcess = new Set<string>();

const defaultLog = (message: string, error: unknown) => console.error(message, error);

/**
 * Accepts a site lead: the lead is written to the journal first, then sent to
 * Telegram. A lead that is on disk is accepted even when Telegram is down —
 * retryPendingLeads delivers it later. The submission fails only when the
 * lead was neither saved nor delivered. An attached file is stored before the
 * lead is journaled, so a retry can send it too; it is deleted once Telegram
 * has it.
 */
export async function submitLead(
  submitted: LeadNotification,
  deps: LeadPipelineDeps,
  file?: Uint8Array,
): Promise<{ saved: boolean; delivered: boolean }> {
  const log = deps.log ?? defaultLog;

  let lead = submitted;
  if (file && lead.attachment) {
    try {
      const storedAs = await deps.attachments.save(file, lead.attachment.mimeType);
      lead = { ...lead, attachment: { ...lead.attachment, storedAs } };
    } catch (error) {
      log("[Lead] could not store the attached file", error);
    }
  }

  let id: string | undefined;
  try {
    id = await deps.journal.record(lead);
  } catch (error) {
    log("[Lead] could not write the lead to the journal", error);
  }

  let delivered = false;
  try {
    await deps.sendToTelegram(lead, { attachment: file });
    delivered = true;
  } catch (error) {
    log("[Lead] Telegram delivery failed", error);
  }

  if (id && delivered) {
    deliveredInThisProcess.add(id);
    try {
      await deps.journal.markDelivered(id);
    } catch (error) {
      log("[Lead] could not mark the lead as delivered", error);
    }
  }

  if (delivered) await removeDeliveredFile(lead, deps, log);

  if (!id && !delivered) {
    throw new Error("Lead was neither saved nor delivered");
  }

  try {
    await deps.recordConsent(lead);
  } catch (error) {
    log("[Lead] could not store the consent record", error);
  }

  return { saved: Boolean(id), delivered };
}

/** Sends leads that are still waiting in the journal. Returns how many were delivered. */
export async function retryPendingLeads(deps: LeadPipelineDeps): Promise<number> {
  const log = deps.log ?? defaultLog;
  const waiting = await deps.journal.pending({ minAgeMs: FIRST_ATTEMPT_WINDOW_MS, maxAgeMs: RETRY_HORIZON_MS });

  let deliveredCount = 0;
  for (const entry of waiting) {
    if (deliveredInThisProcess.has(entry.id)) continue;
    const storedAs = entry.lead.attachment?.storedAs;
    let file: Uint8Array | undefined;
    if (storedAs) {
      try {
        file = await deps.attachments.read(storedAs);
      } catch (error) {
        log("[Lead] the attached file of a waiting lead is missing", error);
      }
    }
    try {
      await deps.sendToTelegram(entry.lead, { delayedSince: entry.receivedAt, attachment: file });
    } catch (error) {
      log("[Lead] retry of a waiting lead failed", error);
      continue;
    }
    deliveredInThisProcess.add(entry.id);
    deliveredCount += 1;
    await removeDeliveredFile(entry.lead, deps, log);
    try {
      await deps.journal.markDelivered(entry.id);
    } catch (error) {
      log("[Lead] could not mark the lead as delivered", error);
    }
  }
  return deliveredCount;
}

/** Telegram holds the file now; the copy on the server is no longer needed. */
async function removeDeliveredFile(lead: LeadNotification, deps: LeadPipelineDeps, log: (message: string, error: unknown) => void) {
  const storedAs = lead.attachment?.storedAs;
  if (!storedAs) return;
  try {
    await deps.attachments.remove(storedAs);
  } catch (error) {
    log("[Lead] could not delete a delivered file", error);
  }
}
