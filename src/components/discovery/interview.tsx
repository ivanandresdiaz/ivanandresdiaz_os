"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  type Answer,
  type Language,
  type Masked,
  type Phase,
  type Round,
  displayOptions,
  isNoneOption,
  nextTheme,
  type RoundQuestion,
  themeRound,
  type Stage,
} from "@/domain/discovery";
import { addMore, finishStage, retryRound, startInterview, submitAnswers } from "@/server/stakeholder-actions";
import { useRemembered } from "../use-remembered";
import { Attachments, type PendingFile } from "./attachments";
import { type Copy, copyFor } from "./copy";
import { type ThemeProgress, ThemeCheer, ThemesBar } from "./progress";
import { SignOutButton } from "./sign-out-button";
import { VoiceField } from "./voice-field";

export type HistoryBlock =
  | { kind: "round"; stage: Stage; round: number; intro: string; qa: { question: string; answer: string | null }[] }
  | { kind: "closing" | "more"; text: string; files: string[] };

export type InterviewProps = {
  slug: string;
  language: Language;
  isTest: boolean;
  firstName: string;
  theme: { id: string; title: string; description: string };
  /** This person's Themes in Ivan's order, to say what comes next and how far they are. */
  themes: ThemeProgress[];
  /** The Theme they just finished, when they came straight from it: celebrate it on top (Ronda 57). */
  celebrate: string | null;
  stages: Stage[];
  interview: {
    id: string;
    stage: Stage;
    round: number;
    phase: Phase;
    stale: boolean;
    understood: string[];
    error: string | null;
  } | null;
  round: Round | null;
  pending: PendingFile[];
  history: HistoryBlock[];
};

