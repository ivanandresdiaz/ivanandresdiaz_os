/** Rules of a Long text: Dictation (speaking into it) and the English Coach (reviewing it). */

/** A Dictation stops by itself after 10 minutes. */
export const MAX_DICTATION_SECONDS = 10 * 60;

/** The transcription service takes files up to 25 MB. */
export const MAX_DICTATION_BYTES = 25 * 1024 * 1024;

/** The longest text the English Coach reviews at once (a long Expansion fits). */
export const MAX_COACH_CHARS = 30_000;

export const MISTAKE_KINDS = ["spelling", "grammar", "word_choice", "unnatural"] as const;
export type MistakeKind = (typeof MISTAKE_KINDS)[number];

export const MISTAKE_LABEL: Record<MistakeKind, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  word_choice: "Word choice",
  unnatural: "Sounds unnatural",
};

export type Mistake = { kind: MistakeKind; original: string; correction: string; why: string };
export type CoachReview = { mistakes: Mistake[]; polished: string };

// ─── Dictation audio ─────────────────────────────────────────────────────────

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** "audio/webm;codecs=opus" → "audio/webm". */
export function baseAudioType(contentType: string) {
  return contentType.split(";")[0].trim().toLowerCase();
}

/** The file extension of a recording, or null when it is not audio the transcription takes. */
export function dictationExtension(contentType: string): string | null {
  return AUDIO_EXTENSIONS[baseAudioType(contentType)] ?? null;
}

export const DICTATION_PREFIX = "dictation/";

export function dictationKey(id: string, extension: string) {
  return `${DICTATION_PREFIX}${id}.${extension}`;
}

const DICTATION_KEY = /^dictation\/[0-9a-f-]{36}\.(webm|m4a|ogg|mp3|wav)$/;

/** Only temporary Dictation recordings may be read or deleted through a Dictation. */
export function isDictationKey(key: string) {
  return DICTATION_KEY.test(key);
}

// ─── Inserting what was said ─────────────────────────────────────────────────

export type Selection = { start: number; end: number };

/**
 * Puts the dictated words where the cursor was (replacing a selection), or at
 * the end when the field had no cursor, with a space on each side when needed.
 * Never removes anything else. Returns the new text and where the cursor goes.
 */
export function insertDictation(text: string, spoken: string, at: Selection | null) {
  const words = spoken.trim();
  if (!words) return { text, caret: at?.end ?? text.length };
  const start = Math.min(Math.max(at?.start ?? text.length, 0), text.length);
  const end = Math.min(Math.max(at?.end ?? start, start), text.length);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  const inserted = `${lead}${words}${trail}`;
  return { text: before + inserted + after, caret: before.length + lead.length + words.length };
}

// ─── Showing what the Coach changed ──────────────────────────────────────────

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

/** Past this many word pairs the diff is too costly; the polished text is shown plain. */
const MAX_DIFF_CELLS = 4_000_000;

const tokens = (text: string) => text.split(/(\s+)/).filter(Boolean);

/**
 * Word-level changes from `mine` to `polished`, in reading order. Whitespace
 * counts as a word so paragraphs survive. Null when the texts are too long.
 */
export function diffWords(mine: string, polished: string): DiffPart[] | null {
  const a = tokens(mine);
  const b = tokens(polished);
  if (a.length * b.length > MAX_DIFF_CELLS) return null;
  // Longest common subsequence, filled from the end so the walk goes forward.
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j] ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      push("removed", a[i++]);
    } else {
      push("added", b[j++]);
    }
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return parts;
}
