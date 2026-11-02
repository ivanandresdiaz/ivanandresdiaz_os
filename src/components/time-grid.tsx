"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { formatMinutes } from "@/domain/dates";
import {
  clickedRange,
  DAY_END_MIN,
  drawnRange,
  moveTo,
  resizeStartTo,
  resizeTo,
  snap,
} from "@/domain/slots";

export const PX_PER_MIN = 1;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const CLICK_TOLERANCE_PX = 3;

export type GridColumn = {
  key: string;
  label: ReactNode;
  highlight?: boolean;
  /** Nothing is drawn on it, e.g. a past day. */
  locked?: boolean;
};

export type GridItem = {
  id: string;
  column: string;
  startMin: number;
  endMin: number;
  /**
   * Blocks sit behind, full width; work sits on top, split in lanes when
   * overlapping; focus (real time from Cycles) is a thin bar on the left edge.
   */
  layer: "block" | "work" | "focus";
  /**
   * Who may move and resize it: any pointer, only a mouse or pen ("mouse"; a
   * finger scrolls past it, so a touch screen never moves it by accident), or nobody.
   */
  drag: "any" | "mouse" | "none";
  /** Whether it can be dragged to another column. */
  crossColumn: boolean;
};

const LAYER_ORDER: Record<GridItem["layer"], number> = { block: 0, focus: 1, work: 2 };

export type GridPosition = { column: string; startMin: number; endMin: number };

export type WorkDrop = { kind: "task" | "move" | "secondary"; id: string; durationMin: number };

export const WORK_MIME = "application/x-ivan-work";

type Drag<T extends GridItem> = {
  item: T;
  mode: "move" | "resize-start" | "resize-end";
  originX: number;
  originY: number;
  moved: boolean;
  preview: GridPosition;
};

/** A range being drawn on empty space with the mouse. */
type Drawing = {
  column: string;
  anchorMin: number;
  originY: number;
  moved: boolean;
  range: GridPosition;
};

