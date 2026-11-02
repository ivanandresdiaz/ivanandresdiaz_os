"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useOptimistic, useTransition } from "react";

/** A list in Ivan's priority: drag the ⠿ to reorder it; the number is the priority. */
export function PriorityList<T extends { id: string; title: string }>({
  items,
  selectedId,
  save,
  children,
}: {
  items: T[];
  selectedId?: string | null;
  save: (ids: string[]) => Promise<unknown>;
  children: (item: T) => React.ReactNode;
}) {
  const [shown, setShown] = useOptimistic(items);
  const [, startTransition] = useTransition();

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const next = move(shown, event);
        if (next.every((item, i) => item.id === shown[i].id)) return;
        startTransition(async () => {
          setShown(next);
          await save(next.map((item) => item.id));
        });
      }}
    >
      <ol className="flex flex-col gap-1.5">
        {shown.map((item, i) => (
          <Row key={item.id} item={item} index={i} selected={item.id === selectedId}>
            {children(item)}
          </Row>
        ))}
      </ol>
    </DragDropProvider>
  );
}

function Row<T extends { id: string; title: string }>({
  item,
  index,
  selected,
  children,
}: {
  item: T;
  index: number;
  selected: boolean;
  children: React.ReactNode;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: item.id, index });
  return (
    <li
      ref={ref}
      className={`flex items-start gap-1.5 rounded-md border p-1.5 ${
        selected ? "border-accent bg-background" : "border-line bg-background/60"
      } ${isDragging ? "shadow-lg ring-1 ring-accent" : ""}`}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Reorder ${item.title}`}
        title="Drag to reorder"
        // The handle owns the touch: on a phone, holding it drags instead of scrolling the page.
        className="-my-1 flex min-h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="mt-0.5 w-4 shrink-0 text-center text-sm font-semibold">{index + 1}</span>
      {children}
    </li>
  );
}

/** Done, dropped or closed items: below the priority, quieter, with no handle. */
export function ClosedList<T extends { id: string }>({
  items,
  selectedId,
  children,
}: {
  items: T[];
  selectedId?: string | null;
  children: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-start gap-1.5 rounded-md border p-1.5 pl-3 ${
            item.id === selectedId ? "border-accent" : "border-line opacity-60"
          }`}
        >
          {children(item)}
        </li>
      ))}
    </ul>
  );
}
