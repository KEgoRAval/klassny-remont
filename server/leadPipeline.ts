import type { LeadJournal } from "./leadJournal";
import type { LeadNotification } from "./telegram";

export type LeadPipelineDeps = {
  journal: LeadJournal;
  sendToTelegram: (lead: LeadNotification, options?: { delayedSince?: string }) => Promise<void>;
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
 * lead was neither saved nor delivered.
 */
export async function submitLead(lead: LeadNotification, deps: LeadPipelineDeps): Promise<{ saved: boolean; delivered: boolean }> {
  const log = deps.log ?? defaultLog;

  let id: string | undefined;
  try {
    id = await deps.journal.record(lead);
  } catch (error) {
    log("[Lead] could not write the lead to the journal", error);
  }

  let delivered = false;
  try {
    await deps.sendToTelegram(lead);
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
    try {
      await deps.sendToTelegram(entry.lead, { delayedSince: entry.receivedAt });
    } catch (error) {
      log("[Lead] retry of a waiting lead failed", error);
      continue;
    }
    deliveredInThisProcess.add(entry.id);
    deliveredCount += 1;
    try {
      await deps.journal.markDelivered(entry.id);
    } catch (error) {
      log("[Lead] could not mark the lead as delivered", error);
    }
  }
  return deliveredCount;
}