type Props<T extends GridItem> = {
  columns: GridColumn[];
  items: T[];
  renderItem: (item: T, position: GridPosition) => ReactNode;
  onChange: (item: T, next: GridPosition) => Promise<void>;
  /** A press on an item that did not drag it. */
  onItemClick?: (item: T) => void;
  /** Drawing (or tapping) on empty space; omit to disable it. */
  onCreate?: (range: GridPosition) => void;
  /** Whether a finger's tap creates or clicks; off keeps a touch screen read-only. */
  touchTaps?: boolean;
  /** Dashed placeholders, e.g. the range waiting for its Block type. */
  ghosts?: GridPosition[];
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
  onItemClick,
  onCreate,
  touchTaps = true,
  ghosts = [],
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
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  // Touch keeps scrolling the calendar, so only a tap creates there.
  const tap = useRef<{ column: string; minute: number; x: number; y: number } | null>(null);
  // A finger on an item it may not drag: a tap still counts as a click.
  const itemTap = useRef<{ id: string; x: number; y: number } | null>(null);

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

  const canDrag = (item: T, pointerType: string) =>
    item.drag === "any" || (item.drag === "mouse" && pointerType !== "touch");

  const startDrag = (event: React.PointerEvent, item: T, mode: Drag<T>["mode"]) => {
    if (event.button !== 0) return;
    if (!canDrag(item, event.pointerType)) {
      if (mode === "move" && event.pointerType === "touch" && touchTaps) {
        itemTap.current = { id: item.id, x: event.clientX, y: event.clientY };
      }
      return;
    }
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

  const endItemTap = (event: React.PointerEvent, item: T) => {
    const start = itemTap.current;
    itemTap.current = null;
    if (start?.id !== item.id) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < CLICK_TOLERANCE_PX) onItemClick?.(item);
  };

  const dragMove = (event: PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    if (!drag.moved && Math.hypot(dx, dy) < CLICK_TOLERANCE_PX) return;
    const base = { startMin: drag.item.startMin, endMin: drag.item.endMin };
    const deltaMin = dy / PX_PER_MIN;
    let preview: GridPosition;
    if (drag.mode === "resize-end") {
      preview = { column: drag.item.column, ...resizeTo(base, base.endMin + deltaMin) };
    } else if (drag.mode === "resize-start") {
      preview = { column: drag.item.column, ...resizeStartTo(base, base.startMin + deltaMin) };
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
    if (!moved) onItemClick?.(item);
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

  const busyIn = (column: string) =>
    items.filter((item) => item.layer !== "focus").map(positionOf).filter((p) => p.column === column);

  const createAt = (column: string, minute: number) => {
    onCreate?.({ column, ...clickedRange(minute, busyIn(column)) });
  };

  const startDrawing = (event: React.PointerEvent, { key: column, locked }: GridColumn) => {
    if (!onCreate || locked || event.button !== 0 || event.target !== event.currentTarget) return;
    const minute = minuteAt(column, event.clientY);
    if (event.pointerType === "touch") {
      if (touchTaps) tap.current = { column, minute, x: event.clientX, y: event.clientY };
      return;
    }
    event.preventDefault();
    setDrawing({
      column,
      anchorMin: minute,
      originY: event.clientY,
      moved: false,
      range: { column, ...drawnRange(minute, minute) },
    });
  };

  const endTap = (event: React.PointerEvent) => {
    const start = tap.current;
    tap.current = null;
    if (!start || event.pointerType !== "touch") return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < CLICK_TOLERANCE_PX) {
      createAt(start.column, start.minute);
    }
  };

  const onDrawMove = useEffectEvent((event: PointerEvent) => {
    if (!drawing) return;
    if (!drawing.moved && Math.abs(event.clientY - drawing.originY) < CLICK_TOLERANCE_PX) return;
    const range = drawnRange(drawing.anchorMin, minuteAt(drawing.column, event.clientY));
    setDrawing({ ...drawing, moved: true, range: { column: drawing.column, ...range } });
  });
  const onDrawEnd = useEffectEvent(() => {
    if (!drawing) return;
    setDrawing(null);
    if (drawing.moved) onCreate?.(drawing.range);
    else createAt(drawing.column, drawing.anchorMin);
  });
  const onDrawCancel = useEffectEvent(() => setDrawing(null));
  const isDrawing = drawing !== null;
  useEffect(() => {
    if (!isDrawing) return;
    const move = (e: PointerEvent) => onDrawMove(e);
    const up = () => onDrawEnd();
    const cancel = () => onDrawCancel();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [isDrawing]);

  const shownGhosts = drawing ? [...ghosts, drawing.range] : ghosts;

  const readDrop = (event: React.DragEvent): WorkDrop | null => {
    const raw = event.dataTransfer.getData(WORK_MIME);
    return raw ? (JSON.parse(raw) as WorkDrop) : null;
  };

  const columnLayer = (column: string) => {
    const columnItems = items.filter((item) => positionOf(item).column === column);
    const work = columnItems.filter((i) => i.layer === "work");
    const laneOf = lanes(work, positionOf);
    return columnItems
      .sort((a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer])
      .map((item) => {
        const pos = positionOf(item);
        const lane = laneOf.get(item.id);
        const top = pos.startMin * PX_PER_MIN;
        const height = (pos.endMin - pos.startMin) * PX_PER_MIN;
        const style: React.CSSProperties =
          item.layer === "block"
            ? { top, height, left: 0, right: 0 }
            : item.layer === "focus"
              ? { top, height, left: 3, width: 8 }
              : {
                top,
                height,
                left: `calc(14px + (100% - 16px) * ${(lane?.lane ?? 0) / (lane?.lanes ?? 1)})`,
                width: `calc((100% - 16px) / ${lane?.lanes ?? 1})`,
              };
        const dragging = drag?.item.id === item.id;
        return (
          <div
            key={item.id}
            className={`absolute select-none ${
              item.drag === "any" ? "cursor-grab touch-none" : item.drag === "mouse" ? "cursor-grab" : ""
            } ${
              dragging ? "z-30 cursor-grabbing opacity-90 shadow-lg" : item.layer === "block" ? "z-10" : "z-20"
            }`}
            style={style}
            onPointerDown={(e) => startDrag(e, item, "move")}
            onPointerUp={(e) => endItemTap(e, item)}
            onPointerCancel={() => {
              itemTap.current = null;
            }}
          >
            {renderItem(item, pos)}
            {item.drag !== "none" && (
              <>
                <div
                  className="absolute inset-x-0 -top-0.5 h-1.5 cursor-ns-resize"
                  onPointerDown={(e) => startDrag(e, item, "resize-start")}
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                  onPointerDown={(e) => startDrag(e, item, "resize-end")}
                />
              </>
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
              className={`relative flex-1 border-l border-line ${onCreate && !col.locked ? "cursor-crosshair" : ""}`}
              onPointerDown={(event) => startDrawing(event, col)}
              onPointerUp={endTap}
              onPointerCancel={() => {
                tap.current = null;
              }}
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
              {shownGhosts
                .filter((ghost) => ghost.column === col.key)
                .map((ghost) => (
                  <div
                    key={`${ghost.startMin}-${ghost.endMin}`}
                    className="pointer-events-none absolute inset-x-1 z-40 rounded border-2 border-dashed border-accent bg-accent/10"
                    style={{
                      top: ghost.startMin * PX_PER_MIN,
                      height: (ghost.endMin - ghost.startMin) * PX_PER_MIN,
                    }}
                  >
                    <span className="bg-surface px-1 text-[10px] text-accent">
                      {typeof col.label === "string" ? `${col.label} ` : ""}
                      {formatMinutes(ghost.startMin)}–{formatMinutes(ghost.endMin)}
                    </span>
                  </div>
                ))}
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
