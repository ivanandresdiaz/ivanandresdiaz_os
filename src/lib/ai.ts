import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import { type CoachReview, MISTAKE_KINDS } from "@/domain/english";

/** Which Long text tools have their key set. A missing key disables its button, never the app. */
export function aiAvailability() {
  return { dictation: Boolean(process.env.OPENAI_API_KEY), coach: Boolean(process.env.ANTHROPIC_API_KEY) };
}

// ─── Dictation ───────────────────────────────────────────────────────────────

const TRANSCRIBE_MODEL = "gpt-transcribe";

/** Words of Ivan OS that a generic transcription would get wrong. */
const DOMAIN_WORDS = [
  "Ivan OS",
  "Season",
  "Season Goal",
  "Quarter",
  "Campaign",
  "Move",
  "Infinite Game",
  "Principle",
  "Expansion",
  "Highlight",
  "Check-in",
  "Structure",
];

let openai: OpenAI | null = null;

/**
 * What Ivan said, word for word: his mistakes stay, because correcting them is
 * the English Coach's job and he learns from them.
 */
export async function transcribe(
  audio: ArrayBuffer,
  fileName: string,
  contentType: string,
  /** A Stakeholder of a Discovery speaks its language, with the Brief's terms as keywords. */
  speaker?: { language: "es" | "en"; keywords: string[] },
) {
  openai ??= new OpenAI();
  const result = await openai.audio.transcriptions.create({
    model: TRANSCRIBE_MODEL,
    file: await toFile(Buffer.from(audio), fileName, { type: contentType }),
    language: speaker?.language ?? "en",
    keywords: speaker ? speaker.keywords : DOMAIN_WORDS,
    prompt: speaker
      ? speaker.language === "es"
        ? "Transcripción literal de una persona que cuenta cómo es su trabajo en una empresa de microfinanzas en Colombia. Escribe exactamente lo que dice, con puntuación y párrafos."
        : "Verbatim transcription of a person describing their work. Write exactly what they say, with punctuation and paragraphs."
      : "Verbatim transcription of a non-native English speaker thinking out loud. Keep every grammar mistake and wrong word exactly as spoken; do not correct or improve anything. Add punctuation and paragraphs. Write any Spanish word as spoken.",
  });
  return result.text.trim();
}

// ─── English Coach ───────────────────────────────────────────────────────────

const COACH_MODEL = "claude-sonnet-5-5";

const Review = z.object({
  mistakes: z.array(
    z.object({
      kind: z.enum(MISTAKE_KINDS),
      original: z.string(),
      correction: z.string(),
      why: z.string(),
    }),
  ),
  polished: z.string(),
});

const COACH_SYSTEM = `You are Ivan's English coach. Ivan is a native Spanish speaker practicing his English. He writes long personal texts in Ivan OS, his life-strategy app (his current Season of life, Quarter plans, Campaign goals, the Principles he lives by), often by dictation. He wants good English in them and to learn from his mistakes.

Review the text he sends and return:

mistakes: every real mistake, in the order it appears.
- kind: spelling, grammar, word_choice, or unnatural (correct but no native speaker would say it that way).
- original: the exact words as he wrote them, only the phrase with the mistake.
- correction: that phrase fixed.
- why: one short sentence in plain English (B1 level). When the mistake comes from Spanish (a literal translation, a false friend, Spanish word order or prepositions), say so and you may show the Spanish briefly, e.g. "In Spanish you 'hacer una pregunta', but in English you 'ask a question'."
- A Spanish word left in the text is a word_choice mistake whose correction is the English word.
Do not flag correct choices that are only a matter of taste.

polished: the whole text, corrected and natural, in his voice. Keep his ideas, tone, first person and level of formality; add nothing, and do not make it corporate, motivational or flowery. Because it may be dictated, drop filler words (um, you know, like) and accidental repetitions, and split it into paragraphs where that helps. Season, Quarter, Campaign, Principle, Infinite Game and other capitalized app terms stay as they are. If the text is Markdown, keep its formatting, links and structure.

If the text is already good, return few or no mistakes and keep polished close to the original.`;

let anthropic: Anthropic | null = null;

export class CoachError extends Error {}

/** One review of a Long text: the mistakes, and the polished version Ivan may use. */
export async function reviewEnglish(text: string, markdown: boolean): Promise<CoachReview> {
  anthropic ??= new Anthropic();
  const response = await anthropic.beta.messages.parse({
    model: COACH_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Review) },
    system: COACH_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Review this ${markdown ? "Markdown " : ""}text:\n\n<text>\n${text}\n</text>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new CoachError("The Coach declined to review this text.");
  if (response.stop_reason === "max_tokens") throw new CoachError("The text is too long for one review.");
  if (!response.parsed_output) throw new CoachError("The Coach answered in an unexpected shape. Try again.");
  return response.parsed_output;
}
