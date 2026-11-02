"use client";

import { useTransition } from "react";
import { formatMinutes, type IsoDate, WEEKDAY_NAMES, weekdayOf } from "@/domain/dates";
import type { DayBlockRef } from "@/domain/structure";
import { addDayBlock, backToStructure, changeDayBlock } from "@/server/actions";
import type { BlockType } from "@/server/queries";
import { BlockDialog, BlockTypeChoices } from "./block-dialog";

/** A range drawn on one date, or a Block of that date being reassigned. */
export type DayBlockDraft =
  | { kind: "create"; date: IsoDate; startMin: number; endMin: number }
  | { kind: "edit"; block: DayBlockRef };

/** Adds or reassigns a Block on one date only (an Exception); the Structure stays. */
export function DayBlockDialog({
  draft,
  types,
  onClose,
}: {
  draft: DayBlockDraft;
  types: BlockType[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const range = draft.kind === "create" ? draft : draft.block;

  const run = (action: () => Promise<void>) =>
    startTransition(async () => {
      await action();
      onClose();
    });

  const choose = (blockTypeId: string) =>
    run(async () => {
      if (draft.kind === "create") {
        await addDayBlock({ date: draft.date, startMin: draft.startMin, endMin: draft.endMin, blockTypeId });
      } else if (blockTypeId !== draft.block.blockTypeId) {
        await changeDayBlock(draft.block, { blockTypeId });
      }
    });

  // Only a Block of the Structure has somewhere to go back to; an added one is removed with its ×.
  const exceptionId =
    draft.kind === "edit" && draft.block.structureBlockId !== null ? draft.block.exceptionId : null;

  return (
    <BlockDialog
      title={draft.kind === "create" ? "New Block" : "Change Block"}
      subtitle={`${WEEKDAY_NAMES[weekdayOf(range.date)]} ${range.date} · ${formatMinutes(range.startMin)}–${formatMinutes(
        range.endMin,
      )} · this day only`}
      onClose={onClose}
    >
      <BlockTypeChoices
        types={types}
        current={draft.kind === "edit" ? draft.block.blockTypeId : undefined}
        disabled={pending}
        onChoose={choose}
      />
      {exceptionId && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => backToStructure({ date: range.date, exceptionId }))}
          className="self-start text-sm text-muted hover:underline disabled:opacity-50"
        >
          Back to Structure
        </button>
      )}
    </BlockDialog>
  );
}
