import { addDays, type IsoDate, type Minutes, type Weekday, weekdayOf } from "./dates";

export type BlockKind = "habit" | "container";

/**
 * A Block of the weekly Structure. Editing the Structure applies from today
 * onward, so each row is valid within [validFrom, validTo] (validTo null = open).
 */
export type StructureBlock = {
  id: string;
  weekday: Weekday;
  startMin: Minutes;
  endMin: Minutes;
  blockTypeId: string;
  validFrom: IsoDate;
  validTo: IsoDate | null;
};

/**
 * A change to the Structure on a single date. With `structureBlockId` it
 * overrides (or removes) that Block; without it, it adds a Block for the day.
 */
export type StructureException = {
  id: string;
  date: IsoDate;
  structureBlockId: string | null;
  removed: boolean;
  startMin: Minutes;
  endMin: Minutes;
  blockTypeId: string;
};

/** A Block as it stands on a concrete date, after Exceptions. */
export type DayBlock = {
  key: string;
  date: IsoDate;
  startMin: Minutes;
  endMin: Minutes;
  blockTypeId: string;
  structureBlockId: string | null;
  exceptionId: string | null;
};

export function isBlockActiveOn(block: StructureBlock, date: IsoDate): boolean {
  return (
    block.weekday === weekdayOf(date) &&
    block.validFrom <= date &&
    (block.validTo === null || date <= block.validTo)
  );
}

export function resolveDayBlocks(
  blocks: readonly StructureBlock[],
  exceptions: readonly StructureException[],
  date: IsoDate,
): DayBlock[] {
  const todays = exceptions.filter((e) => e.date === date);
  const result: DayBlock[] = [];

  for (const block of blocks) {
    if (!isBlockActiveOn(block, date)) continue;
    const override = todays.find((e) => e.structureBlockId === block.id);
    if (override?.removed) continue;
    result.push(
      override
        ? {
            key: `x:${override.id}`,
            date,
            startMin: override.startMin,
            endMin: override.endMin,
            blockTypeId: override.blockTypeId,
            structureBlockId: block.id,
            exceptionId: override.id,
          }
        : {
            key: `s:${block.id}`,
            date,
            startMin: block.startMin,
            endMin: block.endMin,
            blockTypeId: block.blockTypeId,
            structureBlockId: block.id,
            exceptionId: null,
          },
    );
  }

  for (const added of todays) {
    if (added.structureBlockId !== null || added.removed) continue;
    result.push({
      key: `x:${added.id}`,
      date,
      startMin: added.startMin,
      endMin: added.endMin,
      blockTypeId: added.blockTypeId,
      structureBlockId: null,
      exceptionId: added.id,
    });
  }

  return result.sort((a, b) => a.startMin - b.startMin);
}

export type BlockChange = Partial<
  Pick<StructureBlock, "weekday" | "startMin" | "endMin" | "blockTypeId">
>;

/**
 * How to persist an edit to the Structure so it applies from `today` onward
 * and leaves past days untouched.
 */
export type StructureEditPlan =
  | { kind: "update"; id: string; values: BlockChange }
  | {
      kind: "split";
      close: { id: string; validTo: IsoDate };
      insert: Omit<StructureBlock, "id">;
    };

export function planStructureEdit(
  block: StructureBlock,
  change: BlockChange,
  today: IsoDate,
): StructureEditPlan {
  if (block.validFrom >= today) {
    return { kind: "update", id: block.id, values: change };
  }
  return {
    kind: "split",
    close: { id: block.id, validTo: addDays(today, -1) },
    insert: {
      weekday: change.weekday ?? block.weekday,
      startMin: change.startMin ?? block.startMin,
      endMin: change.endMin ?? block.endMin,
      blockTypeId: change.blockTypeId ?? block.blockTypeId,
      validFrom: today,
      validTo: block.validTo,
    },
  };
}

/**
 * Removing a Block from the Structure: rows that only exist from today on are
 * deleted; older rows are closed yesterday so past days keep their history.
 */
export function planStructureRemoval(
  block: StructureBlock,
  today: IsoDate,
): { kind: "delete"; id: string } | { kind: "close"; id: string; validTo: IsoDate } {
  return block.validFrom >= today
    ? { kind: "delete", id: block.id }
    : { kind: "close", id: block.id, validTo: addDays(today, -1) };
}
