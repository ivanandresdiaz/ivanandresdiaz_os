"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { setCampaignStatus } from "@/server/actions";
import { Hidden } from "./ui";

/**
 * A candidate's way into the current Quarter, asked twice: activating it changes the Quarter's plan.
 * Escape or a click outside cancels.
 */
export function ActivateCampaign({
  id,
  title,
  quarter,
  quarterLabel,
}: {
  id: string;
  title: string;
  /** "2026-Q4": the current Quarter. */
  quarter: string;
  quarterLabel: string;
}) {
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!asking) return;
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setAsking(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAsking(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [asking]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="btn-primary"
        aria-expanded={asking}
        title={`Play it in ${quarterLabel}`}
        onClick={() => setAsking(!asking)}
      >
        Activate
      </button>
      {asking && (
        <div
          role="alertdialog"
          aria-label={`Activate ${title}?`}
          className="absolute right-0 z-10 mt-1 flex w-72 flex-col gap-2 rounded-md border border-line bg-surface p-3 shadow-lg"
        >
          <p className="text-sm">
            Play <span className="font-medium">{title}</span> in {quarterLabel}?
          </p>
          <p className="text-xs text-muted">
            It goes last in the Quarter&apos;s priority, and its Moves get their week in the Weekly Review.
          </p>
          <form action={setCampaignStatus} className="flex justify-end gap-2">
            <Hidden id={id} status="active" quarter={quarter} />
            <button type="button" className="btn" onClick={() => setAsking(false)}>
              Cancel
            </button>
            <Confirm />
          </form>
        </div>
      )}
    </div>
  );
}

function Confirm() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary disabled:opacity-50" disabled={pending} autoFocus>
      {pending ? "Activating…" : "Activate"}
    </button>
  );
}
