/**
 * References: images, videos or audios Ivan uploads to a Principle because they
 * carry it for him. Any number per Principle, in the order he chooses.
 */
export const MAX_REFERENCE_BYTES = 200 * 1024 * 1024;

export const MAX_REFERENCE_TITLE = 200;

/** How long an image stays on screen in the story viewer. */
export const IMAGE_STORY_MS = 6000;

/** The muted loop a video tile previews. */
export const TILE_PREVIEW_SECONDS = 2;

/** How far the audio skip buttons jump. */
export const AUDIO_SKIP_SECONDS = 15;

export type ReferenceKind = "image" | "video" | "audio";

const EXTENSIONS: Record<string, { kind: ReferenceKind; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/x-m4a": { kind: "audio", ext: "m4a" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/opus": { kind: "audio", ext: "opus" },
  "audio/wav": { kind: "audio", ext: "wav" },
  "audio/x-wav": { kind: "audio", ext: "wav" },
};

/** Browsers and operating systems name some types differently, or not at all; the extension decides then. */
const TYPE_BY_FILE_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
};

export const ACCEPTED_REFERENCE_TYPES = [
  ...Object.keys(EXTENSIONS),
  ...Object.keys(TYPE_BY_FILE_EXTENSION).map((ext) => `.${ext}`),
];

export type ReferenceFileProblem = "unsupported-type" | "empty" | "too-large";

export function validateReferenceFile(file: { contentType: string; size: number }): ReferenceFileProblem | null {
  if (!EXTENSIONS[file.contentType]) return "unsupported-type";
  if (file.size <= 0) return "empty";
  if (file.size > MAX_REFERENCE_BYTES) return "too-large";
  return null;
}

/** The content type to store a picked file under: its own when known, otherwise the one its extension implies. */
export function referenceContentType(file: { type: string; name: string }): string {
  if (EXTENSIONS[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_FILE_EXTENSION[ext] ?? file.type;
}

export function referenceKindOf(contentType: string): ReferenceKind | null {
  return EXTENSIONS[contentType]?.kind ?? null;
}

/** A Reference's starting title: the file name without its extension. */
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim().slice(0, MAX_REFERENCE_TITLE);
}

/** `9:48`, or `1:02:05` past an hour. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Where a skip of `delta` seconds lands, kept inside the audio. */
export function skipTo(current: number, delta: number, duration: number): number {
  const end = Number.isFinite(duration) ? duration : Infinity;
  return Math.min(Math.max(0, current + delta), end);
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
