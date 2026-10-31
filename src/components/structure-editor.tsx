"use client";

import { formatMinutes, WEEKDAY_NAMES, WEEKDAYS } from "@/domain/dates";
import type { StructureBlock } from "@/domain/structure";
import { editStructureBlock, removeStructureBlock } from "@/server/actions";
import type { BlockType } from "@/server/queries";
import { TimeGrid, type GridItem } from "./time-grid";

type Item = GridItem & { block: StructureBlock; type: BlockType };

/** The weekly template. Dragging or resizing a Block changes it from today on. */
export function StructureEditor({ blocks, types }: { blocks: StructureBlock[]; types: BlockType[] }) {
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

  return (
    <TimeGrid<Item>
      columns={WEEKDAYS.map((d) => ({ key: String(d), label: WEEKDAY_NAMES[d].slice(0, 3) }))}
      items={items}
      onChange={async (item, next) => {
        await editStructureBlock({
          id: item.block.id,
          weekday: Number(next.column),
          startMin: next.startMin,
          endMin: next.endMin,
        });
      }}
      renderItem={(item, pos) => (
        <div
          className="group h-full overflow-hidden rounded-sm border-l-4 px-1 text-[11px] leading-tight"
          style={{ borderColor: item.type.color, background: `${item.type.color}33` }}
        >
          <div className="flex items-start gap-1">
            <span className="flex-1 truncate font-medium">{item.type.name}</span>
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
      )}
    />
  );
}
