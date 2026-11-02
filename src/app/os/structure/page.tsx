import { StructureEditor } from "@/components/structure-editor";
import { GamesPicker, GameTags, Hidden, PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import {
  createBlockType,
  setBlockTypeArchived,
  updateBlockType,
} from "@/server/actions";
import { getBlockTypes, getStructureOn } from "@/server/queries";

export const metadata = { title: "Structure" };

export default async function StructurePage() {
  await requireIvan();
  const [blocks, types] = await Promise.all([getStructureOn(today()), getBlockTypes()]);

  return (
    <>
      <PageTitle>Structure</PageTitle>
      <p className="-mt-2 text-sm text-muted">
        Your weekly template of Blocks — a nudge, not a rule. Changes apply from today on; past days keep their
        history. To change a single day, use the Week.
      </p>
      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(280px,340px)]">
        <StructureEditor blocks={blocks} types={types} />
        <aside className="flex flex-col gap-4">
          <section className="card flex flex-col gap-3">
            <h2 className="font-semibold">Block types</h2>
            <p className="text-xs text-muted">
              Habit Blocks are the input itself (done or not). Container Blocks receive Campaign work.
            </p>
            {types.map((t) => (
              <details key={t.id} className={t.archived ? "opacity-50" : ""}>
                <summary className="flex cursor-pointer items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted">{t.kind}</span>
                  <GameTags games={t.games} />
                </summary>
                <form action={updateBlockType} className="mt-2 flex flex-col gap-2">
                  <Hidden id={t.id} />
                  <div className="flex gap-2">
                    <input name="name" defaultValue={t.name} required className="input" />
                    <input name="color" type="color" defaultValue={t.color} className="h-8 w-10" />
                  </div>
                  <GamesPicker selected={t.games} />
                  <button className="btn self-start">Save</button>
                </form>
                <form action={setBlockTypeArchived} className="mt-1">
                  <Hidden id={t.id} archived={String(!t.archived)} />
                  <button className="text-xs text-muted hover:underline">{t.archived ? "Unarchive" : "Archive"}</button>
                </form>
              </details>
            ))}
            <details>
              <summary className="cursor-pointer text-sm text-muted">New Block type</summary>
              <form action={createBlockType} className="mt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input name="name" required placeholder="e.g. Journal" className="input" />
                  <input name="color" type="color" defaultValue="#6b7280" className="h-8 w-10" />
                </div>
                <select name="kind" className="input" defaultValue="habit">
                  <option value="habit">Habit Block</option>
                  <option value="container">Container Block</option>
                </select>
                <GamesPicker />
                <button className="btn self-start">Create</button>
              </form>
            </details>
          </section>
        </aside>
      </div>
    </>
  );
}
