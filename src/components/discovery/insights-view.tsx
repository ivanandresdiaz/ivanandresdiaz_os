import {
  type Evidence,
  evidenceLabel,
  type Insights,
  type Need,
  type Proposal,
  proposalOriginLabel,
  STRENGTH_LABEL,
  type Strength,
} from "@/domain/discovery";

/** One Interview's Insights for Ivan: every Need and Proposal with its words and its Strength (Q30, Q49). */

const TONE: Record<Strength, string> = {
  strong: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  medium: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  weak: "bg-line text-muted",
};

export function StrengthChip({ strength, why }: { strength: Strength; why?: string }) {
  return (
    <span title={why} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[strength]}`}>
      {STRENGTH_LABEL[strength]}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="text-muted">{label}: </span>
      {value}
    </p>
  );
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 border-l-2 border-line pl-3">
      {evidence.map((e, i) => (
        <li key={i} className="text-sm">
          <span className="text-[11px] text-muted">{evidenceLabel(e)}</span>{" "}
          {e.source === "own_words" ? <q className="italic">{e.quote}</q> : <span>{e.quote}</span>}
          {e.verified === false && (
            <span className="ml-1 rounded bg-amber-100 px-1 text-[11px] text-amber-900" title="The quote isn't in the conversation">
              not found
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function NeedCard({ need, who }: { need: Need; who?: string }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted uppercase">Need {need.id}</span>
        {who && <span className="text-[11px] text-muted">· {who}</span>}
        <StrengthChip strength={need.strength} why={need.strength_why} />
        {need.inferred && <span className="text-[11px] text-muted">AI&apos;s reading</span>}
        {need.perspective === "about_others" && <span className="text-[11px] text-amber-700">about others&apos; work</span>}
      </div>
      <p className="font-medium">{need.statement}</p>
      <Field label="Job story" value={need.job_story} />
      <Field label="Situation" value={need.situation} />
      <Field label="Today" value={need.today} />
      <Field label="Cost" value={need.cost} />
      <Field label="Frequency" value={need.frequency} />
      <EvidenceList evidence={need.evidence} />
      <p className="text-xs text-muted">{need.strength_why}</p>
      <Field label="Against the Brief" value={need.against_brief} />
      <Field label="Not established" value={need.not_established} />
      <Field label="Flags" value={need.flags} />
    </article>
  );
}

function ProposalCard({ proposal, who }: { proposal: Proposal; who?: string }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted uppercase">Proposal {proposal.id}</span>
        {who && <span className="text-[11px] text-muted">· {who}</span>}
        <StrengthChip strength={proposal.strength} why={proposal.strength_why} />
        <span className="text-[11px] text-muted">{proposalOriginLabel(proposal.origin)}</span>
      </div>
      <p className="font-medium">{proposal.statement}</p>
      <Field label="Responds to" value={proposal.responds_to} />
      <Field label="Would let them" value={proposal.would_let_them} />
      <Field label="Accepts / rejects" value={proposal.accepts_rejects} />
      <Field label="Must not change" value={proposal.must_not_change} />
      <Field label="Worries" value={proposal.worries} />
      <Field label="Last time it would have helped" value={proposal.last_time_helped} />
      <EvidenceList evidence={proposal.evidence} />
      <p className="text-xs text-muted">{proposal.strength_why}</p>
    </article>
  );
}

export function InsightsView({ insights, who }: { insights: Insights; who?: string }) {
  if (insights.needs.length === 0 && insights.proposals.length === 0) {
    return <p className="text-sm text-muted">No Needs or Proposals yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {insights.needs.map((n) => (
        <NeedCard key={n.id} need={n} who={who} />
      ))}
      {insights.proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} who={who} />
      ))}
    </div>
  );
}
