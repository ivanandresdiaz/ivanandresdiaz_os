import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  type AnswersPayload,
  answersXml,
  type FreeTextPayload,
  type Insights,
  type Language,
  type Round,
  roundState,
  type Stage,
  stagesFor,
  tidyRound,
  verifyInsights,
} from "@/domain/discovery";
import {
  type ContentBlock,
  DiscoveryAiError,
  interviewerSystem,
  interviewerSystemFor,
  type MessageParam,
  writeInsights,
  writeRound,
} from "@/lib/discovery-ai";
import { getObject } from "@/lib/r2";

/**
 * Runs an Interview: builds the conversation the interviewer reads (append-only,
 * so its prefix stays cached), asks for the next round, and rewrites the
 * Insights with a separate call (Q49).
 */

export type Turn = typeof s.interviewTurns.$inferSelect;
export type InterviewFile = typeof s.interviewFiles.$inferSelect;

export async function loadInterview(interviewId: string) {
  const [row] = await db
    .select({ interview: s.interviews, stakeholder: s.stakeholders, theme: s.discoveryThemes, discovery: s.discoveries })
    .from(s.interviews)
    .innerJoin(s.stakeholders, eq(s.stakeholders.id, s.interviews.stakeholderId))
    .innerJoin(s.discoveryThemes, eq(s.discoveryThemes.id, s.interviews.themeId))
    .innerJoin(s.discoveries, eq(s.discoveries.id, s.stakeholders.discoveryId))
    .where(eq(s.interviews.id, interviewId));
  if (!row) return null;
  const [turns, files] = await Promise.all([
    db.select().from(s.interviewTurns).where(eq(s.interviewTurns.interviewId, interviewId)).orderBy(asc(s.interviewTurns.seq)),
    db.select().from(s.interviewFiles).where(eq(s.interviewFiles.interviewId, interviewId)).orderBy(asc(s.interviewFiles.createdAt)),
  ]);
  return { ...row, turns, files };
}

export type LoadedInterview = NonNullable<Awaited<ReturnType<typeof loadInterview>>>;

/** The last round the AI wrote, which the Stakeholder answers now. */
export function currentRound(turns: Turn[]): Round | null {
  const last = [...turns].reverse().find((t) => t.kind === "round");
  return last ? (last.payload as Round) : null;
}

export async function nextSeq(interviewId: string) {
  const [{ last }] = await db
    .select({ last: sql<number | null>`max(${s.interviewTurns.seq})` })
    .from(s.interviewTurns)
    .where(eq(s.interviewTurns.interviewId, interviewId));
  return (last ?? -1) + 1;
}

/** What this person said in their other Themes, frozen when an Interview starts. */
export async function earlierThemes(stakeholderId: string, themeId: string) {
  const rows = await db
    .select({ title: s.discoveryThemes.title, understood: s.interviews.understood })
    .from(s.interviews)
    .innerJoin(s.discoveryThemes, eq(s.discoveryThemes.id, s.interviews.themeId))
    .where(and(eq(s.interviews.stakeholderId, stakeholderId), ne(s.interviews.themeId, themeId)));
  return rows
    .filter((r) => r.understood.length > 0)
    .map((r) => `${r.title}:\n${r.understood.map((u) => `- ${u}`).join("\n")}`)
    .join("\n\n");
}

type Block = ContentBlock;

async function fileBlock(key: string, contentType: string): Promise<Block | null> {
  const bytes = await getObject(key);
  if (!bytes) return null;
  const data = Buffer.from(bytes).toString("base64");
  if (contentType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } } as Block;
  }
  return {
    type: "image",
    source: { type: "base64", media_type: contentType as "image/jpeg" | "image/png" | "image/webp", data },
  } as Block;
}

function closingText(stage: Stage, payload: FreeTextPayload) {
  const said = payload.text.trim();
  return `<closing stage="${stage}">${said ? said.replace(/</g, "&lt;") : "(nothing added)"}</closing>`;
}

/**
 * The conversation as the interviewer reads it, ending with the state line of
 * the round to write. Earlier turns are rebuilt byte for byte the same way every
 * time, so the request is append-only.
 */
