"use client";

import { useState } from "react";

/** The Opening: open until the person starts an Interview, then one tap away (Q39). */
export function OpeningPanel({
  startOpen,
  showLabel,
  hideLabel,
  children,
}: {
  startOpen: boolean;
  showLabel: string;
  hideLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="flex flex-col gap-3">
      {open && <div className="card-in flex flex-col gap-4">{children}</div>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-11 self-start text-sm text-accent underline underline-offset-4"
      >
        {open ? hideLabel : showLabel}
      </button>
    </section>
  );
}
