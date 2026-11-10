/**
 * Discoveries: Ivan interviews the people a product is for, through an AI that
 * knows a Brief they never see. Rules here know nothing about the database or
 * the AI provider. Method: docs/discovery-interview-method.md.
 */

export const LANGUAGES = ["es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DISCOVERY_STATUSES = ["draft", "open", "closed"] as const;
export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];

export const STAGES = ["needs", "vision"] as const;
export type Stage = (typeof STAGES)[number];

export type Phase = "thinking" | "answering" | "closing" | "done" | "failed";

/** Needs dig into one real story in 3 rounds; Vision asks for a choice in 2 (Q47). */
export const ROUNDS: Record<Stage, number> = { needs: 3, vision: 2 };

/** A round the AI writes has 2 to 4 questions. */
export const MIN_QUESTIONS = 2;
export const MAX_QUESTIONS = 4;

/** A "thinking" Interview older than this was cut off (the function died): it can be retried. */
export const STALE_THINKING_MS = 4 * 60 * 1000;

export const MAX_TITLE = 120;
export const MAX_BRIEF = 120_000;
export const MAX_OPENING = 20_000;
export const MAX_THEME_DESCRIPTION = 300;
export const MAX_LEARN = 10_000;
export const MAX_ROLE_NOTE = 300;
export const MAX_ANSWER = 8_000;
export const MAX_IMAGE_DESCRIPTION = 1_000;

/** The Stages a Stakeholder goes through, in order. */
export function stagesFor(s: { wantsNeeds: boolean; wantsVision: boolean }): Stage[] {
  return STAGES.filter((stage) => (stage === "needs" ? s.wantsNeeds : s.wantsVision));
}

export function nextStage(s: { wantsNeeds: boolean; wantsVision: boolean }, current: Stage): Stage | null {
  const stages = stagesFor(s);
  return stages[stages.indexOf(current) + 1] ?? null;
}

/**
 * Where a Stakeholder goes after finishing a Theme: the next one not done, in
 * Ivan's order, wrapping around to any left half-answered earlier. Null when
 * every other Theme is done.
 */
export function nextTheme<T extends { id: string; done: boolean }>(themes: readonly T[], current: string): T | null {
  const at = themes.findIndex((t) => t.id === current);
  const after = [...themes.slice(at + 1), ...themes.slice(0, Math.max(at, 0))];
  return after.find((t) => !t.done && t.id !== current) ?? null;
}

// ─── Names and addresses ─────────────────────────────────────────────────────

/** "Gestor de cartera v2" → "gestor-de-cartera-v2". */
export function slugify(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "discovery";
}

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Mauricio Pérez" → "Mauricio": how the Stakeholder screens greet someone. */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// ─── Templates for Ivan (Q51) ────────────────────────────────────────────────

export const BRIEF_TEMPLATE = `## Company and context
(no client data)

## How people say things
(glossary, including field slang — one term per line, "term: meaning")

## How the work is done today
(by role; mark each line [known] or [assumed])

## The system today
(what it does and does not do)

## Fixed constraints
(what is not up for discussion)

## My hypotheses
- H1:

## Vision ideas
- V1: … — it would ask the user to …

## Do not open
(salaries, individual performance…)
`;

export const LEARN_TEMPLATE = `Decision:
Learn:
-
Hypotheses:
Already known, do not ask:
`;

/**
 * The terms under the Brief's "How people say things": Dictation gets them as
 * keywords so it writes "franja" or "corresponsal" right.
 */
export function glossaryKeywords(brief: string, limit = 40): string[] {
  const lines = brief.split("\n");
  const start = lines.findIndex((line) => /^#+\s*(how people say things|c[oó]mo (se dicen|hablan))/i.test(line.trim()));
  if (start === -1) return [];
  const terms: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (/^#+\s/.test(trimmed)) break;
    const item = trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "");
    const match = item.match(/^([^:—–(]{2,40}?)\s*(\([^)]*\))?\s*(:|—|–| - )/);
    const term = match?.[1].trim();
    if (term && !terms.includes(term)) terms.push(term);
  }
  return terms.slice(0, limit);
}

