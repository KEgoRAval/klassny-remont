import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLeadJournal } from "./leadJournal";

const sampleLead = {
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

describe("lead journal", () => {
  let dir = "";
  let file = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lead-journal-"));
    file = join(dir, "nested", "leads.jsonl");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes a lead to disk and reports it as waiting for delivery", async () => {
    const journal = createLeadJournal(file);

    const id = await journal.record(sampleLead);

    expect(readFileSync(file, "utf8")).toContain("+7 999 123 45 67");
    const pending = await journal.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id, lead: { name: "Анна", workEstimate: 4_000_000 } });
  });

  it("keeps the journal readable by the site user only", async () => {
    await createLeadJournal(file).record(sampleLead);

    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("stops reporting a lead once it is marked delivered", async () => {
    const journal = createLeadJournal(file);
    const first = await journal.record(sampleLead);
    const second = await journal.record({ ...sampleLead, name: "Борис" });

    await journal.markDelivered(first);

    const pending = await journal.pending();
    expect(pending.map(entry => entry.id)).toEqual([second]);
  });

  it("remembers delivery across restarts", async () => {
    const id = await createLeadJournal(file).record(sampleLead);
    await createLeadJournal(file).markDelivered(id);

    expect(await createLeadJournal(file).pending()).toEqual([]);
  });

  it("reports nothing when no lead has been written yet", async () => {
    expect(await createLeadJournal(file).pending()).toEqual([]);
  });

  it("skips a damaged line instead of losing the leads around it", async () => {
    const journal = createLeadJournal(file);
    const first = await journal.record(sampleLead);
    writeFileSync(file, `${readFileSync(file, "utf8")}{"type":"lead","id":\n`);
    const second = await journal.record({ ...sampleLead, name: "Борис" });

    expect((await journal.pending()).map(entry => entry.id)).toEqual([first, second]);
  });

  it("filters waiting leads by age", async () => {
    let now = new Date("2026-10-04T10:00:00Z");
    const journal = createLeadJournal(file, () => now);
    const old = await journal.record({ ...sampleLead, name: "Старая" });
    now = new Date("2026-10-04T12:00:00Z");
    const settled = await journal.record({ ...sampleLead, name: "Час назад" });
    now = new Date("2026-10-04T12:59:50Z");
    await journal.record({ ...sampleLead, name: "Только что" });
    now = new Date("2026-10-04T13:00:00Z");

    const notTooFresh = await journal.pending({ minAgeMs: 60_000 });
    expect(notTooFresh.map(entry => entry.id)).toEqual([old, settled]);

    const notTooOld = await journal.pending({ minAgeMs: 60_000, maxAgeMs: 2 * 60 * 60 * 1000 });
    expect(notTooOld.map(entry => entry.id)).toEqual([settled]);
  });
});
