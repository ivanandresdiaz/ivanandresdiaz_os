"use client";

import Link from "next/link";
import { formatMinutes, WEEKDAY_NAMES, weekdayOf } from "@/domain/dates";
import { toggleWorkDone } from "@/server/actions";
import type { StackItem } from "@/server/queries";
import { WORK_MIME, type WorkDrop } from "./time-grid";

/** The work to place on the calendar. Drag an item onto a day. */
export function Stack({
  thisWeek,
  carriedOver,
  loose,
}: {
  thisWeek: StackItem[];
  carriedOver: StackItem[];
  loose: StackItem[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Carried over" items={carriedOver} empty={null} />
      <Section
        title="This week's Moves"
        items={thisWeek}
        empty={
          <p className="text-sm text-muted">
            No Moves chosen for this week. Pick them in a{" "}
            <Link href="/os/plan" className="underline">
              Campaign
            </Link>
            .
          </p>
        }
      />
      <Section title="Loose Tasks" items={loose} empty={null} />
    </div>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: StackItem[];
  empty: React.ReactNode;
}) {
  if (items.length === 0 && empty === null) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="label">{title}</h3>
      {items.length === 0 ? empty : items.map((item) => <Row key={`${item.kind}:${item.id}`} item={item} />)}
    </section>
  );
}

function Row({ item }: { item: StackItem }) {
  const drop: WorkDrop = { kind: item.kind, id: item.id, durationMin: item.durationMin };
  return (
    <div
      draggable={!item.done}
      onDragStart={(event) => {
        event.dataTransfer.setData(WORK_MIME, JSON.stringify(drop));
        event.dataTransfer.effectAllowed = "copy";
      }}
      className={`flex items-start gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm ${
        item.done ? "opacity-50" : "cursor-grab active:cursor-grabbing"
      }`}
      style={{ borderLeft: `4px solid ${item.color}` }}
    >
      <input
        type="checkbox"
        className="mt-1"
        checked={item.done}
        onChange={() => toggleWorkDone({ kind: item.kind, id: item.id })}
        aria-label={`${item.title} done`}
      />
      <div className="min-w-0 flex-1">
        <div className={`leading-tight ${item.done ? "line-through" : ""}`}>
          {item.title}
          {item.carried && (
            <span
              className="ml-1.5 rounded bg-amber-500/15 px-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
              title={`Scheduled ${item.carried.times} day(s) without finishing; last on ${item.carried.lastDate}`}
            >
              ×{item.carried.times}
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-muted">
          {[
            item.kind === "task" ? item.parentTitle : "Move",
            item.campaignTitle,
            `${item.durationMin} min`,
            item.stepsTotal > 0 ? `${item.stepsDone}/${item.stepsTotal} steps` : null,
            item.scheduled
              ? `on ${WEEKDAY_NAMES[weekdayOf(item.scheduled.date)].slice(0, 3)} ${formatMinutes(item.scheduled.startMin)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    </div>
  );
}
