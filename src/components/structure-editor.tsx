"use client";

import { useState } from "react";
import { formatMinutes, WEEKDAY_NAMES, WEEKDAYS, type Weekday } from "@/domain/dates";
import { structureOverlaps, type StructureBlock } from "@/domain/structure";
import { editStructureBlock, removeStructureBlock } from "@/server/actions";
import type { BlockType } from "@/server/queries";
import { StructureBlockDialog, type BlockDraft } from "./structure-block-dialog";
import { TimeGrid, type GridItem } from "./time-grid";

type Item = GridItem & { block: StructureBlock; type: BlockType };

const short = (weekday: Weekday) => WEEKDAY_NAMES[weekday].slice(0, 3);

/**
 * The weekly template. Drawing on empty space adds Blocks; dragging or
 * resizing a Block changes it from today on. Overlap is allowed, with a Warning.
 */
export function StructureEditor({ blocks, types }: { blocks: StructureBlock[]; types: BlockType[] }) {
  const [draft, setDraft] = useState<BlockDraft | null>(null);

  const items: Item[] = blocks.flatMap((block) => {
    const type = types.find((t) => t.id === block.blockTypeId);
    return type
      ? [
          {
            id: block.id,
            column: String(block.weekday),
            startMin: block.startMin,
            endMin: block.endMin,
            layer: "work" as const,
            editable: true,
            crossColumn: true,
            block,
            type,
          },
        ]
      : [];
  });

  const nameOf = (id: string) => types.find((t) => t.id === id)?.name ?? "a Block";
  const overlaps = structureOverlaps(blocks);
  const overlapping = new Map<string, StructureBlock[]>();
  for (const [a, b] of overlaps) {
    overlapping.set(a.id, [...(overlapping.get(a.id) ?? []), b]);
    overlapping.set(b.id, [...(overlapping.get(b.id) ?? []), a]);
  }

  const ghosts =
    draft?.kind === "create"
      ? draft.weekdays.map((d) => ({ column: String(d), startMin: draft.startMin, endMin: draft.endMin }))
      : [];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">Drag on the calendar to add a Block. Click a Block to change its type.</p>
      {overlaps.length > 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⚠ {overlaps.length} {overlaps.length === 1 ? "overlap" : "overlaps"}:{" "}
          {overlaps
            .map(
              ([a, b]) =>
                `${short(a.weekday)} ${formatMinutes(b.startMin)} ${nameOf(a.blockTypeId)} / ${nameOf(b.blockTypeId)}`,
            )
            .join(" · ")}
        </p>
      )}
      <TimeGrid<Item>
        columns={WEEKDAYS.map((d) => ({ key: String(d), label: short(d) }))}
        items={items}
        height="calc(100vh - 11rem)"
        ghosts={ghosts}
        onCreate={(range) =>
          setDraft({
            kind: "create",
            startMin: range.startMin,
            endMin: range.endMin,
            weekdays: [Number(range.column) as Weekday],
          })
        }
        onItemClick={(item) => setDraft({ kind: "edit", block: item.block })}
        onChange={async (item, next) => {
          await editStructureBlock({
            id: item.block.id,
            weekday: Number(next.column),
            startMin: next.startMin,
            endMin: next.endMin,
          });
        }}
        renderItem={(item, pos) => {
          const others = overlapping.get(item.id);
          return (
            <div
              className={`group h-full overflow-hidden rounded-sm border-l-4 px-1 text-[11px] leading-tight ${
                others ? "outline-2 outline-amber-500" : ""
              }`}
              style={{ borderColor: item.type.color, background: `${item.type.color}33` }}
              title={
                others
                  ? `⚠ Overlaps ${others
                      .map((o) => `${nameOf(o.blockTypeId)} ${formatMinutes(o.startMin)}–${formatMinutes(o.endMin)}`)
                      .join(", ")}`
                  : undefined
              }
            >
              <div className="flex items-start gap-1">
                <span className="flex-1 truncate font-medium">
                  {others && <span className="text-amber-600 dark:text-amber-400">⚠ </span>}
                  {item.type.name}
                </span>
                <button
                  type="button"
                  className="hidden text-muted hover:text-red-600 group-hover:block"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", item.block.id);
                    void removeStructureBlock(fd);
                  }}
                  title="Remove from the Structure (from today on)"
                >
                  ×
                </button>
              </div>
              {pos.endMin - pos.startMin >= 30 && (
                <div className="text-muted">
                  {formatMinutes(pos.startMin)}–{formatMinutes(pos.endMin)}
                </div>
              )}
            </div>
          );
        }}
      />
      {draft && (
        <StructureBlockDialog
          draft={draft}
          blocks={blocks}
          types={types}
          onWeekdaysChange={(weekdays) => draft.kind === "create" && setDraft({ ...draft, weekdays })}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
