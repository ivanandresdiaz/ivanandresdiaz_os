"use client";

import { useState } from "react";
import { AddIconButton } from "./ui";

/**
 * A list with a + in its heading: the form to add to it stays hidden until Ivan asks for it.
 * Escape closes it, and so does leaving it empty. With `fold`, it is a section that folds,
 * open at first, like the Strategy's.
 */
export function AddSection({
  heading,
  addLabel,
  form,
  closeOnSubmit = false,
  fold = false,
  className = "flex flex-col gap-2",
  children,
}: {
  heading: React.ReactNode;
  addLabel: string;
  /** Without a form, there is nothing to add: no +. */
  form?: React.ReactNode;
  /** Close once sent, instead of staying open for the next one. */
  closeOnSubmit?: boolean;
  fold?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);

  const plus = form && !adding && (
    <AddIconButton
      label={addLabel}
      onClick={() => {
        setOpen(true);
        setAdding(true);
      }}
    />
  );
  const body = (
    <>
      {children}
      {adding && (
        <div
          onKeyDown={(event) => event.key === "Escape" && setAdding(false)}
          onBlur={(event) => {
            const box = event.currentTarget;
            if (box.contains(event.relatedTarget as Node | null)) return;
            const title = box.querySelector<HTMLInputElement>('input[name="title"]');
            if (!title?.value.trim()) setAdding(false);
          }}
          onSubmit={() => closeOnSubmit && setAdding(false)}
        >
          {form}
        </div>
      )}
    </>
  );

  if (fold) {
    return (
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className={className}>
        {/* Not flex: the summary keeps its fold triangle. The + opens the form, not the fold. */}
        <summary className="label cursor-pointer py-1">
          {heading}
          <span className="float-right" onClick={(event) => event.preventDefault()}>
            {plus}
          </span>
        </summary>
        <div className="flex flex-col gap-2">{body}</div>
      </details>
    );
  }
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        {heading}
        {plus}
      </div>
      {body}
    </div>
  );
}
