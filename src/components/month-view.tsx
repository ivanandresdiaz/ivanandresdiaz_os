"use client";

import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { formatMinutes, monthOf, WEEKDAY_NAMES, WEEKDAYS, weekdayOf, type IsoDate } from "@/domain/dates";
import { monthMove } from "@/domain/upkeeps";
import { moveSecondaryTaskInMonth } from "@/server/actions";
import type { MonthDay, MonthItem, UpkeepView } from "@/server/queries";
import { ReminderMark } from "./reminder-bell";
import { UpkeepsDrawer } from "./upkeeps";

type Move = { key: string; from: IsoDate; to: IsoDate; keepsHour: boolean };

/**
 * The Month: look ahead, reach a far day, and drag a pending Secondary Task
 * (an Upkeep's occurrence too) to another day. Strategy is not moved here.
 */
export function MonthView({
  month,
  days,
  today,
  upkeeps,
  focusUpkeepId,
  header,
}: {
  month: string;
  days: MonthDay[];
  today: IsoDate;
  upkeeps: UpkeepView[];
  focusUpkeepId: string | null;
  header: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState<{ focusId: string | null } | null>(
    focusUpkeepId ? { focusId: focusUpkeepId } : null,
  );
  const [shown, applyMove] = useOptimistic(days, (state, move: Move) => {
    const item = state.find((d) => d.date === move.from)?.items.find((i) => i.key === move.key);
    if (!item) return state;
    const moved = move.keepsHour ? item : { ...item, startMin: null };
    return state.map((day) =>
      day.date === move.from
        ? { ...day, items: day.items.filter((i) => i.key !== move.key) }
        : day.date === move.to
          ? { ...day, items: [...day.items, moved] }
          : day,
    );
  });
  const [, startTransition] = useTransition();
  // A drag ends with a click on whatever is under the pointer: it must not open that Day.
  const dragging = useRef(false);

  function openDrawer(focusId: string | null) {
    setDrawer({ focusId });
  }

  function closeDrawer() {
    setDrawer(null);
    // Drop ?upkeep= so a refresh does not open it again.
    if (focusUpkeepId) router.replace(pathname, { scroll: false });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {header}
        <button type="button" className="btn ml-auto" onClick={() => openDrawer(null)}>
          ↻ Upkeeps
        </button>
      </div>
      <p className="-mt-2 text-xs text-muted">
        Click a day to open it. Drag a Secondary Task to move it to another day.
      </p>

      <DragDropProvider
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragEnd={(event) => {
          setTimeout(() => (dragging.current = false), 0);
          if (event.canceled) return;
          const source = event.operation.source;
          const target = event.operation.target;
          if (!source || !target) return;
          const { item, from } = source.data as { item: MonthItem; from: IsoDate };
          const to = String(target.id) as IsoDate;
          if (!item.movable) return;
          const move = monthMove({ slot: item.movable.slot }, to, today);
          if (!move || (move.kind === "day" && from === to)) return;
          const { secondaryTaskId, slot } = item.movable;
          startTransition(async () => {
            applyMove({ key: item.key, from, to, keepsHour: move.kind === "slot" });
            await moveSecondaryTaskInMonth({ id: secondaryTaskId, slotId: slot?.id ?? null, date: to });
          });
        }}
      >
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="bg-surface py-1 text-center text-[11px] text-muted">
              {WEEKDAY_NAMES[weekday].slice(0, 3)}
            </div>
          ))}
          {shown.map((day) => (
            <DayCell
              key={day.date}
              day={day}
              outside={monthOf(day.date) !== month}
              today={today}
              onOpen={() => !dragging.current && router.push(`/os/day/${day.date}`)}
              onOpenUpkeep={openDrawer}
            />
          ))}
        </div>
      </DragDropProvider>

      {drawer && (
        <UpkeepsDrawer upkeeps={upkeeps} today={today} focusId={drawer.focusId} onClose={closeDrawer} />
      )}
    </>
  );
}

function DayCell({
  day,
  outside,
  today,
  onOpen,
  onOpenUpkeep,
}: {
  day: MonthDay;
  outside: boolean;
  today: IsoDate;
  onOpen: () => void;
  onOpenUpkeep: (id: string) => void;
}) {
  // A lived day's plan is not rewritten: nothing lands on it.
  const { ref, isDropTarget } = useDroppable({ id: day.date, disabled: day.date < today });
  return (
    <div
      ref={ref}
      title={`${WEEKDAY_NAMES[weekdayOf(day.date)]} ${day.date}`}
      onClick={onOpen}
      className={`flex min-h-20 min-w-0 cursor-pointer flex-col gap-0.5 bg-background p-1 hover:bg-surface sm:min-h-24 ${
        outside ? "opacity-45" : ""
      } ${isDropTarget ? "bg-surface ring-2 ring-accent ring-inset" : ""}`}
    >
      <Link
        href={`/os/day/${day.date}`}
        onClick={(event) => event.stopPropagation()}
        className={`self-start rounded px-1 text-xs ${
          day.date === today ? "bg-accent font-semibold text-background" : "text-muted"
        }`}
      >
        {Number(day.date.slice(8))}
      </Link>
      {day.items.map((item) =>
        item.movable ? (
          <MovableItem key={item.key} item={item} from={day.date} onOpenUpkeep={onOpenUpkeep} />
        ) : (
          <Item key={item.key} item={item} onOpenUpkeep={onOpenUpkeep} />
        ),
      )}
    </div>
  );
}

function MovableItem({
  item,
  from,
  onOpenUpkeep,
}: {
  item: MonthItem;
  from: IsoDate;
  onOpenUpkeep: (id: string) => void;
}) {
  const { ref, isDragging } = useDraggable({ id: item.key, data: { item, from } });
  return (
    <Item
      itemRef={ref}
      item={item}
      onOpenUpkeep={onOpenUpkeep}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "rounded bg-surface shadow-lg" : ""}`}
    />
  );
}

function Item({
  item,
  onOpenUpkeep,
  itemRef,
  className = "",
}: {
  item: MonthItem;
  onOpenUpkeep: (id: string) => void;
  itemRef?: (element: Element | null) => void;
  className?: string;
}) {
  return (
    <span
      ref={itemRef}
      className={`truncate border-l-2 pl-1 text-[11px] leading-tight ${
        item.done ? "text-muted line-through" : ""
      } ${className}`}
      style={{ borderColor: item.color }}
    >
      {/* On a phone the cell is too narrow for both: the title wins. */}
      {item.startMin !== null && (
        <span className="hidden text-muted tabular-nums sm:inline">{formatMinutes(item.startMin)} </span>
      )}
      {item.upkeepId && (
        <button
          type="button"
          // On a phone the title wins; "↻ Upkeeps" above opens them.
          className="mr-0.5 hidden text-muted hover:text-foreground sm:inline"
          title="Upkeep: open it"
          aria-label={`Open the Upkeep of ${item.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenUpkeep(item.upkeepId!);
          }}
        >
          ↻
        </button>
      )}
      {item.title}
      {item.reminder && ((item.reminder.leadMin !== null && !item.done) || item.reminder.failed) && (
        // On a phone the title wins, as with ↻.
        <span className="hidden sm:inline">
          <ReminderMark failed={item.reminder.failed} />
        </span>
      )}
    </span>
  );
}