/** One Theme's Interview, phone first: rounds as cards, the closing of a stage, and the end (Q22, Q50). */
export function InterviewScreen(props: InterviewProps) {
  const copy = copyFor(props.language);
  const router = useRouter();
  const { interview } = props;
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, startStarting] = useTransition();
  const [waiting, setWaiting] = useState(false);
  /** The Theme they just finished, celebrated on top until they start or answer (Ronda 57). */
  const [cheer, setCheer] = useState(props.celebrate);
  /** Finishing this Theme and on the way to the next one. */
  const [leaving, setLeaving] = useState(false);
  const sending = (on: boolean) => {
    if (on) setCheer(null);
    setWaiting(on);
  };

  // A reload shouldn't celebrate again: drop the mark from the address.
  useEffect(() => {
    if (props.celebrate) window.history.replaceState(null, "", `/d/${props.slug}/t/${props.theme.id}`);
  }, [props.celebrate, props.slug, props.theme.id]);

  // A notice is read once, then gets out of the way.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // While the AI writes a round somewhere else (another tab, a reload), look again every few seconds.
  const thinking = interview?.phase === "thinking" && !interview.stale;
  useEffect(() => {
    if (!thinking) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [thinking, router]);

  const onResult = (result: { ok: true; masked: Masked[] } | { ok: false; error: string }) => {
    if (!result.ok) {
      setNotice(result.error === "stale" ? copy.stale : copy.failed);
      router.refresh();
    } else if (result.masked.length) setNotice(copy.masked(result.masked));
  };

  const stageLabel = interview ? (interview.stage === "needs" ? copy.needs : copy.vision) : null;
  const themeNumber = props.themes.filter((t) => t.done && t.id !== props.theme.id).length + 1;
  const roundOfTheme = interview ? themeRound(props.stages, interview.stage, interview.round) : null;
  const next = nextTheme(props.themes, props.theme.id);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/d/${props.slug}`} className="flex min-h-11 items-center gap-1 text-sm text-muted">
            ← {copy.back}
          </Link>
          {props.isTest && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Test</span>}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{props.theme.title}</h1>
          {props.theme.description && <p className="text-sm text-muted">{props.theme.description}</p>}
        </div>
        {interview?.phase !== "done" && !leaving && !cheer && (
          <div className="flex flex-col gap-2">
            <ThemesBar themes={props.themes} label={copy.progressLabel} current={props.theme.id} size="thin" />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {interview && props.stages.length > 1 && (
                <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">{stageLabel}</span>
              )}
              <span className="font-medium text-muted">{copy.themeOf(themeNumber, props.themes.length)}</span>
              {interview && roundOfTheme && interview.phase !== "closing" && (
                <span className="text-muted">· {copy.round(roundOfTheme.n, roundOfTheme.of)}</span>
              )}
            </div>
          </div>
        )}
        {interview && interview.phase !== "done" && interview.phase !== "closing" && interview.understood.length > 0 && (
          <Understood copy={copy} items={interview.understood} />
        )}
      </header>

      {notice && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-2 text-amber-700" aria-label="OK">
            ✕
          </button>
        </p>
      )}

      {cheer && props.themes.some((t) => t.id === cheer && t.done) && (
        <ThemeCheer copy={copy} name={props.firstName} themes={props.themes} finished={cheer} />
      )}

      {leaving && <p className="py-8 text-center text-sm text-muted">{copy.movingOn}</p>}

      {!interview &&
        (starting ? (
          <Thinking copy={copy} title={copy.starting} understood={[]} />
        ) : (
          <section className="card-in flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{copy.startTitle}</h2>
            <p className="text-sm leading-relaxed text-muted">{copy.startHint}</p>
            <button
              type="button"
              onClick={() => {
                setCheer(null);
                startStarting(() => startInterview({ slug: props.slug, themeId: props.theme.id }));
              }}
              className="min-h-12 rounded-full bg-accent px-6 text-base font-medium text-white shadow-sm active:scale-[0.99]"
            >
              {copy.start}
            </button>
          </section>
        ))}

      {interview && (waiting || thinking) && (
        <Thinking copy={copy} title={copy.thinking} understood={interview.understood} hint={copy.thinkingHint} />
      )}

      {interview && !waiting && (interview.phase === "failed" || (interview.phase === "thinking" && interview.stale)) && (
        <Failed copy={copy} slug={props.slug} interviewId={interview.id} error={interview.error} />
      )}

      {interview && !waiting && interview.phase === "answering" && props.round && (
        <Cards
          key={`${interview.id}:${interview.stage}:${interview.round}`}
          slug={props.slug}
          copy={copy}
          interviewId={interview.id}
          stage={interview.stage}
          roundNumber={interview.round}
          round={props.round}
          pending={props.pending}
          onSending={sending}
          onResult={onResult}
        />
      )}

      {interview && !waiting && !leaving && interview.phase === "closing" && (
        <Closing
          slug={props.slug}
          copy={copy}
          interviewId={interview.id}
          understood={interview.understood}
          pending={props.pending}
          goesOn={props.stages.indexOf(interview.stage) < props.stages.length - 1}
          next={next}
          onSending={sending}
          onResult={onResult}
          onNextTheme={(id) => {
            setLeaving(true);
            router.push(`/d/${props.slug}/t/${id}?listo=${props.theme.id}`);
          }}
        />
      )}

      {interview && interview.phase === "done" && !leaving && (
        <Done
          slug={props.slug}
          copy={copy}
          interviewId={interview.id}
          pending={props.pending}
          onResult={onResult}
          isTest={props.isTest}
          next={next}
          themes={props.themes}
          themeId={props.theme.id}
          firstName={props.firstName}
        />
      )}

      {interview && !leaving && props.history.length > 0 && (
        <Conversation copy={copy} history={props.history} stages={props.stages} />
      )}
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Understood({ copy, items }: { copy: Copy; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-surface/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm"
      >
        <span className="font-medium">{copy.understoodTitle}</span>
        <span className="text-muted">
          {items.length} {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-1.5 px-4 pb-3 text-sm text-muted">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent">•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thinking({ copy, title, understood, hint }: { copy: Copy; title: string; understood: string[]; hint?: string }) {
  return (
    <section className="card-in flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface px-6 py-10 text-center shadow-sm">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="thinking-dot size-2.5 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-base font-medium" role="status">
        {title}
      </p>
      {hint && <p className="max-w-xs text-sm text-muted">{hint}</p>}
      {understood.length > 0 && (
        <ul className="mt-2 flex w-full flex-col gap-1 text-left text-sm text-muted">
          <li className="text-xs font-medium tracking-wide uppercase">{copy.understoodTitle}</li>
          {understood.map((item, i) => (
            <li key={i}>• {item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Failed({ copy, slug, interviewId, error }: { copy: Copy; slug: string; interviewId: string; error: string | null }) {
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-8 text-center">
      <p className="font-medium">{copy.failed}</p>
      {error && <p className="text-xs text-muted">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => retryRound({ slug, interviewId }))}
        className="min-h-11 rounded-full bg-accent px-6 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "…" : copy.retry}
      </button>
    </section>
  );
}

type Draft = { picked: string[]; text: string; voice: boolean; seconds: number; skipped: boolean };
const EMPTY: Draft = { picked: [], text: "", voice: false, seconds: 0, skipped: false };

function answered(q: RoundQuestion, d: Draft) {
  if (d.skipped) return true;
  if (q.answer === "open") return d.text.trim().length > 0;
  return d.picked.length > 0 && (!d.picked.includes("other") || d.text.trim().length > 0);
}

function parseDrafts(saved: string): Record<string, Draft> {
  if (!saved) return {};
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function Cards({
  slug,
  copy,
  interviewId,
  stage,
  roundNumber,
  round,
  pending,
  onSending,
  onResult,
}: {
  slug: string;
  copy: Copy;
  interviewId: string;
  stage: Stage;
  roundNumber: number;
  round: Round;
  pending: PendingFile[];
  onSending: (sending: boolean) => void;
  onResult: (result: { ok: true; masked: Masked[] } | { ok: false; error: string }) => void;
}) {
  // An unsent round survives closing the page.
  const [saved, save] = useRemembered(`discovery:${interviewId}:${stage}:${roundNumber}`);
  const drafts = useMemo(() => parseDrafts(saved), [saved]);
  const setDrafts = (next: Record<string, Draft>) => save(JSON.stringify(next));
  const [index, setIndex] = useState(0);
  const [sending, startSending] = useTransition();
  const shownAt = useRef(0);
  const questions = round.questions;
  const q = questions[index];
  const draft = drafts[q.id] ?? EMPTY;

  // The seconds on a card count from when it shows.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const options = useMemo(() => displayOptions(q.options, q.id), [q]);

  function patch(next: Partial<Draft>) {
    setDrafts({ ...drafts, [q.id]: { ...draft, ...next, skipped: next.skipped ?? false } });
  }

  /** Adds the time on this card to its answer, then moves. */
  function go(to: number, extra?: Partial<Draft>) {
    const spent = (Date.now() - shownAt.current) / 1000;
    const current = { ...draft, ...extra };
    setDrafts({ ...drafts, [q.id]: { ...current, seconds: current.seconds + spent } });
    setIndex(to);
  }

  function toggle(id: string) {
    if (q.answer === "one") return patch({ picked: draft.picked[0] === id ? [] : [id] });
    const option = q.options.find((o) => o.id === id);
    if (option && isNoneOption(option)) return patch({ picked: draft.picked.includes(id) ? [] : [id] });
    const without = draft.picked.filter((p) => p !== id && !q.options.find((o) => o.id === p && isNoneOption(o)));
    patch({ picked: draft.picked.includes(id) ? without : [...without, id] });
  }

  function send(last: Partial<Draft>) {
    const spent = (Date.now() - shownAt.current) / 1000;
    const final = { ...drafts, [q.id]: { ...(drafts[q.id] ?? EMPTY), ...last } };
    final[q.id] = { ...final[q.id], seconds: final[q.id].seconds + spent };
    const answers: Answer[] = questions.map((question) => {
      const d = final[question.id] ?? { ...EMPTY, skipped: true };
      return {
        q: question.id,
        picked: d.skipped ? [] : d.picked,
        text: d.skipped ? "" : d.text.trim(),
        input: d.voice ? "voice" : "text",
        seconds: Math.round(d.seconds * 10) / 10,
        skipped: d.skipped || !answered(question, d),
      };
    });
    onSending(true);
    startSending(async () => {
      const result = await submitAnswers({ slug, interviewId, answers });
      if (result.ok) save("");
      onSending(false);
      onResult(result);
    });
  }

  const isLast = index === questions.length - 1;
  const ready = answered(q, draft);

  return (
    <section className="flex flex-col gap-4">
      {index === 0 && (round.intro || round.privacy_note) && (
        <div className="card-in flex flex-col gap-2">
          {round.intro && (
            <p className="rounded-3xl rounded-tl-md bg-accent/10 px-4 py-3 text-[15px] leading-relaxed">{round.intro}</p>
          )}
          {round.privacy_note && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              {round.privacy_note}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2" aria-label={copy.question(index + 1, questions.length)}>
        {questions.map((question, i) => (
          <span
            key={question.id}
            className={`h-1.5 flex-1 rounded-full transition ${
              i === index ? "bg-accent" : answered(question, drafts[question.id] ?? EMPTY) ? "bg-accent/40" : "bg-line"
            }`}
          />
        ))}
      </div>

      <article key={q.id} className="card-in flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{copy.question(index + 1, questions.length)}</p>
        <h2 className="text-xl leading-snug font-semibold">{q.text}</h2>
        {q.hint && <p className="-mt-2 text-sm text-muted">{q.hint}</p>}

        {q.answer !== "open" && (
          <div className="flex flex-col gap-2" role={q.answer === "one" ? "radiogroup" : "group"}>
            {[...options, { id: "other", label: copy.other, origin: "theirs" as const }].map((o) => {
              const on = draft.picked.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  role={q.answer === "one" ? "radio" : "checkbox"}
                  aria-checked={on}
                  onClick={() => toggle(o.id)}
                  className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-[15px] transition active:scale-[0.99] ${
                    on ? "border-accent bg-accent/10 font-medium" : "border-line bg-background/60 hover:border-accent/50"
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center border text-[11px] ${
                      q.answer === "one" ? "rounded-full" : "rounded-md"
                    } ${on ? "border-accent bg-accent text-white" : "border-line bg-surface"}`}
                    aria-hidden
                  >
                    {on ? "✓" : ""}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        {(q.answer === "open" || draft.picked.length > 0) && (
          <VoiceField
            slug={slug}
            copy={copy}
            label={q.answer === "open" ? copy.yourAnswer : copy.addComment}
            placeholder={q.answer === "open" ? copy.typeOrSpeak : copy.addComment}
            value={draft.text}
            onChange={(text, fromVoice) => patch(fromVoice ? { text, voice: true } : { text })}
            rows={q.answer === "open" ? 4 : 2}
            autoFocus={draft.picked.includes("other")}
          />
        )}
      </article>

      {isLast && <Attachments slug={slug} interviewId={interviewId} copy={copy} pending={pending} />}

      <div className="flex items-center gap-2">
        {index > 0 && (
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="min-h-12 rounded-full border border-line bg-surface px-5 text-sm"
          >
            {copy.previous}
          </button>
        )}
        <button
          type="button"
          disabled={!ready || sending}
          onClick={() => (isLast ? send({}) : go(index + 1))}
          className="min-h-12 flex-1 rounded-full bg-accent px-6 text-base font-medium text-white shadow-sm transition disabled:opacity-40"
        >
          {isLast ? (sending ? copy.sendingRound : copy.send) : copy.next}
        </button>
      </div>
      <button
        type="button"
        disabled={sending}
        onClick={() => (isLast ? send({ skipped: true }) : go(index + 1, { skipped: true, picked: [], text: "" }))}
        className="self-center text-sm text-muted underline underline-offset-4"
      >
        {copy.skip}
      </button>
    </section>
  );
}

