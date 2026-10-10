import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGN_FILE_MAX_BYTES, DESIGN_FILE_REJECTED_MESSAGE, designFileProblem, formatFileSize } from "./designFile";

const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const attachments = readFileSync(resolve(process.cwd(), "server/leadAttachments.ts"), "utf8");

describe("design project file in the contact form", () => {
  it("accepts a PDF or an image up to 20 MB", () => {
    expect(designFileProblem({ name: "план.pdf", size: 3_000_000, type: "application/pdf" })).toBeNull();
    expect(designFileProblem({ name: "фото.jpg", size: 500_000, type: "image/jpeg" })).toBeNull();
    expect(designFileProblem({ name: "план.pdf", size: DESIGN_FILE_MAX_BYTES, type: "" })).toBeNull();
  });

  it("explains why a file cannot be attached", () => {
    expect(designFileProblem({ name: "план.pdf", size: DESIGN_FILE_MAX_BYTES + 1, type: "application/pdf" })).toBe(DESIGN_FILE_REJECTED_MESSAGE);
    expect(designFileProblem({ name: "план.dwg", size: 1000, type: "application/acad" })).toBe(DESIGN_FILE_REJECTED_MESSAGE);
    expect(designFileProblem({ name: "пусто.pdf", size: 0, type: "application/pdf" })).toBe(DESIGN_FILE_REJECTED_MESSAGE);
  });

  it("uses the same limit and message as the server", () => {
    expect(attachments).toContain("export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;");
    expect(routers).toContain(`"${DESIGN_FILE_REJECTED_MESSAGE}"`);
  });

  it("shows sizes the way people read them", () => {
    expect(formatFileSize(300)).toBe("1 КБ");
    expect(formatFileSize(250 * 1024)).toBe("250 КБ");
    expect(formatFileSize(3_355_443)).toBe("3,2 МБ");
  });
});
