"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reorderMoves, toggleWorkDone } from "@/server/actions";
import { ClosedList, PriorityList } from "./priority-list";

export type MoveCard = {
  id: string;
  title: string;
  done: boolean;
  /** "This week", "Next week", "Week of 2026-11-16", or null while not chosen. */
  week: string | null;
  tasksDone: number;
  tasksTotal: number;
  /** Opens the Move in its column. */
  href: string;
};

/**
 * A Campaign's Moves in Ivan's priority; done ones sit below, out of it. Moves are ticked done
 * here, so the list keeps flowing: ticking the open Move hands its column to the next one.
 */
export function MovePriority({
  moves,
  selectedId,
  next,
}: {
  moves: MoveCard[];
  selectedId?: string | null;
  /** The Plan with no Move chosen, so the top open Move shows. */
  next: string;
}) {
  const row = (m: MoveCard) => (
    <>
      <DoneBox move={m} then={m.id === selectedId && !m.done ? next : undefined} />
      <MoveLink move={m} />
    </>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <PriorityList
        items={moves.filter((m) => !m.done)}
        selectedId={selectedId}
        save={(ids) => reorderMoves({ ids })}
      >
        {row}
      </PriorityList>
      <ClosedList items={moves.filter((m) => m.done)} selectedId={selectedId}>
        {row}
      </ClosedList>
    </div>
  );
}

function DoneBox({ move, then }: { move: MoveCard; then?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const label = move.done ? "Mark not done" : "Mark done";
  return (
    <button
      type="button"
      disabled={pending}
      title={label}
      aria-label={`${label}: ${move.title}`}
      className="mt-0.5 shrink-0 leading-none disabled:opacity-50"
      onClick={() =>
        startTransition(async () => {
          await toggleWorkDone({ kind: "move", id: move.id });
          if (then) router.replace(then, { scroll: false });
        })
      }
    >
      {move.done ? "☑" : "☐"}
    </button>
  );
}

function MoveLink({ move }: { move: MoveCard }) {
  return (
    <Link href={move.href} className="group flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
      <span className={`text-sm font-medium group-hover:text-accent ${move.done ? "line-through" : ""}`}>
        {move.title}
      </span>
      {move.week && <span className="rounded bg-accent/15 px-1.5 text-[11px] text-accent">{move.week}</span>}
      {move.tasksTotal > 0 && (
        <span className="text-xs text-muted">
          {move.tasksDone}/{move.tasksTotal} Tasks
        </span>
      )}
    </Link>
  );
}
