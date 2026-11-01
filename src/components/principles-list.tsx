"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useOptimistic, useState, useTransition } from "react";
import { deletePrinciple, reorderPrinciples } from "@/server/actions";
import type { PrincipleView } from "@/server/queries";
import { PrincipleDrawer } from "./principle-drawer";
import { Hidden } from "./ui";

export function PrinciplesList({ principles }: { principles: PrincipleView[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useOptimistic(principles);
  const [, startTransition] = useTransition();

  return (
    <>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          const next = move(shown, event);
          if (next.every((p, i) => p.id === shown[i].id)) return;
          startTransition(async () => {
            setShown(next);
            await reorderPrinciples({ ids: next.map((p) => p.id) });
          });
        }}
      >
        <ol className="flex flex-col gap-3">
          {shown.map((p, i) => (
            <PrincipleRow key={p.id} principle={p} index={i} onOpen={() => setOpenId(p.id)} />
          ))}
        </ol>
      </DragDropProvider>
      <PrincipleDrawer
        principle={principles.find((p) => p.id === openId) ?? null}
        initialMode="edit"
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function PrincipleRow({ principle: p, index, onOpen }: { principle: PrincipleView; index: number; onOpen: () => void }) {
  const { ref, handleRef, isDragging } = useSortable({ id: p.id, index });

  return (
    <li ref={ref} className={`card flex items-center gap-3 py-3 ${isDragging ? "shadow-lg ring-1 ring-accent" : ""}`}>
      <button
        ref={handleRef}
        type="button"
        aria-label={`Reorder ${p.title}`}
        title="Drag to reorder"
        // The handle owns the touch: on a phone, holding it drags instead of scrolling the page.
        className="-my-2 -ml-2 flex min-h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-lg text-muted active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="w-5 text-center font-semibold">{index + 1}</span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="font-medium hover:text-accent">{p.title}</div>
        <div className="text-xs text-muted">
          {p.body.trim() ? "Expansion written" : "No Expansion yet"}
          {p.references.length > 0 && ` · ${p.references.length} Reference${p.references.length === 1 ? "" : "s"}`}
        </div>
      </button>
      <form action={deletePrinciple}>
        <Hidden id={p.id} />
        <button className="text-muted hover:text-red-600" title="Delete">
          ×
        </button>
      </form>
    </li>
  );
}
