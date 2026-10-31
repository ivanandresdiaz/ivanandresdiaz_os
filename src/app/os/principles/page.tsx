import { Hidden, PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { createPrinciple, deletePrinciple, movePrinciple, updatePrinciple } from "@/server/actions";
import { getPrinciples } from "@/server/queries";

export const metadata = { title: "Principles" };

export default async function PrinciplesPage() {
  await requireIvan();
  const principles = await getPrinciples();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageTitle>Principles</PageTitle>
      <p className="-mt-2 text-sm text-muted">Reminders of why I do what I do. Not rules: they align the mind.</p>
      <ol className="flex flex-col gap-3">
        {principles.map((p, i) => (
          <li key={p.id} className="card flex gap-3">
            <div className="flex flex-col items-center gap-1 text-muted">
              <span className="font-semibold text-foreground">{i + 1}</span>
              <form action={movePrinciple}>
                <Hidden id={p.id} direction="up" />
                <button disabled={i === 0} className="disabled:opacity-30" title="Move up">
                  ↑
                </button>
              </form>
              <form action={movePrinciple}>
                <Hidden id={p.id} direction="down" />
                <button disabled={i === principles.length - 1} className="disabled:opacity-30" title="Move down">
                  ↓
                </button>
              </form>
            </div>
            <form action={updatePrinciple} className="flex flex-1 flex-col gap-2">
              <Hidden id={p.id} />
              <input name="title" defaultValue={p.title} required className="input font-medium" />
              <textarea name="body" rows={3} defaultValue={p.body} placeholder="Expand it (optional)" className="input" />
              <div className="flex gap-2">
                <button className="btn">Save</button>
              </div>
            </form>
            <form action={deletePrinciple}>
              <Hidden id={p.id} />
              <button className="text-muted hover:text-red-600" title="Delete">
                ×
              </button>
            </form>
          </li>
        ))}
      </ol>
      <form action={createPrinciple} className="card flex flex-col gap-2">
        <input name="title" required placeholder="New Principle" className="input" />
        <textarea name="body" rows={2} placeholder="Expand it (optional)" className="input" />
        <button className="btn-primary self-start">Add</button>
      </form>
    </div>
  );
}
