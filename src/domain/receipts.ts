/**
 * Receipts: the photos and PDFs that back a movement (an invoice, a payment
 * proof). Kept as they are, never shrunk, so they stay readable.
 */

/** The files a Receipt can be, and the extension each is stored with. */
export const RECEIPT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPTS = 10;
export const MAX_RECEIPT_NAME = 200;

export const RECEIPT_PREFIX = "money/receipts/";
const KEY_PATTERN = /^money\/receipts\/[0-9a-f-]{36}\.(pdf|jpg|png|webp|heic|heif)$/;

/** Why a file can't be a Receipt, in words, or null when it can. */
export function receiptProblem(file: { contentType: string; size: number }): string | null {
  if (!(file.contentType in RECEIPT_TYPES)) return "Only photos and PDFs.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_RECEIPT_BYTES) return "Up to 10 MB per file.";
  return null;
}

/** Where a new Receipt is stored; `id` is a fresh UUID. */
export function receiptKey(id: string, contentType: string): string {
  return `${RECEIPT_PREFIX}${id}.${RECEIPT_TYPES[contentType]}`;
}

/** A key this app made for a Receipt, and nothing else in the bucket. */
export function isReceiptKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** The browser's type for a file, falling back to its extension (some phones send none). */
export function receiptContentType(file: { type: string; name: string }): string {
  if (file.type in RECEIPT_TYPES) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "jpeg") return "image/jpeg";
  const found = Object.entries(RECEIPT_TYPES).find(([, e]) => e === ext);
  return found ? found[0] : file.type;
}

/** Whether a browser shows it as a picture; HEIC only opens as a file. */
export function isPicture(contentType: string): boolean {
  return contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp";
}
