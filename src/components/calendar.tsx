"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMinutes, WEEKDAY_NAMES, weekdayOf, type IsoDate } from "@/domain/dates";
import {
  deleteSlot,
  scheduleWork,
  setException,
  toggleHabit,
  toggleWorkDone,
  updateExceptionTimes,
  updateSlot,
} from "@/server/actions";
import type { CalendarBlock, CalendarDay, CalendarFocus, CalendarSlot } from "@/server/queries";
import { StartCycleButton } from "./start-cycle-button";
import { TimeGrid, type GridItem } from "./time-grid";

type Item =
  | (GridItem & { layer: "block"; block: CalendarBlock; habitDone: boolean })
  | (GridItem & { layer: "work"; slot: CalendarSlot })
  | (GridItem & { layer: "focus"; focus: CalendarFocus });

const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

function nowMinute(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

export function Calendar({
  days,
  today,
  timeZone,
}: {
  days: CalendarDay[];
  today: IsoDate;
  timeZone: string;
}) {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMinute(nowMinute(timeZone));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [timeZone]);

  // The Day shows the Blocks as they are; only the Week (with a mouse) changes
  // one date of them. On a touch screen the Week is read-only: too small to drag.
  const single = days.length === 1;
  const items: Item[] = days.flatMap((day) => [
    ...day.blocks.map(
      (block): Item => ({
        id: block.key,
        column: day.date,
        startMin: block.startMin,
        endMin: block.endMin,
        layer: "block",
        // Dragging a Block changes that date only (an Exception).
        drag: single ? "none" : "mouse",
        crossColumn: false,
        block,
        habitDone: day.habitsDone.includes(block.blockTypeId),
      }),
    ),
    ...day.slots.map(
      (slot): Item => ({
        id: slot.id,
        column: day.date,
        startMin: slot.startMin,
        endMin: slot.endMin,
        layer: "work",
        drag: single ? "any" : "mouse",
        crossColumn: true,
        slot,
      }),
    ),
    ...day.focus.map(
      (focus): Item => ({
        id: `f:${focus.id}`,
        column: day.date,
        startMin: focus.startMin,
        endMin: focus.endMin,
        layer: "focus",
        drag: "none",
        crossColumn: false,
        focus,
      }),
    ),
  ]);

  return (
    <TimeGrid<Item>
      columns={days.map((day) => ({
        key: day.date,
        highlight: day.date === today,
        label: single ? (
          WEEKDAY_NAMES[weekdayOf(day.date)]
        ) : (
          <Link href={`/os/day/${day.date}`} className="hover:underline">
            {WEEKDAY_NAMES[weekdayOf(day.date)].slice(0, 3)} {day.date.slice(8)}
          </Link>
        ),
      }))}
      items={items}
      now={minute !== null && days.some((d) => d.date === today) ? { column: today, minute } : undefined}
      onChange={async (item, next) => {
        if (item.layer === "focus") return;
        if (item.layer === "work") {
          await updateSlot({ id: item.slot.id, date: next.column, ...pick(next) });
        } else if (item.block.structureBlockId === null && item.block.exceptionId) {
          await updateExceptionTimes({ id: item.block.exceptionId, ...pick(next) });
        } else {
          await setException({
            date: item.block.date,
            structureBlockId: item.block.structureBlockId,
            removed: false,
            blockTypeId: item.block.blockTypeId,
            ...pick(next),
          });
        }
      }}
      onDropWork={async (column, startMin, work) => {
        await scheduleWork({
          kind: work.kind,
          id: work.id,
          date: column,
          startMin,
          endMin: Math.min(startMin + work.durationMin, 24 * 60),
        });
      }}
      renderItem={(item, pos) =>
        item.layer === "focus" ? (
          <FocusBar focus={item.focus} />
        ) : item.layer === "block" ? (
          <BlockView item={item} startMin={pos.startMin} endMin={pos.endMin} />
        ) : (
          <SlotView slot={item.slot} startMin={pos.startMin} endMin={pos.endMin} compact={!single} />
        )
      }
    />
  );
}

