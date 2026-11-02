"use client";

import Link from "next/link";
import { reorderMoves } from "@/server/actions";
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

/** A Campaign's Moves in Ivan's priority; done ones sit below, out of it. */
export function MovePriority({ moves, selectedId }: { moves: MoveCard[]; selectedId?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <PriorityList
        items={moves.filter((m) => !m.done)}
        selectedId={selectedId}
        save={(ids) => reorderMoves({ ids })}
      >
        {(m) => <MoveLink move={m} />}
      </PriorityList>
      <ClosedList items={moves.filter((m) => m.done)} selectedId={selectedId}>
        {(m) => <MoveLink move={m} />}
      </ClosedList>
    </div>
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