function Closing({
  slug,
  copy,
  interviewId,
  understood,
  pending,
  goesOn,
  next,
  onSending,
  onResult,
  onNextTheme,
}: {
  slug: string;
  copy: Copy;
  interviewId: string;
  understood: string[];
  pending: PendingFile[];
  /** Another stage of this Theme follows. */
  goesOn: boolean;
  /** The Theme to go on with once this one ends; null on the last. */
  next: { id: string } | null;
  onSending: (sending: boolean) => void;
  onResult: (result: { ok: true; masked: Masked[] } | { ok: false; error: string }) => void;
  onNextTheme: (themeId: string) => void;
}) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const [sending, start] = useTransition();
  return (
    <section className="card-in flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{copy.closingTitle}</h2>
      <ul className="flex flex-col gap-2">
        {understood.length === 0 && <li className="text-sm text-muted">{copy.understoodEmpty}</li>}
        {understood.map((item, i) => (
          <li key={i} className="rounded-2xl bg-accent/5 px-4 py-2.5 text-[15px] leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
      <p className="font-medium">{copy.closingAsk}</p>
      <VoiceField slug={slug} copy={copy} label={copy.closingAsk} value={text} onChange={(next, fromVoice) => {
          setText(next);
          if (fromVoice) setVoice(true);
        }}
      />
      <Attachments slug={slug} interviewId={interviewId} copy={copy} pending={pending} />
      <button
        type="button"
        disabled={sending}
        onClick={() => {
          if (goesOn) onSending(true);
          start(async () => {
            const result = await finishStage({ slug, interviewId, text, input: voice ? "voice" : "text" });
            // "Terminar y pasar al siguiente tema" does what it says (Ronda 57, Q13).
            if (result.ok && !goesOn && next) onNextTheme(next.id);
            onSending(false);
            onResult(result);
          });
        }}
        className="min-h-12 rounded-full bg-accent px-6 text-base font-medium text-white shadow-sm disabled:opacity-50"
      >
        {sending ? copy.sendingRound : goesOn ? copy.closingNext : next ? copy.finishAndNext : copy.finish}
      </button>
    </section>
  );
}

/**
 * A finished Theme (Q55–Q57, Ronda 57): while Themes are left, the progress
 * and the next one, so it never feels like the end of everything; after the
 * last, finishing. Adding more stays possible (Q27), behind a link until the end.
 */
function Done({
  slug,
  copy,
  interviewId,
  pending,
  onResult,
  isTest,
  next,
  themes,
  themeId,
  firstName,
}: {
  slug: string;
  copy: Copy;
  interviewId: string;
  pending: PendingFile[];
  onResult: (result: { ok: true; masked: Masked[] } | { ok: false; error: string }) => void;
  isTest: boolean;
  /** The Theme to go on with; null once every Theme is done. */
  next: { id: string; title: string } | null;
  themes: ThemeProgress[];
  themeId: string;
  firstName: string;
}) {
  const [adding, setAdding] = useState(!next);
  return (
    <>
      {next ? (
        <ThemeCheer copy={copy} name={firstName} themes={themes} finished={themeId}>
          <div className="flex w-full flex-col items-center gap-1">
            <Link
              href={`/d/${slug}/t/${next.id}`}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-white shadow-sm active:scale-[0.99]"
            >
              {copy.nextTheme(next.title)} →
            </Link>
            <SignOutButton slug={slug} look="quiet" label={isTest ? copy.finishTest : copy.finishForNow} />
          </div>
        </ThemeCheer>
      ) : (
        <section className="card-in flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-8 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent/10 text-2xl text-accent">✓</span>
          <h2 className="text-xl font-semibold">{copy.allDoneTitle}</h2>
          <p className="max-w-sm text-sm text-muted">{copy.doneBody}</p>
          <div className="mt-4 flex w-full flex-col items-center gap-1">
            <SignOutButton slug={slug} look="primary" label={isTest ? copy.finishTest : copy.finishAndSignOut} />
            <Link href={`/d/${slug}`} className="flex min-h-11 w-full items-center justify-center text-sm font-medium text-accent">
              {copy.backToMenu}
            </Link>
          </div>
        </section>
      )}
      {adding ? (
        <AddMore slug={slug} copy={copy} interviewId={interviewId} pending={pending} onResult={onResult} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-11 self-start text-sm text-muted underline underline-offset-4"
        >
          + {copy.addMoreLink}
        </button>
      )}
    </>
  );
}

/** Something more for a finished Theme: text, voice or files (Q27). */
function AddMore({
  slug,
  copy,
  interviewId,
  pending,
  onResult,
}: {
  slug: string;
  copy: Copy;
  interviewId: string;
  pending: PendingFile[];
  onResult: (result: { ok: true; masked: Masked[] } | { ok: false; error: string }) => void;
}) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, start] = useTransition();
  return (
    <section className="card-in flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
      <h3 className="font-medium">{copy.addMoreTitle}</h3>
      <VoiceField
        slug={slug}
        copy={copy}
        label={copy.addMoreTitle}
        value={text}
        onChange={(next, fromVoice) => {
          setText(next);
          setSent(false);
          if (fromVoice) setVoice(true);
        }}
      />
      <Attachments slug={slug} interviewId={interviewId} copy={copy} pending={pending} />
      {sent && <p className="text-sm text-accent">{copy.added}</p>}
      <button
        type="button"
        disabled={sending || (!text.trim() && pending.length === 0)}
        onClick={() =>
          start(async () => {
            const result = await addMore({ slug, interviewId, text, input: voice ? "voice" : "text" });
            if (result.ok) {
              setText("");
              setVoice(false);
              setSent(true);
            }
            onResult(result);
          })
        }
        className="min-h-11 self-end rounded-full bg-accent px-6 text-sm font-medium text-white disabled:opacity-40"
      >
        {sending ? copy.sendingRound : copy.addMoreSend}
      </button>
    </section>
  );
}

