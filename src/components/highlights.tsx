"use client";

import { useState } from "react";
import type { IsoDate } from "@/domain/dates";
import { MAX_HIGHLIGHTS } from "@/domain/highlights";
import { deleteHighlight, toggleHighlight } from "@/server/actions";
import { HighlightDialog, StarIcon } from "./highlight-star";
import { Markdown } from "./markdown";
import { Hidden } from "./ui";

export type HighlightView = {
  id: string;
  date: IsoDate;
  title: string;
  why: string;
  done: boolean;
  /** The Task or Move it is; null for an old one written by hand. */
  work: { kind: "task" | "move"; id: string } | null;
};

/**
 * The day's Highlights in the Check-in, in the order of their Slots. They are
 * chosen with the star of a Slot on the calendar; here they are checked off,
 * removed, or opened to read and edit their why.
 */
export function Highlights({ highlights }: { highlights: HighlightView[] }) {
  const [open, setOpen] = useState<HighlightView | null>(null);

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-semibold">
        Highlights <span className="text-sm font-normal text-muted">({highlights.length}/{MAX_HIGHLIGHTS})</span>
      </h2>

      {highlights.length === 0 && (
        <p className="flex items-center gap-1 text-sm text-muted">
          Star a Slot on the calendar <StarIcon className="inline" /> to make it a Highlight.
        </p>
      )}

      {highlights.map((h) => (
        <div key={h.id} className="flex items-start gap-2">
          <form action={toggleHighlight}>
            <Hidden id={h.id} />
            <button className="mt-0.5 text-lg leading-none" aria-label={h.done ? "Mark not done" : "Mark done"}>
              {h.done ? "☑" : "☐"}
            </button>
          </form>
          <div className="min-w-0 flex-1">
            <div className={`font-medium ${h.done ? "line-through opacity-60" : ""}`}>{h.title}</div>
            {h.why.trim() &&
              (h.work ? (
                <div
                  onClick={(event) => !(event.target as HTMLElement).closest("a") && setOpen(h)}
                  title="Open the why"
                  className="line-clamp-3 cursor-pointer rounded text-sm text-muted hover:bg-background"
                >
                  <Markdown>{h.why}</Markdown>
                </div>
              ) : (
                <div className="line-clamp-3 text-sm text-muted">
                  <Markdown>{h.why}</Markdown>
                </div>
              ))}
          </div>
          <form action={deleteHighlight}>
            <Hidden id={h.id} />
            <button
              className="text-muted hover:text-red-600"
              title="Remove the Highlight (its Slot stays)"
              aria-label={`Remove the Highlight ${h.title}`}
            >
              ×
            </button>
          </form>
        </div>
      ))}

      {open?.work && (
        <HighlightDialog
          date={open.date}
          startMin={null}
          work={open.work}
          highlight={{ id: open.id, why: open.why }}
          title={open.title}
          campaignTitle={null}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
