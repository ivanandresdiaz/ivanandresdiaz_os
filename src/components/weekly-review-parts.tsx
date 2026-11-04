"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { finishWeeklyReview, updateWeeklyReview } from "@/server/actions";
import { LongText } from "./long-text";
import { useRemembered } from "./use-remembered";

/**
 * The Review beside the calendar. It pushes the calendar instead of covering it, so
 * work can still be dragged, and folds to a thin strip to give that room back.
 * A phone has no room beside anything: there it fills the screen.
 */
export function ReviewFrame({
  heading,
  subheading,
  close,
  children,
}: {
  heading: string;
  subheading: string;
  /** Closes the panel; rendered next to the fold button. */
  close: React.ReactNode;
  children: React.ReactNode;
}) {
  const [remembered, remember] = useRemembered("weekly-review:folded");
  const folded = remembered === "1";

  return (
    <>
      {folded && (
        <button
          type="button"
          onClick={() => remember("0")}
          title="Expand Weekly Review"
          aria-label="Expand Weekly Review"
          className="hidden w-10 flex-col items-center gap-2 self-start rounded-lg border border-line bg-surface py-3 text-sm text-muted hover:text-foreground xl:flex"
        >
          <span aria-hidden="true">»</span>
          <span className="[writing-mode:vertical-rl]">Weekly Review</span>
        </button>
      )}
      <section
        aria-label="Weekly Review"
        className={`flex flex-col gap-4 bg-surface p-4 max-md:fixed max-md:inset-0 max-md:z-50 max-md:overflow-y-auto max-md:pt-[max(1rem,env(safe-area-inset-top))] md:rounded-xl md:border md:border-line xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)] xl:w-[340px] xl:self-start xl:overflow-y-auto ${folded ? "xl:hidden" : ""}`}
      >
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{heading}</h2>
            <div className="text-xs text-muted">{subheading}</div>
          </div>
          <button
            type="button"
            onClick={() => remember("1")}
            title="Collapse Weekly Review"
            aria-label="Collapse Weekly Review"
            className="hidden text-muted hover:text-foreground xl:block"
          >
            «
          </button>
          {close}
        </header>
        {children}
      </section>
    </>
  );
}

function FeltScore({ score, onChange }: { score: number | null; onChange: (score: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label" id="felt-score">
        How aligned did the week feel?
      </span>
      <div role="group" aria-labelledby="felt-score" className="grid grid-cols-10 gap-0.5">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={score === value}
            onClick={() => onChange(value)}
            className={`rounded border py-1 text-xs ${
              score === value ? "border-foreground bg-line font-semibold" : "border-line text-muted hover:text-foreground"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The close of the open Review. Going back a step keeps what was written, as a draft in this browser. */
export function FinishReview({ week, plans }: { week: string; plans: string }) {
  const router = useRouter();
  const [draftScore, setDraftScore] = useRemembered(`weekly-review:${week}:score`);
  const [notes, setNotes] = useRemembered(`weekly-review:${week}:notes`);
  const [finishing, startFinishing] = useTransition();
  const score = draftScore ? Number(draftScore) : null;

  function finish() {
    if (score === null) return;
    startFinishing(async () => {
      await finishWeeklyReview({ week, score, notes });
      setDraftScore("");
      setNotes("");
      router.push(`/os/week/${plans}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <FeltScore score={score} onChange={(value) => setDraftScore(String(value))} />
      <div className="flex flex-col gap-1">
        <span className="label">Notes</span>
        <LongText value={notes} onValueChange={setNotes} markdown aria-label="Notes" rows={4} />
      </div>
      <button type="button" className="btn-primary self-start disabled:opacity-50" disabled={score === null || finishing} onClick={finish}>
        {finishing ? "Finishing…" : "Finish Review"}
      </button>
    </div>
  );
}

/** A finished Review keeps its Moves; its score and notes can still be corrected. */
export function EditReview({ week, score: savedScore, notes: savedNotes }: { week: string; score: number; notes: string }) {
  const [score, setScore] = useState(savedScore);
  const [notes, setNotes] = useState(savedNotes);
  const [saving, startSaving] = useTransition();
  const dirty = score !== savedScore || notes.trim() !== savedNotes.trim();

  return (
    <div className="flex flex-col gap-3">
      <FeltScore score={score} onChange={setScore} />
      <div className="flex flex-col gap-1">
        <span className="label">Notes</span>
        <LongText value={notes} onValueChange={setNotes} markdown aria-label="Notes" rows={4} />
      </div>
      {dirty && (
        <button
          type="button"
          className="btn self-start"
          disabled={saving}
          onClick={() => startSaving(() => updateWeeklyReview({ week, score, notes }))}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}
