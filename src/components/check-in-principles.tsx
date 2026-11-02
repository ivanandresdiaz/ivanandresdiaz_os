"use client";

import { useEffect, useRef, useState } from "react";
import type { PrincipleView } from "@/server/queries";
import { PrincipleDrawer } from "./principle-drawer";

/** Where this browser remembers whether Ivan left the Principles open. */
const OPEN_KEY = "check-in:principles-open";

/**
 * The Principles at hand in the Check-in, to read when Ivan wants: not a step of the ritual.
 * They start closed, and the browser remembers whether he last left them open.
 */
export function CheckInPrinciples({ principles }: { principles: PrincipleView[] }) {
  const list = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Closed on the server; reopened after mount if he left them open. Opening fires onToggle.
  useEffect(() => {
    if (list.current && remembered() === "1") list.current.open = true;
  }, []);

  return (
    <>
      <details
        ref={list}
        onToggle={(event) => {
          const now = event.currentTarget.open;
          setOpen(now);
          remember(now ? "1" : "0");
        }}
      >
        <summary className="label cursor-pointer" title={open ? "Collapse Principles" : "Expand Principles"}>
          Principles
        </summary>
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

// Storage can be blocked (private window, cleared site data): then they just start closed.
function remembered(): string | null {
  try {
    return localStorage.getItem(OPEN_KEY);
  } catch {
    return null;
  }
}

function remember(value: "1" | "0") {
  try {
    localStorage.setItem(OPEN_KEY, value);
  } catch {}
}
