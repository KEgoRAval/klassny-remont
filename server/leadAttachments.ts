import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Telegram bots may send files up to 50 MB; design projects above 20 MB go by messenger instead. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** Length of MAX_ATTACHMENT_BYTES once encoded as base64 for the JSON request. */
export const MAX_ATTACHMENT_BASE64_LENGTH = Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4;

export const ATTACHMENT_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AttachmentType = keyof typeof ATTACHMENT_EXTENSIONS;

/** What the journal and the Telegram message know about a client's file. The bytes live in the store. */
export type LeadAttachment = {
  fileName: string;
  mimeType: AttachmentType;
  size: number;
  /** File name inside the attachment store; absent when the file could not be saved. */
  storedAs?: string;
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, i) => bytes[offset + i] === byte);

/**
 * The type is taken from the file's first bytes, never from the browser or the
 * file name, so a renamed executable is not forwarded as a "PDF".
 */
export function detectAttachmentType(bytes: Uint8Array): AttachmentType | undefined {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  return undefined;
}

/** A name that is safe to show in Telegram and to send as a file name, with the extension of the real type. */
export function safeAttachmentName(name: string, type: AttachmentType): string {
  const extension = ATTACHMENT_EXTENSIONS[type];
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "")
    .replace(/\.[^.]*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${base || "design-project"}.${extension}`;
}

export type LeadAttachmentStore = {
  /** Writes the file and returns its name inside the store. */
  save(bytes: Uint8Array, type: AttachmentType): Promise<string>;
  read(storedAs: string): Promise<Uint8Array>;
  remove(storedAs: string): Promise<void>;
};

const STORED_NAME = /^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

/**
 * Client files waiting for delivery to Telegram. A file is kept only until
 * Telegram has it, then deleted. Files hold personal data, so the folder and
 * the files are readable by the site user only.
 */
export function createAttachmentStore(dir: string): LeadAttachmentStore {
  const resolveStored = (storedAs: string) => {
    // Names come back from the journal; never let one point outside the folder.
    if (!STORED_NAME.test(storedAs)) throw new Error(`Unexpected attachment name: ${storedAs}`);
    return path.join(dir, storedAs);
  };

  return {
    async save(bytes, type) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const storedAs = `${randomUUID()}.${ATTACHMENT_EXTENSIONS[type]}`;
      await writeFile(path.join(dir, storedAs), bytes, { mode: 0o600, flag: "wx" });
      return storedAs;
    },
    async read(storedAs) {
      return readFile(resolveStored(storedAs));
    },
    async remove(storedAs) {
      await rm(resolveStored(storedAs), { force: true });
    },
  };
}
