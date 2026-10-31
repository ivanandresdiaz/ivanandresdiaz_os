"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { formatMinutes } from "@/domain/dates";
import { DAY_END_MIN, moveTo, resizeTo, snap } from "@/domain/slots";

export const PX_PER_MIN = 1;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const CLICK_TOLERANCE_PX = 3;

export type GridColumn = { key: string; label: ReactNode; highlight?: boolean };

export type GridItem = {
  id: string;
  column: string;
  startMin: number;
  endMin: number;
  /** Blocks sit behind, full width; work sits on top, split in lanes when overlapping. */
  layer: "block" | "work";
  editable: boolean;
  /** Whether it can be dragged to another column. */
  crossColumn: boolean;
};

export type GridPosition = { column: string; startMin: number; endMin: number };

export type WorkDrop = { kind: "task" | "move"; id: string; durationMin: number };

export const WORK_MIME = "application/x-ivan-work";

type Drag<T extends GridItem> = {
  item: T;
  mode: "move" | "resize";
  originX: number;
  originY: number;
  moved: boolean;
  preview: GridPosition;
};

type Props<T extends GridItem> = {
  columns: GridColumn[];
  items: T[];
  renderItem: (item: T, position: GridPosition) => ReactNode;
  onChange: (item: T, next: GridPosition) => Promise<void>;
  onDropWork?: (column: string, startMin: number, work: WorkDrop) => Promise<void>;
  /** Draws a "now" line in this column. */
  now?: { column: string; minute: number };
  scrollToMin?: number;
  height?: string;
};

function samePosition(a: GridPosition, b: GridPosition) {
  return a.column === b.column && a.startMin === b.startMin && a.endMin === b.endMin;
}

/** Assigns overlapping work items to side-by-side lanes. */
function lanes<T extends GridItem>(items: T[], positionOf: (item: T) => GridPosition) {
  const sorted = [...items].sort((a, b) => positionOf(a).startMin - positionOf(b).startMin);
  const result = new Map<string, { lane: number; lanes: number }>();
  let group: T[] = [];
  let groupEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const assigned = group.map((item) => {
      const { startMin, endMin } = positionOf(item);
      let lane = laneEnds.findIndex((end) => end <= startMin);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = endMin;
      return { item, lane };
    });
    for (const { item, lane } of assigned) {
      result.set(item.id, { lane, lanes: laneEnds.length });
    }
    group = [];
  };
  for (const item of sorted) {
    const { startMin, endMin } = positionOf(item);
    if (group.length > 0 && startMin >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, endMin);
  }
  if (group.length > 0) flush();
  return result;
}

