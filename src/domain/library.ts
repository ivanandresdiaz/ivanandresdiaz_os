import { referenceKindOf, type ReferenceKind } from "./references";

/**
 * The Library: Topics, their Creators and their Samples. Good content Ivan
 * chose himself, apart from the Principles. No goals, no Likes, no record.
 */
export const MAX_LIBRARY_NAME = 120;
export const MAX_SAMPLE_TITLE = 200;
export const MAX_SAMPLE_BYTES = 200 * 1024 * 1024;

/** A Sample is a reel, a video or an image; audio belongs to the Principles. */
export type SampleKind = Exclude<ReferenceKind, "audio">;

export function sampleKindOf(contentType: string): SampleKind | null {
  const kind = referenceKindOf(contentType);
  return kind === "image" || kind === "video" ? kind : null;
}

export type SampleFileProblem = "unsupported-type" | "empty" | "too-large";

export function validateSampleFile(file: { contentType: string; size: number }): SampleFileProblem | null {
  if (!sampleKindOf(file.contentType)) return "unsupported-type";
  if (file.size <= 0) return "empty";
  if (file.size > MAX_SAMPLE_BYTES) return "too-large";
  return null;
}

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** What the file picker offers: the types, and the extensions for systems that name them differently. */
export const ACCEPTED_SAMPLE_TYPES = [
  ...Object.keys(EXTENSION),
  ...[".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"],
];

/** Everything for a Creator lives under its prefix, so a Creator that moves Topics keeps its files where they are. */
export function samplePrefix(creatorId: string): string {
  return `library/${creatorId}/`;
}

export function sampleKey(creatorId: string, fileId: string, contentType: string): string {
  const ext = EXTENSION[contentType];
  if (!ext) throw new Error(`Unsupported Sample type: ${contentType}`);
  return `${samplePrefix(creatorId)}${fileId}.${ext}`;
}

/** Instagram and YouTube handles compare without case or a leading @. */
export function normalizeAccount(account: string | null | undefined): string | null {
  const clean = account?.trim().replace(/^@/, "").toLowerCase();
  return clean || null;
}

/** The Creator a Clip from `author` belongs to, if one already posts from that account. */
export function creatorForAccount<T extends { account: string | null }>(
  creators: readonly T[],
  author: string | null,
): T | null {
  const wanted = normalizeAccount(author);
  if (!wanted) return null;
  return creators.find((c) => normalizeAccount(c.account) === wanted) ?? null;
}

export type PracticeOrder = "random" | "in-order";

export type Random = () => number;

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * One lap of a Practice: every chosen Sample once. In order it is the Library's
 * order (Creator by Creator, as they are listed); at random it is shuffled, and
 * a new lap never starts with the Sample the last one ended on.
 */
export function practiceLap<T extends { id: string }>(
  samples: readonly T[],
  order: PracticeOrder,
  random: Random,
  lastId: string | null = null,
): T[] {
  if (order === "in-order") return [...samples];
  const lap = shuffle(samples, random);
  if (lap.length > 1 && lap[0].id === lastId) {
    const swap = 1 + Math.floor(random() * (lap.length - 1));
    [lap[0], lap[swap]] = [lap[swap], lap[0]];
  }
  return lap;
}

/** A new Sample goes first: one position below the lowest. */
export function firstPosition(lowest: number | null): number {
  return lowest === null ? 0 : lowest - 1;
}