/** What they said, closed until they ask for it: reading it shouldn't pull them out of the flow (Ronda 57). */
function Conversation({ copy, history, stages }: { copy: Copy; history: HistoryBlock[]; stages: Stage[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-sm text-muted underline underline-offset-4">
        {open ? copy.hideConversation : copy.conversation}
      </button>
      {open && (
        <div className="flex flex-col gap-4">
          {history.map((block, i) =>
            block.kind === "round" ? (
              <div key={i} className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  {block.stage === "needs" ? copy.needs : copy.vision} ·{" "}
                  {copy.round(themeRound(stages, block.stage, block.round).n, themeRound(stages, block.stage, block.round).of)}
                </p>
                {block.intro && <p className="rounded-2xl rounded-tl-md bg-accent/10 px-3 py-2 text-sm">{block.intro}</p>}
                {block.qa.map((item, j) => (
                  <div key={j} className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="self-end rounded-2xl rounded-tr-md bg-surface px-3 py-2 text-sm text-muted ring-1 ring-line">
                      {item.answer ?? copy.skipped}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-1">
                <p className="self-end rounded-2xl rounded-tr-md bg-surface px-3 py-2 text-sm text-muted ring-1 ring-line">
                  {block.text || copy.skipped}
                  {block.files.length > 0 && <span className="block text-xs">📎 {block.files.join(", ")}</span>}
                </p>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
