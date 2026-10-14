import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEstimate, estimateProblems, type Extraction } from "./compute";
import { normalizeExtraction } from "./extract";
import { clientMessage, enqueueEstimate, processEstimates, readJobs, type JobDeps } from "./jobs";
import { renderEstimatePdf } from "./pdf";
import { screedPrice } from "./priceList";
import { verifyMaxInitData } from "../maxInitData";

const base: Extraction = {
  object: "Квартира, ЖК Level",
  address: "ул. Кузнечная, 84",
  area: 57.22,
  ceilingHeight: 2.7,
  ceiling: "gkl",
  floorCoveringKnown: true,
  screedMm: null,
  quantities: { w_plaster: 180, w_paint: 150, el_socket: 60, el_cable: 400, c_frame: 50, f_spc: 50, t_wall: 30 },
  assumptions: ["стены по периметру"],
  notIncluded: ["LED-лента"],
  missingSheets: [],
};

describe("estimate pricing", () => {
  it("prices from the list, numbers sections and sums them", () => {
    const estimate = buildEstimate(base);
    const lines = estimate.sections.flatMap(section => section.lines);
    expect(lines.find(line => line.name.startsWith("Штукатурка"))?.sum).toBe(180 * 1_960);
    expect(estimate.total).toBe(estimate.sections.reduce((acc, s) => acc + s.total, 0));
    expect(estimate.sections[0].lines[0].no).toBe("1.1");
    // Always present: screed and temporary utilities; options show price only.
    expect(lines.some(line => line.name.startsWith("Цементно-песчаная стяжка"))).toBe(true);
    expect(lines.find(line => line.name.startsWith("Монтаж временной"))?.sum).toBe(20_000);
    expect(lines.find(line => line.name.startsWith("Утепление откосов"))).toMatchObject({ qty: null, sum: 0, note: "при необходимости" });
  });

  it("puts a stretch ceiling on a separate contract and drops plasterboard work", () => {
    const estimate = buildEstimate({ ...base, ceiling: "stretch" });
    const ceiling = estimate.sections.find(section => section.title === "Потолок")!;
    expect(ceiling.lines).toHaveLength(1);
    expect(ceiling.lines[0]).toMatchObject({ qty: 57.22, price: null, sum: 0, note: "отдельный договор" });
  });

  it("adds 200 ₽ per started 10 mm of screed above 70 mm", () => {
    expect(screedPrice(70).price).toBe(1_200);
    expect(screedPrice(90).price).toBe(1_600);
    expect(screedPrice(95).price).toBe(1_800);
    expect(screedPrice(null).price).toBe(1_200);
  });

  it("leaves a placeholder when the floor covering is unknown", () => {
    const estimate = buildEstimate({ ...base, floorCoveringKnown: false, quantities: { w_plaster: 180 } });
    const row = estimate.sections.flatMap(s => s.lines).find(line => line.name.startsWith("Монтаж инженерной доски"));
    expect(row).toMatchObject({ qty: null, sum: 0 });
  });

  it("refuses to send an estimate that looks misread", () => {
    expect(estimateProblems(buildEstimate({ ...base, area: 0 }))).not.toHaveLength(0);
    expect(estimateProblems(buildEstimate({ ...base, quantities: { w_plaster: 5000, t_wall: 900 } }))).not.toHaveLength(0);
  });

  it("accepts only known ids and sane numbers from the model", () => {
    const parsed = normalizeExtraction({ area: 60, ceiling: "weird", quantities: { w_plaster: 100, hacked: 1, w_paint: -5, el_cable: "400" } });
    expect(parsed.quantities).toEqual({ w_plaster: 100 });
    expect(parsed.ceiling).toBe("unknown");
  });

  it("renders a PDF", async () => {
    const pdf = await renderEstimatePdf(buildEstimate(base));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("estimate queue", () => {
  let dir = "";
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "estimates-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function deps(overrides: Partial<JobDeps> & { clock?: { t: number } } = {}) {
    const clock = overrides.clock ?? { t: Date.parse("2026-10-14T10:00:00Z") };
    const owner: string[] = [];
    const delivered: string[] = [];
    const value: JobDeps = {
      dir,
      now: () => clock.t,
      extract: async () => base,
      render: async () => Buffer.from("%PDF-test"),
      notifyOwner: async (_pdf, _name, html) => { owner.push(html); },
      deliver: async job => { delivered.push(job.delivery.kind); },
      autoSend: true,
      ...overrides,
    };
    return { value, owner, delivered, clock };
  }

  const queue = (now: number) =>
    enqueueEstimate(dir, { client: { name: "Анна", phone: "+7 900" }, delivery: { kind: "email", address: "a@b.ru" }, file: { name: "p.pdf", mimeType: "application/pdf", bytes: new Uint8Array([1, 2, 3]) } }, now, 72);

  it("reads the project at once, copies Egor, and sends to the client after 72 minutes", async () => {
    const h = deps();
    const job = queue(h.clock.t);
    await processEstimates(h.value);
    expect(readJobs(dir)[0].status).toBe("ready");
    expect(fs.existsSync(path.join(dir, job.id, "project"))).toBe(false);
    expect(h.owner[0]).toContain("Уйдёт клиенту на a@b.ru");
    expect(h.delivered).toHaveLength(0);

    h.clock.t += 71 * 60_000;
    await processEstimates(h.value);
    expect(h.delivered).toHaveLength(0);

    h.clock.t += 2 * 60_000;
    await processEstimates(h.value);
    expect(h.delivered).toEqual(["email"]);
    expect(readJobs(dir)[0].status).toBe("sent");
    await processEstimates(h.value);
    expect(h.delivered).toHaveLength(1);
  });

  it("holds a suspicious estimate and tells Egor instead of sending", async () => {
    const h = deps({ extract: async () => ({ ...base, area: 0 }) });
    queue(h.clock.t);
    await processEstimates(h.value);
    h.clock.t += 100 * 60_000;
    await processEstimates(h.value);
    expect(readJobs(dir)[0].status).toBe("held");
    expect(h.owner[0]).toContain("НЕ отправлена");
    expect(h.delivered).toHaveLength(0);
  });

  it("sends nothing to clients when automatic sending is off", async () => {
    const h = deps({ autoSend: false });
    queue(h.clock.t);
    await processEstimates(h.value);
    h.clock.t += 100 * 60_000;
    await processEstimates(h.value);
    expect(h.delivered).toHaveLength(0);
    expect(h.owner[0]).toContain("Автоотправка выключена");
  });

  it("gives up after three failed reads and tells Egor", async () => {
    const h = deps({ extract: async () => { throw new Error("API down"); } });
    queue(h.clock.t);
    for (let i = 0; i < 3; i++) await processEstimates(h.value);
    expect(readJobs(dir)[0].status).toBe("failed");
    expect(h.owner.at(-1)).toContain("Автосмета не получилась");
  });

  it("writes the client a short note with the total", () => {
    expect(clientMessage("Анна", 2_513_810, 43_932).replace(/\s/g, " ")).toContain("2 513 810 ₽");
  });
});

describe("MAX launch data", () => {
  const token = "bot-token";
  const sign = (pairs: Record<string, string>) => {
    const check = Object.keys(pairs).sort().map(key => `${key}=${pairs[key]}`).join("\n");
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const hash = createHmac("sha256", secret).update(check).digest("hex");
    return [...Object.entries(pairs).map(([k, v]) => `${k}=${encodeURIComponent(v)}`), `hash=${hash}`].join("&");
  };
  const now = Date.parse("2026-10-14T10:00:00Z");
  const fresh = { auth_date: String(now / 1000 - 60), query_id: "q1", user: JSON.stringify({ id: 4242, first_name: "Анна" }) };

  it("accepts genuine data and returns the user id", () => {
    expect(verifyMaxInitData(sign(fresh), token, now)).toEqual({ userId: 4242, firstName: "Анна" });
  });

  it("rejects a forged user, another bot's signature and stale data", () => {
    const forged = sign(fresh).replace("4242", "9999");
    expect(verifyMaxInitData(forged, token, now)).toBeNull();
    expect(verifyMaxInitData(sign(fresh), "other-token", now)).toBeNull();
    expect(verifyMaxInitData(sign({ ...fresh, auth_date: String(now / 1000 - 3 * 86400) }), token, now)).toBeNull();
    expect(verifyMaxInitData(undefined, token, now)).toBeNull();
  });
});
