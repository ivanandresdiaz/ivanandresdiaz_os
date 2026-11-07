"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMinutes, WEEKDAY_NAMES, weekdayOf, type IsoDate } from "@/domain/dates";
import { slotStarted } from "@/domain/reminders";
import { type DayBlockRef, isDayEditable, structureOverlaps } from "@/domain/structure";
import {
  backToStructure,
  changeDayBlock,
  deleteSlot,
  scheduleWork,
  toggleHabit,
  toggleWorkDone,
  updateSlot,
} from "@/server/actions";
import type { BlockType, CalendarBlock, CalendarDay, CalendarFocus, CalendarSlot } from "@/server/queries";
import { DayBlockDialog, type DayBlockDraft } from "./day-block-dialog";
import { HighlightStar } from "./highlight-star";
import { ReminderBell } from "./reminder-bell";
import { DetailsMark } from "./work-details";
import { StartCycleButton } from "./start-cycle-button";
import { TimeGrid, type GridItem } from "./time-grid";
import { UpkeepMark, useDoneToggle } from "./upkeeps";

type BlockItem = GridItem & {
  layer: "block";
  block: CalendarBlock;
  habitDone: boolean;
  editable: boolean;
  overlaps: CalendarBlock[];
};

type Item =
  | BlockItem
  | (GridItem & { layer: "work"; slot: CalendarSlot; dayHighlights: number })
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

function refOf(block: CalendarBlock): DayBlockRef {
  const { date, startMin, endMin, blockTypeId, structureBlockId, exceptionId } = block;
  return { date, startMin, endMin, blockTypeId, structureBlockId, exceptionId };
}

/** The Blocks each Block of the day overlaps, by Block key (a Warning, never a rule). */
function overlapsByKey(blocks: CalendarBlock[]) {
  const found = new Map<string, CalendarBlock[]>();
  const placed = blocks.map((b) => ({ ...b, id: b.key, weekday: weekdayOf(b.date) }));
  for (const [a, b] of structureOverlaps(placed)) {
    found.set(a.key, [...(found.get(a.key) ?? []), b]);
    found.set(b.key, [...(found.get(b.key) ?? []), a]);
  }
  return found;
}

