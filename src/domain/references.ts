/**
 * References: images or videos Ivan uploads to a Principle because they
 * carry it for him. Any number per Principle, in the order he chooses.
 */
export const MAX_REFERENCE_BYTES = 200 * 1024 * 1024;

/** How long an image stays on screen in the story viewer. */
export const IMAGE_STORY_MS = 6000;

/** The muted loop a video tile previews. */
export const TILE_PREVIEW_SECONDS = 2;

export type ReferenceKind = "image" | "video";

const EXTENSIONS: Record<string, { kind: ReferenceKind; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
};

export const ACCEPTED_REFERENCE_TYPES = Object.keys(EXTENSIONS);

export type ReferenceFileProblem = "unsupported-type" | "empty" | "too-large";

export function validateReferenceFile(file: { contentType: string; size: number }): ReferenceFileProblem | null {
  if (!EXTENSIONS[file.contentType]) return "unsupported-type";
  if (file.size <= 0) return "empty";
  if (file.size > MAX_REFERENCE_BYTES) return "too-large";
  return null;
}

export function referenceKindOf(contentType: string): ReferenceKind | null {
  return EXTENSIONS[contentType]?.kind ?? null;
}

/** Storage key for a new Reference file. Everything for a Principle lives under its prefix. */
export function referenceKey(principleId: string, fileId: string, contentType: string): string {
  const entry = EXTENSIONS[contentType];
  if (!entry) throw new Error(`Unsupported Reference type: ${contentType}`);
  return `${referencePrefix(principleId)}${fileId}.${entry.ext}`;
}

export function referencePrefix(principleId: string): string {
  return `principles/${principleId}/references/`;
}

/** Moves the item at `from` to `to`, returning a new order. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