async function interviewerMessages(i: LoadedInterview, next: { stage: Stage; round: number }) {
  const images = await db
    .select()
    .from(s.discoveryImages)
    .where(eq(s.discoveryImages.discoveryId, i.discovery.id))
    .orderBy(asc(s.discoveryImages.position));
  const messages: { role: "user" | "assistant"; content: Block[] }[] = [];
  const push = (role: "user" | "assistant", blocks: Block[]) => {
    const last = messages.at(-1);
    if (last?.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };

  const opening: Block[] = [];
  for (const [index, image] of images.entries()) {
    const block = await fileBlock(image.key, image.contentType);
    if (!block) continue;
    opening.push(block, { type: "text", text: `Diagram ${index + 1} of the Opening: ${image.description || "(no description)"}` });
  }
  const stages = stagesFor(i.stakeholder);
  push("user", [...opening, { type: "text", text: roundState(stages[0], 1) }]);

  const filesByTurn = new Map<string, InterviewFile[]>();
  for (const f of i.files) if (f.turnId) filesByTurn.set(f.turnId, [...(filesByTurn.get(f.turnId) ?? []), f]);
  const attached = async (turnId: string) => {
    const blocks: Block[] = [];
    for (const f of filesByTurn.get(turnId) ?? []) {
      const block = await fileBlock(f.key, f.contentType);
      if (block) blocks.push({ type: "text", text: `Attached file: ${f.name}` }, block);
    }
    return blocks;
  };

  let lastRound: Round | null = null;
  for (const turn of i.turns) {
    if (turn.kind === "round") {
      lastRound = turn.payload as Round;
      push("assistant", [{ type: "text", text: JSON.stringify(turn.payload) }]);
    } else if (turn.kind === "answers" && lastRound) {
      push("user", [{ type: "text", text: answersXml(lastRound, turn.payload as AnswersPayload) }, ...(await attached(turn.id))]);
    } else if (turn.kind === "closing") {
      push("user", [{ type: "text", text: closingText(turn.stage as Stage, turn.payload as FreeTextPayload) }, ...(await attached(turn.id))]);
    }
  }
  // The first round's state line is already in the first message.
  if (i.turns.some((t) => t.kind === "round")) push("user", [{ type: "text", text: roundState(next.stage, next.round) }]);

  const last = messages.at(-1)!.content.at(-1) as Block & { cache_control?: unknown };
  last.cache_control = { type: "ephemeral" };
  return messages satisfies MessageParam[];
}

/**
 * Asks for the round the Interview is at (its stage and round) and stores it.
 * The Interview must already be "thinking". On failure it becomes "failed",
 * keeping everything said, so it can be retried.
 */
export async function runRound(interviewId: string) {
  const i = await loadInterview(interviewId);
  if (!i) throw new Error("Interview not found");
  const stage = i.interview.stage as Stage;
  const round = i.interview.round;
  try {
    const system = [
      {
        type: "text" as const,
        text: interviewerSystem({ brief: i.discovery.brief, opening: i.discovery.opening, language: i.discovery.language as Language }),
        cache_control: { type: "ephemeral" as const },
      },
      {
        type: "text" as const,
        text: interviewerSystemFor({
          name: i.stakeholder.name,
          roleNote: i.stakeholder.roleNote,
          theme: i.theme,
          stages: stagesFor(i.stakeholder),
          earlier: i.interview.earlier,
        }),
      },
    ];
    const written = tidyRound(await writeRound({ system, messages: await interviewerMessages(i, { stage, round }) }));
    if (!written) throw new DiscoveryAiError("The AI wrote a round without questions.");
    await db.transaction(async (tx) => {
      await tx.insert(s.interviewTurns).values({
        interviewId,
        seq: await nextSeq(interviewId),
        kind: "round",
        stage,
        round,
        payload: written,
      });
      await tx
        .update(s.interviews)
        .set({ phase: "answering", phaseAt: new Date(), understood: written.understood, error: null })
        .where(eq(s.interviews.id, interviewId));
    });
  } catch (error) {
    console.error("Discovery round failed", error);
    const message = error instanceof DiscoveryAiError ? error.message : "The AI could not answer.";
    await db
      .update(s.interviews)
      .set({ phase: "failed", phaseAt: new Date(), error: message })
      .where(eq(s.interviews.id, interviewId));
  }
}

// ─── The conversation as text: for the Insights, for Ivan, for the export ────

const ORIGIN: Record<string, string> = { scale: "scale", theirs: "their words", ai: "AI" };

export function conversationText(turns: Turn[], files: InterviewFile[]) {
  const out: string[] = [];
  let round: Round | null = null;
  const filesOf = (turnId: string) =>
    files.filter((f) => f.turnId === turnId).map((f) => `[file ${f.name}] ${f.summary || "(no summary)"}`);
  for (const turn of turns) {
    if (turn.kind === "round") {
      round = turn.payload as Round;
      out.push(`--- ${turn.stage === "needs" ? "Needs" : "Vision"} · round ${turn.round} ---`);
      if (round.intro) out.push(`AI: ${round.intro}`);
    } else if (turn.kind === "answers" && round) {
      const { answers } = turn.payload as AnswersPayload;
      for (const q of round.questions) {
        const a = answers.find((x) => x.q === q.id);
        const options = q.options.map((o) => `${o.id}) ${o.label} [${ORIGIN[o.origin] ?? o.origin}]`).join("; ");
        out.push(`[${q.id}] (${q.purpose} · ${q.answer}) ${q.text}${options ? `\n  Options: ${options}` : ""}`);
        if (!a || a.skipped) {
          out.push("  → (skipped)");
          continue;
        }
        const picked = a.picked
          .map((id) => (id === "other" ? "Otra cosa" : `${id}) ${q.options.find((o) => o.id === id)?.label ?? id}`))
          .join(", ");
        if (picked) out.push(`  → picked: ${picked} (${Math.round(a.seconds)} s)`);
        if (a.text.trim()) out.push(`  → (${a.input}, ${Math.round(a.seconds)} s) "${a.text.trim()}"`);
      }
      out.push(...filesOf(turn.id));
    } else if (turn.kind === "closing" || turn.kind === "more") {
      const p = turn.payload as FreeTextPayload;
      const label = turn.kind === "closing" ? `closing · ${turn.stage}` : "more";
      out.push(`[${label}] ${p.text.trim() ? `(${p.input}) "${p.text.trim()}"` : "(nothing added)"}`);
      out.push(...filesOf(turn.id));
    }
  }
  return out.join("\n");
}

/** Everything the person wrote or dictated, to check that a quote is theirs. */
export function saidBy(turns: Turn[]) {
  const said: string[] = [];
  for (const turn of turns) {
    if (turn.kind === "answers") for (const a of (turn.payload as AnswersPayload).answers) said.push(a.text);
    if (turn.kind === "closing" || turn.kind === "more") said.push((turn.payload as FreeTextPayload).text);
  }
  return said.join("\n");
}

/** Rewrites an Interview's Insights from the whole conversation (after every round, Q42). */
export async function refreshInsights(interviewId: string) {
  const i = await loadInterview(interviewId);
  if (!i) return;
  const said = i.turns.filter((t) => t.kind !== "round");
  if (said.length === 0) return;
  // Two rewrites can overlap when rounds are quick: only one built from the latest answers may save.
  const lastSaid = said.at(-1)!.seq;
  const stillLatest = sql`(select max(${s.interviewTurns.seq}) from ${s.interviewTurns} where ${s.interviewTurns.interviewId} = ${interviewId} and ${s.interviewTurns.kind} <> 'round') = ${lastSaid}`;
  try {
    const raw = await writeInsights({
      brief: i.discovery.brief,
      stakeholder: `${i.stakeholder.name}${i.stakeholder.roleNote ? ` (${i.stakeholder.roleNote})` : ""}`,
      theme: i.theme.title,
      conversation: conversationText(i.turns, i.files),
    });
    const insights: Insights = verifyInsights(raw, saidBy(i.turns));
    await db
      .update(s.interviews)
      .set({ insights, insightsAt: new Date(), insightsError: null })
      .where(and(eq(s.interviews.id, interviewId), stillLatest));
  } catch (error) {
    console.error("Discovery Insights failed", error);
    await db
      .update(s.interviews)
      .set({ insightsError: error instanceof DiscoveryAiError ? error.message : "The AI could not write the Insights." })
      .where(and(eq(s.interviews.id, interviewId), stillLatest));
  }
}