// ─── Keeping client data out (Q7 of Ronda 53, Q52) ───────────────────────────

export type Masked = "document" | "phone";

const PHONE = /(?<![\d$])(?:\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
const DOCUMENT_WORDS = /\b(c\.?\s?c\.?|c[eé]dula|documento|nit|identificaci[oó]n|id|n[uú]mero de documento)\b[\s:#.º°nN-]*((?:\d[\d.\s-]{4,16}\d))/gi;
const BARE_DOCUMENT = /(?<![\d$.,])(?:\d{1,3}\.\d{3}\.\d{3}(?:\.\d{3})?|\d{7,10})(?![\d.,]*\d)/g;

/**
 * Hides what looks like a phone or an ID number before anything is saved.
 * Amounts with "$" and short numbers ("30 días", "2 horas") stay.
 */
export function maskSensitive(text: string): { text: string; masked: Masked[] } {
  const masked = new Set<Masked>();
  let out = text.replace(PHONE, () => {
    masked.add("phone");
    return "[teléfono]";
  });
  out = out.replace(DOCUMENT_WORDS, (_all, word: string) => {
    masked.add("document");
    return `${word} [documento]`;
  });
  out = out.replace(BARE_DOCUMENT, (found, offset: number, whole: string) => {
    const before = whole.slice(Math.max(0, offset - 2), offset);
    if (/\$\s?$/.test(before)) return found;
    masked.add("document");
    return "[documento]";
  });
  return { text: out, masked: [...masked] };
}

// ─── A round ─────────────────────────────────────────────────────────────────

export type OptionOrigin = "scale" | "theirs" | "ai";
export type AnswerKind = "open" | "one" | "many";
export type QuestionPurpose = "fact" | "story" | "detail" | "rank" | "checklist" | "wish" | "idea";

export type RoundOption = { id: string; label: string; origin: OptionOrigin };
export type RoundQuestion = {
  id: string;
  purpose: QuestionPurpose;
  text: string;
  hint: string | null;
  answer: AnswerKind;
  options: RoundOption[];
};
export type RoundNotes = { learned: string[]; open_threads: string[]; next: string };

/** What the interviewer returns each round (Fable's format, plus a privacy note). */
export type Round = {
  intro: string;
  /** Shown when the last answers named a client or gave their data. */
  privacy_note: string | null;
  questions: RoundQuestion[];
  understood: string[];
  notes: RoundNotes;
  wrap_up: boolean;
};

/** Keeps a round the model wrote within the card rules, whatever it sent. */
export function tidyRound(round: Round): Round | null {
  const questions = round.questions
    .slice(0, MAX_QUESTIONS)
    .map((q, index) => {
      const options = q.answer === "open" ? [] : q.options.slice(0, 6);
      const answer: AnswerKind = q.answer !== "open" && options.length < 2 ? "open" : q.answer;
      return {
        ...q,
        id: q.id.trim() || `q${index + 1}`,
        answer,
        options: answer === "open" ? [] : options.map((o, i) => ({ ...o, id: o.id.trim() || String.fromCharCode(97 + i) })),
      };
    })
    .filter((q) => q.text.trim());
  // Duplicate ids would mix answers up.
  const ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) q.id = `${q.id}-${ids.size}`;
    ids.add(q.id);
  }
  if (questions.length === 0) return null;
  return { ...round, questions, understood: round.understood.slice(0, 6) };
}

/** A stable shuffle (the same question always shows its options in the same order). */
export function shuffled<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const NONE = /^(ninguna|ninguno|none)\b/i;

/** "Ninguna" / "None": the option that clears the others. */
export function isNoneOption(option: { label: string }) {
  return NONE.test(option.label.trim());
}

/**
 * The order a card shows its options in. Suggestions are shuffled, so the first
 * one isn't picked for being first, with "None" after them. A neutral scale (how
 * often, how many) keeps the AI's order, its "none" included: a shuffled scale is
 * hard to read and suggests nothing.
 */
