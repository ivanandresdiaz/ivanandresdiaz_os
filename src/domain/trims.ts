/**
 * Trim: cutting the start, the end or both off the video or audio of a Sample
 * or a Reference (an ad, the TikTok logo at the end). The cut is real: Cloud
 * Run re-encodes the file without them (worker/clips/trim.py) and the new file
 * replaces the old one, which is thrown away. See GLOSSARY.md.
 */

export type TrimStatus = "trimming" | "failed";
export type TrimKind = "video" | "audio";

/** What is kept, in seconds: null start is from the beginning, null end is to the end. */
export type TrimRange = { startS: number | null; endS: number | null };

/** The shortest a trimmed file can be. */
export const MIN_TRIM_KEEP_SECONDS = 1;

/** A first run and Cloud Run's two retries. */
export const TRIM_ATTEMPTS = 3;

/** A Trim with no result after this long is given up: its runs timed out or never started. */
export const TRIM_GIVE_UP_MS = 4 * 60 * 60 * 1000;

/** The links a run gets outlive every Cloud Run attempt (three runs of up to an hour) and its queue. */
export const TRIM_LINK_TTL_SECONDS = 5 * 60 * 60;

/** Within this of an edge, a mark is the edge itself: nothing is cut there. */
const EDGE_SECONDS = 0.05;

/** What a trimmed file is stored as: h264 video, or AAC audio, so it plays on the iPhone. */
export function trimmedContentType(kind: TrimKind): string {
  return kind === "video" ? "video/mp4" : "audio/mp4";
}

/** Where a run leaves its result. A Retry is a new run, so nothing from an earlier one is read as its. */
export function trimResultKey(trimId: string, run: string): string {
  return `trims/${trimId}/${run}.json`;
}

const tenth = (seconds: number) => Math.round(seconds * 10) / 10;

/** Marks rounded to a tenth; a mark at the very start or end means nothing is cut there. */
export function normalizeTrim(range: TrimRange, durationS: number | null): TrimRange {
  const startS = range.startS === null ? null : tenth(range.startS);
  const endS = range.endS === null ? null : tenth(range.endS);
  return {
    startS: startS !== null && startS <= EDGE_SECONDS ? null : startS,
    endS: endS !== null && durationS !== null && endS >= durationS - EDGE_SECONDS ? null : endS,
  };
}

export type TrimProblem = "nothing-removed" | "too-short" | "out-of-range";

export const TRIM_PROBLEM_TEXT: Record<TrimProblem, string> = {
  "nothing-removed": "Set where it starts or where it ends.",
  "too-short": `At least ${MIN_TRIM_KEEP_SECONDS} second has to stay.`,
  "out-of-range": "That's outside the video.",
};

/** Why a range can't be trimmed (after normalizeTrim), or null. Without the duration, only what's knowable is checked. */
export function trimProblem(range: TrimRange, durationS: number | null): TrimProblem | null {
  const { startS, endS } = range;
  const bad = (n: number | null) => n !== null && (!Number.isFinite(n) || n < 0);
  if (bad(startS) || bad(endS)) return "out-of-range";
  if (durationS !== null && ((startS ?? 0) >= durationS || (endS ?? 0) > durationS)) return "out-of-range";
  if (startS === null && endS === null) return "nothing-removed";
  const end = endS ?? durationS;
  if (end !== null && end - (startS ?? 0) < MIN_TRIM_KEEP_SECONDS) return "too-short";
  return null;
}

/** `0:47`, `0:47.3`, `1:02:05`. */
export function clock(seconds: number): string {
  const total = tenth(Math.max(0, seconds));
  const whole = Math.floor(total);
  const fraction = Math.round((total - whole) * 10);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = `${String(s).padStart(2, "0")}${fraction ? `.${fraction}` : ""}`;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Reads `47`, `0:47`, `0:47.5` or `1:02:05` back into seconds; null when it isn't a time. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  if (parts.slice(0, -1).some((p) => p.includes("."))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n >= 60)) return null;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}

/** "This removes 0:00–0:03 and 0:47–0:58 for good." */
export function removedLabel(range: TrimRange, durationS: number | null): string {
  const cuts: string[] = [];
  if (range.startS !== null) cuts.push(`0:00–${clock(range.startS)}`);
  if (range.endS !== null)
    cuts.push(durationS !== null ? `${clock(range.endS)}–${clock(durationS)}` : `from ${clock(range.endS)} on`);
  return `This removes ${cuts.join(" and ")} for good.`;
}

/** What the trimmer leaves in its result; see worker/clips/trim.py. */
export type TrimResult =
  | { ok: true; contentType: string; sizeBytes: number; durationS: number | null; attempt: number }
  | { ok: false; final: boolean; reason: "nothing_left" | "unreadable" | "error"; message: string; attempt: number };

export type TrimOutcome =
  /** `attempt`: the one now running, when a failed one says so (0 is the first). */
  | { status: "trimming"; attempt: number | null }
  | { status: "done"; contentType: string }
  | { status: "failed"; error: string };

const FAILED_TEXT: Record<Exclude<TrimResult, { ok: true }>["reason"], string> = {
  nothing_left: "Nothing was left after the cut.",
  unreadable: "The file couldn't be read.",
  error: "Couldn't trim.",
};

/** What a Trim's result (or its silence) means. */
export function settleTrim(result: TrimResult | null, startedAt: Date, now: Date): TrimOutcome {
  if (!result) {
    if (now.getTime() - startedAt.getTime() > TRIM_GIVE_UP_MS) {
      return { status: "failed", error: "The trim never finished." };
    }
    return { status: "trimming", attempt: null };
  }
  if (result.ok) return { status: "done", contentType: result.contentType };
  if (!result.final && result.attempt < TRIM_ATTEMPTS - 1) return { status: "trimming", attempt: result.attempt + 1 };
  return { status: "failed", error: FAILED_TEXT[result.reason] ?? "Couldn't trim." };
}
