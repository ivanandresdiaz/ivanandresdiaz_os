"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatMinutes, parseMinutes, WEEKDAY_NAMES, WEEKDAYS, type Weekday } from "@/domain/dates";
import { DAY_END_MIN } from "@/domain/slots";
import { overlapsOn, type StructureBlock } from "@/domain/structure";
import { addStructureBlocks, editStructureBlock, removeStructureBlock } from "@/server/actions";
import type { BlockType } from "@/server/queries";

/** A time input can't say 24:00, so the end of the day shows (and reads back) as 00:00. */
const endValue = (min: number) => formatMinutes(min % DAY_END_MIN);
const readEnd = (value: string) => parseMinutes(value) || DAY_END_MIN;

/** A drawn range waiting for its Block type, or an existing Block changing it. */
export type BlockDraft =
  | { kind: "create"; startMin: number; endMin: number; weekdays: Weekday[] }
  | { kind: "edit"; block: StructureBlock };

export function StructureBlockDialog({
  draft,
  blocks,
  types,
  onWeekdaysChange,
  onClose,
}: {
  draft: BlockDraft;
  blocks: StructureBlock[];
  types: BlockType[];
  onWeekdaysChange: (weekdays: Weekday[]) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const range = draft.kind === "create" ? draft : draft.block;
  const [start, setStart] = useState(formatMinutes(range.startMin));
  const [end, setEnd] = useState(endValue(range.endMin));
  const times = `${formatMinutes(range.startMin)}–${formatMinutes(range.endMin)}`;
  const nameOf = (id: string) => types.find((t) => t.id === id)?.name ?? "a Block";
  const active = types.filter((t) => !t.archived);
  const noDays = draft.kind === "create" && draft.weekdays.length === 0;

  const edited = start && end ? { startMin: parseMinutes(start), endMin: readEnd(end) } : null;
  const badHours = !edited || edited.startMin >= edited.endMin;
  const hoursChanged =
    draft.kind === "edit" &&
    edited !== null &&
    (edited.startMin !== draft.block.startMin || edited.endMin !== draft.block.endMin);

  const choose = (blockTypeId: string) =>
    startTransition(async () => {
      if (draft.kind === "create") {
        await addStructureBlocks({ weekdays: draft.weekdays, startMin: range.startMin, endMin: range.endMin, blockTypeId });
      } else if (blockTypeId !== draft.block.blockTypeId || hoursChanged) {
        // Hours typed but not saved go along with the new type.
        const hours = hoursChanged && !badHours ? edited : {};
        await editStructureBlock({ id: draft.block.id, blockTypeId, ...hours });
      }
      onClose();
    });

  const saveHours = () =>
    startTransition(async () => {
      if (draft.kind !== "edit" || !edited || badHours) return;
      await editStructureBlock({ id: draft.block.id, ...edited });
      onClose();
    });

  const remove = () =>
    startTransition(async () => {
      if (draft.kind !== "edit") return;
      const fd = new FormData();
      fd.set("id", draft.block.id);
      await removeStructureBlock(fd);
      onClose();
    });

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current.close()}
      onKeyDown={(event) => event.key === "Escape" && dialog.current?.close()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="font-semibold">{draft.kind === "create" ? "New Block" : "Change Block"}</h2>
          <p className="text-sm text-muted">
            {draft.kind === "edit" && `${WEEKDAY_NAMES[draft.block.weekday]} `}
            {times} · from today on
          </p>
        </div>

        {draft.kind === "create" && (
          <div className="flex gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = draft.weekdays.includes(d);
              const hits = overlapsOn(blocks, d, range);
              const title = hits.length
                ? `${WEEKDAY_NAMES[d]}: overlaps ${hits
                    .map((b) => `${nameOf(b.blockTypeId)} ${formatMinutes(b.startMin)}–${formatMinutes(b.endMin)}`)
                    .join(", ")}`
                : WEEKDAY_NAMES[d];
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={title}
                  title={title}
                  onClick={() =>
                    onWeekdaysChange(on ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d].sort())
                  }
                  className={`relative h-8 w-8 rounded-full border text-sm ${
                    on ? "border-accent bg-accent text-white dark:text-stone-950" : "border-line hover:border-accent"
                  }`}
                >
                  {WEEKDAY_NAMES[d][0]}
                  {hits.length > 0 && <span className="absolute -right-1 -top-1.5 text-[11px] text-amber-500">⚠</span>}
                </button>
              );
            })}
          </div>
        )}

        {draft.kind === "edit" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Start
              <input
                type="time"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="input w-auto"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              End
              <input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className="input w-auto" />
            </label>
            <button type="button" className="btn" disabled={pending || badHours || !hoursChanged} onClick={saveHours}>
              Save hours
            </button>
            {badHours && <p className="w-full text-xs text-red-600">The end must come after the start.</p>}
          </div>
        )}

        {active.length === 0 ? (
          <p className="text-sm text-muted">No active Block types. Create one under Block types first.</p>
        ) : (
          (["habit", "container"] as const).map((kind) => {
            const list = active.filter((t) => t.kind === kind);
            if (list.length === 0) return null;
            return (
              <div key={kind} className="flex flex-col gap-1.5">
                <h3 className="text-xs text-muted">{kind === "habit" ? "Habit" : "Container"}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={pending || noDays}
                      onClick={() => choose(t.id)}
                      className={`btn ${draft.kind === "edit" && draft.block.blockTypeId === t.id ? "border-accent" : ""}`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
        {noDays && <p className="text-xs text-muted">Pick at least one day.</p>}

        {draft.kind === "edit" && (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="self-start text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Remove from the Structure
          </button>
        )}
      </div>
    </dialog>
  );
}