export function displayOptions(options: readonly RoundOption[], seed: string): RoundOption[] {
  const none = options.filter(isNoneOption);
  const rest = options.filter((o) => !isNoneOption(o));
  if (rest.length > 0 && rest.every((o) => o.origin === "scale")) return [...options];
  return [...shuffled(rest, seed), ...none];
}

export type InputKind = "text" | "voice";

/** One card as the Stakeholder answered it. */
export type Answer = {
  q: string;
  /** Option ids picked; "other" when they chose "Otra cosa". */
  picked: string[];
  text: string;
  /** Whether any of the text came from Dictation. */
  input: InputKind;
  seconds: number;
  skipped: boolean;
};

export type AnswersPayload = { answers: Answer[]; masked: Masked[] };
export type FreeTextPayload = { text: string; input: InputKind; masked: Masked[] };

const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The state line the app (not the model) owns. */
export function roundState(stage: Stage, round: number) {
  return `<round_state stage="${stage}" round="${round}" of="${ROUNDS[stage]}"/>`;
}

/** The answers to one round, as the interviewer reads them. */
export function answersXml(round: Round, payload: AnswersPayload) {
  const lines = payload.answers.map((a) => {
    const question = round.questions.find((q) => q.id === a.q);
    if (a.skipped) return `<answer q="${xml(a.q)}" skipped="true"/>`;
    const labels = a.picked
      .map((id) => (id === "other" ? "Otra cosa" : question?.options.find((o) => o.id === id)?.label))
      .filter(Boolean)
      .join(" | ");
    const picked = a.picked.length ? ` picked="${xml(a.picked.join(","))}"` : "";
    const chosen = labels ? `[${xml(labels)}] ` : "";
    return `<answer q="${xml(a.q)}"${picked} input="${a.input}" seconds="${Math.round(a.seconds)}">${chosen}${xml(a.text)}</answer>`;
  });
  return `<answers>\n${lines.join("\n")}\n</answers>`;
}

/** Everything the Stakeholder wrote or dictated, for checking that a quote is really theirs. */
export function ownWords(texts: string[]) {
  return texts.join("\n");
}

const comparable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”"«»'’‘.,;:¡!¿?()…-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Whether a quote appears in what the person said. Parts in [brackets] are the
 * AI's replacements (a removed name) and are skipped; the rest must appear in order.
 */
export function quoteFound(quote: string, said: string) {
  const haystack = comparable(said);
  const parts = quote
    .split(/\[[^\]]*\]/)
    .map(comparable)
    .filter((part) => part.length >= 3);
  if (parts.length === 0) return false;
  let from = 0;
  for (const part of parts) {
    const at = haystack.indexOf(part, from);
    if (at === -1) return false;
    from = at + part.length;
  }
  return true;
}

// ─── Insights ────────────────────────────────────────────────────────────────

export type EvidenceSource = "own_words" | "picked_scale" | "picked_theirs" | "picked_ai" | "file";
export type Strength = "strong" | "medium" | "weak";

export type Evidence = {
  source: EvidenceSource;
  /** The question id ("n2q1"), "closing" or "more". */
  ref: string;
  quote: string;
  /** Set by the app: an own-words quote was found in the conversation. */
  verified?: boolean;
};

export type Need = {
  id: string;
  statement: string;
  /** The AI's reading, not the person's words. */
  inferred: boolean;
  job_story: string | null;
  situation: string | null;
  today: string | null;
  cost: string | null;
  frequency: string | null;
  evidence: Evidence[];
  strength: Strength;
  strength_why: string;
  perspective: "first_hand" | "about_others";
  against_brief: string | null;
  not_established: string | null;
  flags: string | null;
};

export type Proposal = {
  id: string;
  statement: string;
  origin: "own_idea" | "chose_ai_idea" | "agreed_ai_idea";
  responds_to: string | null;
  would_let_them: string | null;
  accepts_rejects: string | null;
  must_not_change: string | null;
  worries: string | null;
  last_time_helped: string | null;
  evidence: Evidence[];
  strength: Strength;
  strength_why: string;
};