export function TimeGrid<T extends GridItem>({
  columns,
  items,
  renderItem,
  onChange,
  onDropWork,
  now,
  scrollToMin = 4.5 * 60,
  height = "calc(100vh - 9rem)",
}: Props<T>) {
  const scroller = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<Drag<T> | null>(null);
  // Positions sent to the server, shown until the server answers with them.
  const [pending, setPending] = useState(
    new Map<string, { from: GridPosition; to: GridPosition }>(),
  );
  const [dropHint, setDropHint] = useState<{ column: string; startMin: number; durationMin: number } | null>(null);

  useEffect(() => {
    // Wait a frame: the grid may mount before it has its full height.
    const frame = requestAnimationFrame(() => {
      scroller.current?.scrollTo({ top: scrollToMin * PX_PER_MIN });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToMin]);

  const positionOf = (item: T): GridPosition => {
    if (drag?.item.id === item.id) return drag.preview;
    const own: GridPosition = { column: item.column, startMin: item.startMin, endMin: item.endMin };
    const p = pending.get(item.id);
    return p && samePosition(p.from, own) ? p.to : own;
  };

  const columnAt = (clientX: number): string | null => {
    for (const [key, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return key;
    }
    return null;
  };

  const minuteAt = (column: string, clientY: number) => {
    const el = columnRefs.current.get(column);
    if (!el) return 0;
    return (clientY - el.getBoundingClientRect().top) / PX_PER_MIN;
  };

  const startDrag = (event: React.PointerEvent, item: T, mode: Drag<T>["mode"]) => {
    if (!item.editable || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setDrag({
      item,
      mode,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      preview: positionOf(item),
    });
  };

  const dragMove = (event: PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    if (!drag.moved && Math.hypot(dx, dy) < CLICK_TOLERANCE_PX) return;
    const base = { startMin: drag.item.startMin, endMin: drag.item.endMin };
    const deltaMin = dy / PX_PER_MIN;
    let preview: GridPosition;
    if (drag.mode === "resize") {
      preview = { column: drag.item.column, ...resizeTo(base, base.endMin + deltaMin) };
    } else {
      const column = (drag.item.crossColumn && columnAt(event.clientX)) || drag.item.column;
      preview = { column, ...moveTo(base, base.startMin + deltaMin) };
    }
    setDrag({ ...drag, moved: true, preview });
  };

  const dragEnd = () => {
    if (!drag) return;
    const { item, preview, moved } = drag;
    setDrag(null);
    const from: GridPosition = { column: item.column, startMin: item.startMin, endMin: item.endMin };
    if (!moved || samePosition(from, preview)) return;
    setPending((p) => new Map(p).set(item.id, { from, to: preview }));
    onChange(item, preview).catch((error) => {
      console.error(error);
      setPending((p) => {
        const next = new Map(p);
        next.delete(item.id);
        return next;
      });
    });
  };

  // Listen on window while dragging: moving to another column re-mounts the
  // item there, so its own element would miss the pointerup.
  const onDragMove = useEffectEvent(dragMove);
  const onDragEnd = useEffectEvent(dragEnd);
  const onDragCancel = useEffectEvent(() => setDrag(null));
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => onDragMove(e);
    const up = () => onDragEnd();
    const cancel = () => onDragCancel();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragging]);

  const readDrop = (event: React.DragEvent): WorkDrop | null => {
    const raw = event.dataTransfer.getData(WORK_MIME);
    return raw ? (JSON.parse(raw) as WorkDrop) : null;
  };

  const columnLayer = (column: string) => {
    const columnItems = items.filter((item) => positionOf(item).column === column);
    const work = columnItems.filter((i) => i.layer === "work");
    const laneOf = lanes(work, positionOf);
    return columnItems
      .sort((a, b) => (a.layer === b.layer ? 0 : a.layer === "block" ? -1 : 1))
      .map((item) => {
        const pos = positionOf(item);
        const lane = laneOf.get(item.id);
        const style: React.CSSProperties =
          item.layer === "block"
            ? { top: pos.startMin * PX_PER_MIN, height: (pos.endMin - pos.startMin) * PX_PER_MIN, left: 0, right: 0 }
            : {
                top: pos.startMin * PX_PER_MIN,
                height: (pos.endMin - pos.startMin) * PX_PER_MIN,
                left: `calc(14px + (100% - 16px) * ${(lane?.lane ?? 0) / (lane?.lanes ?? 1)})`,
                width: `calc((100% - 16px) / ${lane?.lanes ?? 1})`,
              };
        const dragging = drag?.item.id === item.id;
        return (
          <div
            key={item.id}
            className={`absolute select-none ${item.editable ? "cursor-grab touch-none" : ""} ${
              dragging ? "z-30 cursor-grabbing opacity-90 shadow-lg" : item.layer === "work" ? "z-20" : "z-10"
            }`}
            style={style}
            onPointerDown={(e) => startDrag(e, item, "move")}
          >
            {renderItem(item, pos)}
            {item.editable && (
              <div
                className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                onPointerDown={(e) => startDrag(e, item, "resize")}
              />
            )}
          </div>
        );
      });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex border-b border-line">
        <div className="w-12 shrink-0" />
        {columns.map((col) => (
          <div
            key={col.key}
            className={`flex-1 border-l border-line px-2 py-1.5 text-center text-sm ${
              col.highlight ? "font-semibold text-accent" : ""
            }`}
          >
            {col.label}
          </div>
        ))}
      </div>
      <div ref={scroller} className="overflow-y-auto" style={{ height }}>
        <div className="relative flex" style={{ height: DAY_END_MIN * PX_PER_MIN }}>
          <div className="relative w-12 shrink-0">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-muted"
                style={{ top: h * 60 * PX_PER_MIN }}
              >
                {h > 0 ? formatMinutes(h * 60) : ""}
              </div>
            ))}
          </div>
          {columns.map((col) => (
            <div
              key={col.key}
              ref={(el) => {
                if (el) columnRefs.current.set(col.key, el);
                else columnRefs.current.delete(col.key);
              }}
              className="relative flex-1 border-l border-line"
              onDragOver={(event) => {
                if (!onDropWork || !event.dataTransfer.types.includes(WORK_MIME)) return;
                event.preventDefault();
                const startMin = snap(minuteAt(col.key, event.clientY));
                if (dropHint?.column !== col.key || dropHint.startMin !== startMin) {
                  setDropHint({ column: col.key, startMin, durationMin: dropHint?.durationMin ?? 60 });
                }
              }}
              onDragLeave={() => setDropHint(null)}
              onDrop={(event) => {
                const work = readDrop(event);
                setDropHint(null);
                if (!work || !onDropWork) return;
                event.preventDefault();
                const startMin = moveTo(
                  { startMin: 0, endMin: work.durationMin },
                  minuteAt(col.key, event.clientY),
                ).startMin;
                onDropWork(col.key, startMin, work).catch(console.error);
              }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="pointer-events-none absolute inset-x-0 border-t border-line/70"
                  style={{ top: h * 60 * PX_PER_MIN }}
                />
              ))}
              {columnLayer(col.key)}
              {dropHint?.column === col.key && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-40 rounded border-2 border-dashed border-accent"
                  style={{ top: dropHint.startMin * PX_PER_MIN, height: 30 }}
                >
                  <span className="bg-surface px-1 text-[10px] text-accent">
                    {formatMinutes(dropHint.startMin)}
                  </span>
                </div>
              )}
              {now?.column === col.key && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-40 border-t-2 border-red-500"
                  style={{ top: now.minute * PX_PER_MIN }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
