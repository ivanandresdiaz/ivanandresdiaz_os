import { startCycleForm } from "@/server/actions";
import type { StackItem } from "@/server/queries";

/** Start a Cycle on a Task/Move from the stack, or on anything with a free label. */
export function CycleStartForm({
  presets,
  work,
  compact = false,
}: {
  presets: { id: string; name: string; focusMin: number; breakMin: number }[];
  work: StackItem[];
  compact?: boolean;
}) {
  if (presets.length === 0) {
    return <p className="text-sm text-muted">Create a Cycle preset first.</p>;
  }
  return (
    <form action={startCycleForm} className="flex flex-col gap-2">
      <select name="work" className="input" defaultValue="">
        <option value="">Free Cycle (write a label)</option>
        {work.map((item) => (
          <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
            {item.title}
            {item.campaignTitle ? ` (${item.campaignTitle})` : ""}
          </option>
        ))}
      </select>
      <input name="label" placeholder="Label for a free Cycle (e.g. Email triage)" className="input" />
      <div className={`flex gap-2 ${compact ? "" : "flex-wrap"}`}>
        <select name="presetId" className="input w-auto" defaultValue={presets[0].id}>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.focusMin}+{p.breakMin}
            </option>
          ))}
        </select>
        <button className="btn-primary">▶ Start Cycle</button>
      </div>
    </form>
  );
}
