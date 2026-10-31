import { PrinciplesList } from "@/components/principles-list";
import { PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { createPrinciple } from "@/server/actions";
import { getPrincipleViews } from "@/server/queries";

export const metadata = { title: "Principles" };

export default async function PrinciplesPage() {
  await requireIvan();
  const principles = await getPrincipleViews();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageTitle>Principles</PageTitle>
      <p className="-mt-2 text-sm text-muted">Reminders of why I do what I do. Not rules: they align the mind.</p>
      <PrinciplesList principles={principles} />
      <form action={createPrinciple} className="card flex flex-col gap-2">
        <input name="title" required placeholder="New Principle" className="input" />
        <textarea
          name="body"
          rows={2}
          placeholder="Expansion (optional, Markdown)"
          className="input font-mono field-sizing-content"
        />
        <button className="btn-primary self-start">Add</button>
      </form>
    </div>
  );
}