export type Insights = { needs: Need[]; proposals: Proposal[] };

const OWN: EvidenceSource[] = ["own_words"];

/** Marks every own-words quote found or not found in what the person really said. */
export function verifyInsights(insights: Insights, said: string): Insights {
  const check = (e: Evidence): Evidence => ({ ...e, verified: OWN.includes(e.source) ? quoteFound(e.quote, said) : true });
  return {
    needs: insights.needs.map((n) => ({ ...n, evidence: n.evidence.map(check) })),
    proposals: insights.proposals.map((p) => ({ ...p, evidence: p.evidence.map(check) })),
  };
}

export const STRENGTH_LABEL: Record<Strength, string> = { strong: "Strong", medium: "Medium", weak: "Weak" };

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  own_words: "own words",
  picked_scale: "picked option, scale",
  picked_theirs: "picked option, their words",
  picked_ai: "picked option, AI",
  file: "file",
};

export function evidenceLabel(e: Evidence) {
  return `${SOURCE_LABEL[e.source]} · ${e.ref}`;
}

const ORIGIN_LABEL: Record<Proposal["origin"], string> = {
  own_idea: "Own idea",
  chose_ai_idea: "Chose among AI ideas",
  agreed_ai_idea: "Agreed with an AI idea",
};

export function proposalOriginLabel(origin: Proposal["origin"]) {
  return ORIGIN_LABEL[origin];
}

// ─── Copy as Markdown (Q45) ──────────────────────────────────────────────────

export type ExportInterview = {
  stakeholder: string;
  role: string;
  insights: Insights | null;
  files: string[];
  /** The conversation as readable text, when asked for. */
  conversation?: string;
};

export type ExportTheme = { title: string; interviews: ExportInterview[] };

function evidenceLines(evidence: Evidence[]) {
  return evidence.map((e) => {
    const quote = e.source === "own_words" ? `"${e.quote}"` : e.quote;
    const missing = e.verified === false ? " (not found in the conversation)" : "";
    return `- [${evidenceLabel(e)}] ${quote}${missing}`;
  });
}

function field(label: string, value: string | null) {
  return value ? [`**${label}:** ${value}`] : [];
}

export function needMarkdown(n: Need, who: string, theme: string) {
  return [
    `### ${n.id} · ${who} · ${theme}`,
    `**Need${n.inferred ? " (the AI's reading, not their words)" : ""}:** ${n.statement}`,
    ...field("Job story", n.job_story),
    ...field("Situation", n.situation),
    ...field("Today", n.today),
    ...field("Cost", n.cost),
    ...field("Frequency", n.frequency),
    "**Evidence:**",
    ...evidenceLines(n.evidence),
    `**Strength:** ${STRENGTH_LABEL[n.strength]} (${n.strength_why})`,
    `**Perspective:** ${n.perspective === "first_hand" ? "First-hand" : "About others' work (a hypothesis to check with them)"}`,
    ...field("Against the Brief", n.against_brief),
    ...field("Not established", n.not_established),
    ...field("Flags", n.flags),
  ].join("\n");
}

export function proposalMarkdown(p: Proposal, who: string, theme: string) {
  return [
    `### ${p.id} · ${who} · ${theme}`,
    `**Proposal:** ${p.statement}`,
    `**Origin:** ${ORIGIN_LABEL[p.origin]}`,
    `**Responds to:** ${p.responds_to ?? "no need stated"}`,
    ...field("Would let them", p.would_let_them),
    ...field("Accepts / rejects", p.accepts_rejects),
    ...field("Must not change", p.must_not_change),
    ...field("Worries", p.worries),
    ...field("Last time it would have helped", p.last_time_helped),
    "**Evidence:**",
    ...evidenceLines(p.evidence),
    `**Strength:** ${STRENGTH_LABEL[p.strength]} (${p.strength_why})`,
  ].join("\n");
}

