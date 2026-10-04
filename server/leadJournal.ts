import { randomUUID } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import type { LeadNotification } from "./telegram";

export type JournaledLead = {
  id: string;
  receivedAt: string;
  lead: LeadNotification;
};

export type LeadJournal = {
  /** Writes the lead to disk and returns its id. */
  record(lead: LeadNotification): Promise<string>;
  markDelivered(id: string): Promise<void>;
  /** Leads that were written but not yet marked delivered, oldest first. */
  pending(options?: { minAgeMs?: number; maxAgeMs?: number }): Promise<JournaledLead[]>;
};

type JournalEvent =
  | ({ type: "lead" } & JournaledLead)
  | { type: "delivered"; id: string; at: string };

/**
 * Append-only journal of site leads, one JSON event per line. A lead is
 * written here before any attempt to notify anyone, so a failed notification
 * never loses it. The file holds names and phone numbers: it is created
 * readable by the site user only.
 */
export function createLeadJournal(filePath: string, now: () => Date = () => new Date()): LeadJournal {
  const append = async (event: JournalEvent) => {
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const handle = await open(filePath, "a", 0o600);
    try {
      await handle.appendFile(`${JSON.stringify(event)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  };

  const readEvents = async (): Promise<JournalEvent[]> => {
    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const events: JournalEvent[] = [];
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as JournalEvent;
        if (event && typeof event.id === "string" && (event.type === "lead" || event.type === "delivered")) events.push(event);
      } catch {
        // A line cut short by a crash must not hide the leads around it.
      }
    }
    return events;
  };

  return {
    async record(lead) {
      const id = randomUUID();
      await append({ type: "lead", id, receivedAt: now().toISOString(), lead });
      return id;
    },

    async markDelivered(id) {
      await append({ type: "delivered", id, at: now().toISOString() });
    },

    async pending({ minAgeMs = 0, maxAgeMs = Number.POSITIVE_INFINITY } = {}) {
      const events = await readEvents();
      const delivered = new Set(events.filter(event => event.type === "delivered").map(event => event.id));
      const current = now().getTime();
      return events
        .filter((event): event is { type: "lead" } & JournaledLead => event.type === "lead")
        .filter(event => !delivered.has(event.id))
        .filter(event => {
          const age = current - new Date(event.receivedAt).getTime();
          return age >= minAgeMs && age <= maxAgeMs;
        })
        .map(({ id, receivedAt, lead }) => ({ id, receivedAt, lead }));
    },
  };
}
