/** Mirrors server/leadAttachments.ts: the server re-checks every file by its first bytes. */
export const DESIGN_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const DESIGN_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
export const DESIGN_FILE_REJECTED_MESSAGE = "Приложите PDF или изображение (JPG, PNG, WebP) размером до 20 МБ.";

const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXTENSIONS = /\.(pdf|jpe?g|png|webp)$/i;

/** Returns the reason the file cannot be attached, or null when it can. */
export function designFileProblem(file: Pick<File, "name" | "size" | "type">): string | null {
  const typeKnown = ACCEPTED_TYPES.has(file.type) || (!file.type && ACCEPTED_EXTENSIONS.test(file.name));
  if (!typeKnown || file.size === 0 || file.size > DESIGN_FILE_MAX_BYTES) return DESIGN_FILE_REJECTED_MESSAGE;
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}

/** File contents as base64, without the data: URL prefix. */
export function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}