export function discoveryMarkdown(title: string, themes: ExportTheme[]) {
  const out = [
    `# ${title} — Insights`,
    "",
    "Each Need and Proposal belongs to one person and carries their words. Strength: Strong = own words + a specific past event + a workaround or a cost; Medium = own words but general, or an AI option backed by an example; Weak = a tap or an agreement with nothing behind it. Treat Weak items as hypotheses, not votes. Nothing here is merged across people.",
  ];
  for (const theme of themes) {
    out.push("", `## ${theme.title}`);
    if (theme.interviews.length === 0) out.push("", "_No Interviews yet._");
    for (const i of theme.interviews) {
      const who = i.role ? `${i.stakeholder} (${i.role})` : i.stakeholder;
      out.push("", `### ${who}`);
      if (!i.insights || (i.insights.needs.length === 0 && i.insights.proposals.length === 0)) {
        out.push("", "_No Insights yet._");
      } else {
        for (const n of i.insights.needs) out.push("", needMarkdown(n, who, theme.title).replace(/^### /, "#### "));
        for (const p of i.insights.proposals) out.push("", proposalMarkdown(p, who, theme.title).replace(/^### /, "#### "));
      }
      if (i.files.length) out.push("", `**Files:** ${i.files.join(", ")}`);
      if (i.conversation) out.push("", "<details><summary>Conversation</summary>", "", i.conversation, "", "</details>");
    }
  }
  return `${out.join("\n")}\n`;
}

// ─── Files a Stakeholder attaches (Q53) ──────────────────────────────────────

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;
/** Photos are shrunk in the browser first; this only stops what was not. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_OPENING_IMAGE_BYTES = 5 * 1024 * 1024;

export const FILE_TYPES: Record<string, { ext: string; kind: "pdf" | "image" }> = {
  "application/pdf": { ext: "pdf", kind: "pdf" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
};

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateAttachment(file: { contentType: string; size: number }): string | null {
  const type = FILE_TYPES[file.contentType];
  if (!type) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > (type.kind === "pdf" ? MAX_PDF_BYTES : MAX_PHOTO_BYTES)) return "size";
  return null;
}

export function validateOpeningImage(file: { contentType: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.contentType)) return "Only JPEG, PNG or WebP images.";
  if (file.size <= 0 || file.size > MAX_OPENING_IMAGE_BYTES) return "Images up to 5 MB.";
  return null;
}

/** Pages of a PDF, counted from its page objects; null when they can't be counted (compressed). */
export function pdfPageCount(bytes: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(bytes);
  const count = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
  return count > 0 ? count : null;
}

export const discoveryPrefix = (discoveryId: string) => `discoveries/${discoveryId}/`;
export const openingImageKey = (discoveryId: string, id: string, contentType: string) =>
  `${discoveryPrefix(discoveryId)}opening/${id}.${FILE_TYPES[contentType]?.ext ?? "bin"}`;
export const interviewFilePrefix = (discoveryId: string, interviewId: string) =>
  `${discoveryPrefix(discoveryId)}interviews/${interviewId}/`;
export const interviewFileKey = (discoveryId: string, interviewId: string, id: string, contentType: string) =>
  `${interviewFilePrefix(discoveryId, interviewId)}${id}.${FILE_TYPES[contentType]?.ext ?? "bin"}`;

// ─── What Ivan sees in the grid (Q25) ────────────────────────────────────────

export type InterviewSummary = { stage: Stage; round: number; phase: Phase } | null;

export function interviewStatusLabel(i: InterviewSummary, stages: Stage[]): string {
  if (!i) return "Not started";
  if (i.phase === "done") return "Done";
  const stage = i.stage === "needs" ? "Needs" : "Vision";
  const multi = stages.length > 1 ? `${stage} · ` : "";
  if (i.phase === "closing") return `${multi}closing`;
  if (i.phase === "failed") return `${multi}round ${i.round} · stuck`;
  return `${multi}round ${i.round}/${ROUNDS[i.stage]}`;
}
