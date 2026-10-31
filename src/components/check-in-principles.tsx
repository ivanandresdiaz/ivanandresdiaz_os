"use client";

import { useState } from "react";
import type { PrincipleView } from "@/server/queries";
import { PrincipleDrawer } from "./principle-drawer";

export function CheckInPrinciples({ principles }: { principles: PrincipleView[] }) {
  const [expanded, setExpanded] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="label cursor-pointer">Principles</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {principles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="text-left font-medium hover:text-accent"
              >
                {p.title}
              </button>
              {p.references.length > 0 && (
                <span className="text-xs text-muted" title={`${p.references.length} References`}>
                  {" "}
                  · {p.references.length}
                </span>
              )}
            </li>
          ))}
        </ol>
      </details>
      <PrincipleDrawer principle={principles.find((p) => p.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </>
  );
}