function pick(p: { startMin: number; endMin: number }) {
  return { startMin: p.startMin, endMin: p.endMin };
}

function BlockView({
  item,
  startMin,
  endMin,
}: {
  item: Extract<Item, { layer: "block" }>;
  startMin: number;
  endMin: number;
}) {
  const { block, habitDone } = item;
  const habit = block.type.kind === "habit";
  return (
    <div
      className="h-full overflow-hidden rounded-sm border-l-4 px-1 text-[11px] leading-tight"
      style={{
        borderColor: block.type.color,
        background: `${block.type.color}${habit && habitDone ? "55" : "22"}`,
      }}
      title={`${block.type.name} ${formatMinutes(startMin)}–${formatMinutes(endMin)}${
        block.exceptionId ? " (changed for this day)" : ""
      }`}
    >
      <div className="flex items-start gap-1">
        {habit && (
          <input
            type="checkbox"
            className="mt-0.5 accent-current"
            checked={habitDone}
            {...stop}
            onChange={() => toggleHabit({ date: block.date, blockTypeId: block.blockTypeId })}
            aria-label={`${block.type.name} done`}
          />
        )}
        <span className="truncate font-medium">{block.type.name}</span>
        {block.exceptionId && <span className="text-muted">*</span>}
      </div>
      {endMin - startMin >= 45 && (
        <div className="text-muted">
          {formatMinutes(startMin)}–{formatMinutes(endMin)}
        </div>
      )}
    </div>
  );
}

function SlotView({
  slot,
  startMin,
  endMin,
  compact,
}: {
  slot: CalendarSlot;
  startMin: number;
  endMin: number;
  compact: boolean;
}) {
  const { work } = slot;
  return (
    <div
      className={`group h-full overflow-hidden rounded-md border bg-surface px-1.5 py-0.5 text-xs shadow-sm ${
        work.done ? "opacity-60" : ""
      }`}
      style={{ borderColor: work.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start gap-1">
        <input
          type="checkbox"
          checked={work.done}
          {...stop}
          onChange={() => toggleWorkDone({ kind: work.kind, id: work.id })}
          aria-label={`${work.title} done`}
        />
        <span className={`flex-1 font-medium leading-tight ${work.done ? "line-through" : ""}`}>
          {work.title}
        </span>
        {!work.done && work.kind !== "secondary" && <StartCycleButton slotId={slot.id} className="text-[10px]" />}
        <button
          type="button"
          className="hidden text-muted hover:text-red-600 group-hover:block"
          {...stop}
          onClick={() => deleteSlot({ id: slot.id })}
          title="Remove from calendar"
        >
          ×
        </button>
      </div>
      {!compact || endMin - startMin >= 45 ? (
        <div className="truncate text-[10px] text-muted">
          {formatMinutes(startMin)}–{formatMinutes(endMin)}
          {work.kind === "secondary" ? " · Secondary" : ""}
          {work.campaignTitle ? ` · ${work.campaignTitle}` : ""}
          {work.stepsTotal > 0 ? ` · ${work.stepsDone}/${work.stepsTotal}` : ""}
        </div>
      ) : null}
    </div>
  );
}

/** Real focus from a Cycle: separate from the plan, on the column's left edge. */
function FocusBar({ focus }: { focus: CalendarFocus }) {
  return (
    <div
      className={`h-full rounded-full ${focus.running ? "animate-pulse bg-amber-500" : focus.complete ? "bg-amber-500/80" : "bg-amber-500/40"}`}
      title={`Real focus: ${focus.title} ${formatMinutes(focus.startMin)}–${formatMinutes(focus.endMin)}${
        focus.complete ? " ✓" : focus.running ? " (running)" : " (closed early)"
      }`}
    />
  );
}