export function Calendar({
  days,
  today,
  timeZone,
  blockTypes,
  calendarConnected,
}: {
  days: CalendarDay[];
  today: IsoDate;
  timeZone: string;
  /** Whether Google Calendar is connected, for the bells (Reminders). */
  calendarConnected: boolean;
  /**
   * Only the Week passes them: there, with a mouse, the Blocks of today and
   * later dates change for that date only (Exceptions). The Day just shows them,
   * and a touch screen only reads.
   */
  blockTypes?: BlockType[];
}) {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMinute(nowMinute(timeZone));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [timeZone]);
  const [draft, setDraft] = useState<DayBlockDraft | null>(null);
  /** A Warning from the last move of a Slot (a star that could not follow it). */
  const [notice, setNotice] = useState<string | null>(null);

  const single = days.length === 1;
  const editable = (date: IsoDate) => blockTypes !== undefined && isDayEditable(date, today);
  const items: Item[] = days.flatMap((day) => {
    const overlaps = blockTypes ? overlapsByKey(day.blocks) : new Map<string, CalendarBlock[]>();
    return [
      ...day.blocks.map(
        (block): Item => ({
          id: block.key,
          column: day.date,
          startMin: block.startMin,
          endMin: block.endMin,
          layer: "block",
          drag: editable(day.date) ? "mouse" : "none",
          crossColumn: false,
          block,
          habitDone: day.habitsDone.includes(block.blockTypeId),
          editable: editable(day.date),
          overlaps: overlaps.get(block.key) ?? [],
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
          dayHighlights: day.highlightCount,
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
    ];
  });

  return (
    <>
      {notice && (
        <div
          role="status"
          className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/50 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <span className="flex-1">⚠ {notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-muted hover:text-foreground">
            ×
          </button>
        </div>
      )}
      <TimeGrid<Item>
        columns={days.map((day) => ({
          key: day.date,
          highlight: day.date === today,
          locked: !editable(day.date),
          label: single ? (
            WEEKDAY_NAMES[weekdayOf(day.date)]
          ) : (
            <span className="inline-flex items-center gap-1">
              <Link href={`/os/day/${day.date}`} className="hover:underline">
                {WEEKDAY_NAMES[weekdayOf(day.date)].slice(0, 3)} {day.date.slice(8)}
              </Link>
              {day.changed && editable(day.date) && (
                <button
                  type="button"
                  className="text-muted hover:text-accent"
                  onClick={() => backToStructure({ date: day.date })}
                  title="Back to the Structure for this day"
                  aria-label={`Back to the Structure for ${day.date}`}
                >
                  ↺
                </button>
              )}
            </span>
          ),
        }))}
        items={items}
        now={minute !== null && days.some((d) => d.date === today) ? { column: today, minute } : undefined}
        touchTaps={false}
        ghosts={draft?.kind === "create" ? [{ column: draft.date, startMin: draft.startMin, endMin: draft.endMin }] : []}
        onCreate={
          blockTypes &&
          ((range) => {
            if (editable(range.column)) setDraft({ kind: "create", date: range.column, ...pick(range) });
          })
        }
        onItemClick={(item) => {
          if (item.layer === "block" && item.editable) setDraft({ kind: "edit", block: refOf(item.block) });
        }}
        onChange={async (item, next) => {
          if (item.layer === "focus") return;
          if (item.layer === "work") {
            const { warning } = await updateSlot({ id: item.slot.id, date: next.column, ...pick(next) });
            setNotice(warning);
          } else {
            await changeDayBlock(refOf(item.block), pick(next));
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
            <SlotView
              slot={item.slot}
              startMin={pos.startMin}
              endMin={pos.endMin}
              compact={!single}
              today={today}
              // Until the clock is read, only a past day counts as started.
              started={slotStarted(item.slot, { date: today, minute: minute ?? -1 })}
              calendarConnected={calendarConnected}
              dayHighlights={item.dayHighlights}
            />
          )
        }
      />
      {draft && blockTypes && <DayBlockDialog draft={draft} types={blockTypes} onClose={() => setDraft(null)} />}
    </>
  );
}

function pick(p: { startMin: number; endMin: number }) {
  return { startMin: p.startMin, endMin: p.endMin };
}

function BlockView({ item, startMin, endMin }: { item: BlockItem; startMin: number; endMin: number }) {
  const { block, habitDone, editable, overlaps } = item;
  const habit = block.type.kind === "habit";
  const warning = overlaps
    .map((o) => `${o.type.name} ${formatMinutes(o.startMin)}–${formatMinutes(o.endMin)}`)
    .join(", ");
  return (
    <div
      className={`group h-full overflow-hidden rounded-sm border-l-4 px-1 text-[11px] leading-tight ${
        warning ? "outline-2 outline-amber-500" : ""
      }`}
      style={{
        borderColor: block.type.color,
        background: `${block.type.color}${habit && habitDone ? "55" : "22"}`,
      }}
      title={`${block.type.name} ${formatMinutes(startMin)}–${formatMinutes(endMin)}${
        block.exceptionId ? " (changed for this day)" : ""
      }${warning ? `\n⚠ Overlaps ${warning}` : ""}`}
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
        <span className="truncate font-medium">
          {warning && <span className="text-amber-600 dark:text-amber-400">⚠ </span>}
          {block.type.name}
        </span>
        {block.exceptionId && <span className="text-muted">*</span>}
        {editable && (
          <button
            type="button"
            className="ml-auto hidden text-muted hover:text-red-600 group-hover:block"
            {...stop}
            onClick={() => changeDayBlock(refOf(block), "remove")}
            title="Remove for this day"
          >
            ×
          </button>
        )}
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
  today,
  started,
  calendarConnected,
  dayHighlights,
}: {
  slot: CalendarSlot;
  startMin: number;
  endMin: number;
  compact: boolean;
  today: IsoDate;
  started: boolean;
  calendarConnected: boolean;
  dayHighlights: number;
}) {
  const { work } = slot;
  const upkeep = useDoneToggle(today);
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
          onChange={() =>
            work.kind === "secondary" ? upkeep.toggle(work) : toggleWorkDone({ kind: work.kind, id: work.id })
          }
          aria-label={`${work.title} done`}
        />
        <span className={`flex-1 font-medium leading-tight ${work.done ? "line-through" : ""}`}>
          {work.title}
          {work.kind === "secondary" && work.upkeep && <UpkeepMark upkeepId={work.upkeep.id} date={slot.date} />}
          {work.hasDetails && <DetailsMark />}
        </span>
        {work.kind !== "secondary" && (
          <HighlightStar
            slot={{ ...slot, work: { kind: work.kind, id: work.id } }}
            title={work.title}
            campaignTitle={work.campaignTitle}
            done={work.done}
            today={today}
            dayCount={dayHighlights}
          />
        )}
        <ReminderBell
          slot={slot}
          title={work.title}
          done={work.done}
          started={started}
          connected={calendarConnected}
        />
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
      {upkeep.dialog}
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
