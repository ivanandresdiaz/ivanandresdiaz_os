"use client";

import { useState } from "react";
import { deletePrinciple, movePrinciple } from "@/server/actions";
import type { PrincipleView } from "@/server/queries";
import { PrincipleDrawer } from "./principle-drawer";
import { Hidden } from "./ui";

export function PrinciplesList({ principles }: { principles: PrincipleView[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <ol className="flex flex-col gap-3">
        {principles.map((p, i) => (
          <li key={p.id} className="card flex items-center gap-3 py-3">
            <span className="w-5 text-center font-semibold">{i + 1}</span>
            <button type="button" onClick={() => setOpenId(p.id)} className="min-w-0 flex-1 text-left">
              <div className="font-medium hover:text-accent">{p.title}</div>
              <div className="text-xs text-muted">
                {p.body.trim() ? "Expansion written" : "No Expansion yet"}
                {p.references.length > 0 &&
                  ` · ${p.references.length} Reference${p.references.length === 1 ? "" : "s"}`}
              </div>
            </button>
            <div className="flex items-center gap-2 text-muted">
              <form action={movePrinciple}>
                <Hidden id={p.id} direction="up" />
                <button disabled={i === 0} className="disabled:opacity-30" title="Move up">
                  ↑
                </button>
              </form>
              <form action={movePrinciple}>
                <Hidden id={p.id} direction="down" />
                <button disabled={i === principles.length - 1} className="disabled:opacity-30" title="Move down">
                  ↓
                </button>
              </form>
              <form action={deletePrinciple}>
                <Hidden id={p.id} />
                <button className="hover:text-red-600" title="Delete">
                  ×
                </button>
              </form>
            </div>
          </li>
        ))}
      </ol>
      <PrincipleDrawer
        principle={principles.find((p) => p.id === openId) ?? null}
        initialMode="edit"
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
