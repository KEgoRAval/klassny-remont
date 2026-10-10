import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAttachmentStore,
  detectAttachmentType,
  MAX_ATTACHMENT_BASE64_LENGTH,
  MAX_ATTACHMENT_BYTES,
  safeAttachmentName,
} from "./leadAttachments";
import { ATTACHMENT_CONSENT_MESSAGE, ATTACHMENT_REJECTED_MESSAGE, leadInput, readLeadAttachment } from "./routers";

const bytes = (...values: number[]) => new Uint8Array(values);
const pdf = new TextEncoder().encode("%PDF-1.7\n%design project");
const base64 = (data: Uint8Array) => Buffer.from(data).toString("base64");

describe("design project files", () => {
  it("recognises PDF and images by their first bytes", () => {
    expect(detectAttachmentType(pdf)).toBe("application/pdf");
    expect(detectAttachmentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectAttachmentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectAttachmentType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
  });

  it("does not trust a name: an executable called .pdf is not a PDF", () => {
    expect(detectAttachmentType(new TextEncoder().encode("MZ\u0090\u0000"))).toBeUndefined();
    expect(detectAttachmentType(new TextEncoder().encode("<html>"))).toBeUndefined();
    expect(detectAttachmentType(bytes())).toBeUndefined();
  });

  it("keeps a readable name but drops folders, control characters and a misleading extension", () => {
    expect(safeAttachmentName("Проект кухни.pdf", "application/pdf")).toBe("Проект кухни.pdf");
    expect(safeAttachmentName("C:\\Users\\Анна\\план.PDF", "application/pdf")).toBe("план.pdf");
    expect(safeAttachmentName("../../etc/passwd", "application/pdf")).toBe("passwd.pdf");
    expect(safeAttachmentName("фото.pdf", "image/jpeg")).toBe("фото.jpg");
    expect(safeAttachmentName("a\u0000b\nc.pdf", "application/pdf")).toBe("abc.pdf");
    expect(safeAttachmentName(".pdf", "application/pdf")).toBe("design-project.pdf");
  });

  it("caps the base64 length at the encoded size of a 20 MB file", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_ATTACHMENT_BASE64_LENGTH).toBe(base64(new Uint8Array(MAX_ATTACHMENT_BYTES)).length);
  });
});

describe("attachment store", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lead-attachments-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("saves, reads back and removes a file", async () => {
    const store = createAttachmentStore(join(dir, "attachments"));

    const storedAs = await store.save(pdf, "application/pdf");

    expect(storedAs).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(new Uint8Array(await store.read(storedAs))).toEqual(pdf);
    await store.remove(storedAs);
    expect(readdirSync(join(dir, "attachments"))).toEqual([]);
  });

  it.skipIf(process.platform === "win32")("keeps files readable by the site user only", async () => {
    const store = createAttachmentStore(join(dir, "attachments"));
    const storedAs = await store.save(pdf, "application/pdf");

    expect(statSync(join(dir, "attachments", storedAs)).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, "attachments")).mode & 0o777).toBe(0o700);
  });

  it("refuses names from the journal that point outside its folder", async () => {
    const store = createAttachmentStore(join(dir, "attachments"));

    await expect(store.read("../leads.jsonl")).rejects.toThrow("Unexpected attachment name");
    await expect(store.remove("/etc/passwd")).rejects.toThrow("Unexpected attachment name");
  });
});

describe("leads.submit attachment input", () => {
  const validLead = {
    name: "Анна",
    phone: "+7 999 123 45 67",
    service: "Дизайн-проект + ремонт",
    area: 100,
    materialLabel: "Рациональный",
    workEstimate: 4_000_000,
    source: "contact" as const,
    personalDataConsent: true as const,
    telegramConsent: true as const,
    consentVersion: "2026-10-10" as const,
    policyVersion: "2026-10-10" as const,
  };
  const withFile = (data: Uint8Array, fileName = "план.pdf") => ({ ...validLead, attachment: { fileName, data: base64(data) } });

  it("accepts a lead with or without a file", () => {
    expect(leadInput.safeParse(validLead).success).toBe(true);
    expect(leadInput.safeParse({ ...validLead, attachment: { fileName: "план.pdf", data: base64(pdf) } }).success).toBe(true);
  });

  it("rejects an oversized upload before decoding it", () => {
    const tooLong = "A".repeat(MAX_ATTACHMENT_BASE64_LENGTH + 4);
    expect(leadInput.safeParse({ ...validLead, attachment: { fileName: "план.pdf", data: tooLong } }).success).toBe(false);
  });

  it("describes an accepted file by its real type and size", () => {
    const file = readLeadAttachment(withFile(pdf, "план кухни.PDF"));

    expect(file?.description).toEqual({ fileName: "план кухни.pdf", mimeType: "application/pdf", size: pdf.length });
    expect(new Uint8Array(file!.bytes)).toEqual(pdf);
  });

  it("turns away a file that is not a PDF or an image with a message the form can show", () => {
    const fake = withFile(new TextEncoder().encode("MZ not a pdf"), "проект.pdf");

    expect(() => readLeadAttachment(fake)).toThrow(ATTACHMENT_REJECTED_MESSAGE);
  });

  it("needs no file at all, under any consent edition", () => {
    expect(readLeadAttachment(validLead)).toBeUndefined();
    expect(readLeadAttachment({ ...validLead, consentVersion: "2026-10-04", policyVersion: "2026-10-04" })).toBeUndefined();
  });

  it("refuses a file sent under a consent edition that does not name attached files", () => {
    const fromOldPage = { ...withFile(pdf), consentVersion: "2026-10-04" as const, policyVersion: "2026-10-04" as const };

    expect(() => readLeadAttachment(fromOldPage)).toThrow(ATTACHMENT_CONSENT_MESSAGE);
  });
});
