import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { InsightsView } from "@/components/discovery/insights-view";
import { RewriteInsights } from "@/components/discovery/rewrite-insights";
import { PageTitle } from "@/components/ui";
import { type Insights, interviewStatusLabel, type Phase, type Stage, stagesFor } from "@/domain/discovery";
import { requireIvan } from "@/lib/session";
import { getInterviewView } from "@/server/discoveries";
import { conversationText } from "@/server/interview-engine";

export const metadata = { title: "Interview" };

// Rewriting the Insights waits for the AI.
export const maxDuration = 300;

/** One person's Interview of one Theme: the Insights, the whole conversation, and what they attached. */
export default async function InterviewPage({ params }: PageProps<"/os/profile/discoveries/[id]/interviews/[interviewId]">) {
  await requireIvan();
  const { id, interviewId } = await params;
  if (!z.uuid().safeParse(interviewId).success) notFound();
  const view = await getInterviewView(interviewId);
  if (!view || view.discovery.id !== id) notFound();
  const { interview, stakeholder, theme } = view;
  const insights = interview.insights as Insights | null;
  const status = interviewStatusLabel(
    { stage: interview.stage as Stage, round: interview.round, phase: interview.phase as Phase },
    stagesFor(stakeholder),
  );

  return (
    <>
      <Link href={`/os/profile/discoveries/${id}`} className="-mb-2 text-xs text-muted hover:underline">
        ← {view.discovery.title}
      </Link>
      <PageTitle>
        {stakeholder.name} · {theme.title}
      </PageTitle>
      <p className="-mt-2 text-sm text-muted">
        {stakeholder.roleNote && `${stakeholder.roleNote} · `}
        {status}
        {stakeholder.isTest && " · test"}
      </p>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-semibold">Insights</h2>
          <RewriteInsights interviewId={interview.id} />
        </div>
        {interview.insightsError && <p className="text-xs text-amber-700">Last rewrite failed: {interview.insightsError}</p>}
        {insights ? <InsightsView insights={insights} /> : <p className="text-sm text-muted">None yet: they come after the first round.</p>}
      </section>

      {view.files.length > 0 && (
        <section className="card flex flex-col gap-2">
          <h2 className="font-semibold">Files</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {view.files.map((f) => (
              <li key={f.id} className="flex flex-col">
                <a href={f.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                  {f.name}
                </a>
                {f.summary && <span className="text-xs text-muted">{f.summary}</span>}
                {!f.turnId && <span className="text-xs text-muted">Not sent yet</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card flex flex-col gap-2">
        <h2 className="font-semibold">Conversation</h2>
        {interview.understood.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg bg-accent/5 p-3 text-sm">
            <span className="label">What the AI understood</span>
            <ul className="list-disc pl-5">
              {interview.understood.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}
        {interview.error && <p className="text-xs text-amber-700">Last round failed: {interview.error}</p>}
        <pre className="overflow-x-auto font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {conversationText(view.turns, view.files) || "Nothing yet."}
        </pre>
      </section>
    </>
  );
}
