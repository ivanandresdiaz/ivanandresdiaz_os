import Link from "next/link";
import { LongText } from "@/components/long-text";
import { GamesPicker, GameTags, Hidden, PageTitle } from "@/components/ui";
import { quarterLabel, quarterOf, quarterRange, type QuarterNumber, type QuarterRef } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import {
  addSeasonGoal,
  createCampaign,
  createTask,
  deleteSeasonGoal,
  deleteTask,
  saveQuarter,
  startSeason,
  toggleWorkDoneForm,
  updateSeason,
  updateSeasonGoal,
} from "@/server/actions";
import {
  getActiveSeason,
  getBlockTypes,
  getCampaigns,
  getLooseTasks,
  getQuarter,
} from "@/server/queries";

export const metadata = { title: "Plan" };

function shift(ref: QuarterRef, by: number): QuarterRef {
  const index = ref.year * 4 + (ref.quarter - 1) + by;
  return { year: Math.floor(index / 4), quarter: ((index % 4) + 1) as QuarterNumber };
}

function parseRef(value: string | string[] | undefined, fallback: QuarterRef): QuarterRef {
  const match = typeof value === "string" ? /^(\d{4})-Q([1-4])$/.exec(value) : null;
  return match ? { year: Number(match[1]), quarter: Number(match[2]) as QuarterNumber } : fallback;
}

const refParam = (ref: QuarterRef) => `${ref.year}-Q${ref.quarter}`;

export default async function PlanPage({ searchParams }: PageProps<"/os/plan">) {
  await requireIvan();
  const current = quarterOf(today());
  const ref = parseRef((await searchParams).q, current);
  const [season, quarter, blockTypes, candidates, looseTasks] = await Promise.all([
    getActiveSeason(),
    getQuarter(ref),
    getBlockTypes(),
    getCampaigns({ candidates: true }),
    getLooseTasks(),
  ]);
  const campaigns = quarter ? await getCampaigns({ quarterId: quarter.id }) : [];
  const containers = blockTypes.filter((t) => t.kind === "container" && !t.archived);
  const range = quarterRange(ref);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageTitle>Plan</PageTitle>

      {/* ── Season ── */}
      <section className="card flex flex-col gap-3">
        <div className="label">Season</div>
        {season ? (
          <>
            <form action={updateSeason} className="flex flex-col gap-2">
              <Hidden id={season.id} />
              <input name="title" defaultValue={season.title} required className="input text-lg font-semibold" />
              <LongText
                name="body"
                rows={4}
                defaultValue={season.body}
                placeholder="My reality right now: career, emotional state, questions about myself…"
              />
              <button className="btn self-start">Save Season</button>
            </form>
            <div>
              <div className="label mb-1">Season Goals</div>
              <ul className="flex flex-col gap-1">
                {season.goals.map((goal) => (
                  <li key={goal.id} className="flex items-center gap-2">
                    <form action={updateSeasonGoal} className="flex flex-1 gap-2">
                      <Hidden id={goal.id} />
                      <input name="title" defaultValue={goal.title} className="input" />
                      <button className="btn">Save</button>
                    </form>
                    <form action={deleteSeasonGoal}>
                      <Hidden id={goal.id} />
                      <button className="text-muted hover:text-red-600" title="Delete">
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={addSeasonGoal} className="mt-2 flex gap-2">
                <Hidden seasonId={season.id} />
                <input name="title" required placeholder="New Season Goal (e.g. make 30,000)" className="input" />
                <button className="btn">Add</button>
              </form>
            </div>
            <p className="text-xs text-muted">Started {season.startedOn}.</p>
          </>
        ) : (
          <p className="text-sm text-muted">No Season yet.</p>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-muted">Start a new Season (closes the current one)</summary>
          <form action={startSeason} className="mt-2 flex gap-2">
            <input name="title" required placeholder="e.g. Working in microfinance at El Alcaraván" className="input" />
            <button className="btn">Start</button>
          </form>
        </details>
      </section>

      {/* ── Quarter ── */}
      <section className="card flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link className="btn" href={`/os/plan?q=${refParam(shift(ref, -1))}`}>
            ←
          </Link>
          <div className="flex-1">
            <div className="label">Quarter</div>
            <div className="font-semibold">
              {quarterLabel(ref)}{" "}
              <span className="text-sm font-normal text-muted">
                {range.start} → {range.end}
              </span>
            </div>
          </div>
          {(ref.year !== current.year || ref.quarter !== current.quarter) && (
            <Link className="btn" href="/os/plan">
              Current
            </Link>
          )}
          <Link className="btn" href={`/os/plan?q=${refParam(shift(ref, 1))}`}>
            →
          </Link>
        </div>
        <form action={saveQuarter} className="flex flex-col gap-2">
          <Hidden year={String(ref.year)} quarter={String(ref.quarter)} />
          <input name="title" defaultValue={quarter?.title ?? ""} placeholder="Title of the Quarter" className="input" />
          <LongText
            name="body"
            rows={3}
            defaultValue={quarter?.body ?? ""}
            placeholder="What these 3 months are about…"
          />
          <button className="btn self-start">{quarter ? "Save Quarter" : "Create Quarter"}</button>
        </form>

        <div className="label mt-2">Campaigns</div>
        {campaigns.length === 0 && <p className="text-sm text-muted">No Campaigns in this Quarter yet.</p>}
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id} className="rounded-md border border-line p-2">
              <div className="flex items-center gap-2">
                <Link href={`/os/campaigns/${c.id}`} className="font-medium hover:underline">
                  {c.title}
                </Link>
                <span className="text-xs text-muted">{c.status}</span>
                <GameTags games={c.games} />
              </div>
              {c.goal && <p className="text-sm text-muted">{c.goal}</p>}
            </li>
          ))}
        </ul>
        {quarter && season ? (
          <details>
            <summary className="cursor-pointer text-sm text-muted">New Campaign in {quarterLabel(ref)}</summary>
            <CampaignForm
              quarterId={quarter.id}
              goals={season.goals}
              containers={containers}
            />
          </details>
        ) : (
          <p className="text-xs text-muted">Create the Quarter to add Campaigns.</p>
        )}
      </section>

      {/* ── Backlog ── */}
      <section className="card flex flex-col gap-3">
        <div className="label">Backlog</div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Candidate Campaigns</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link href={`/os/campaigns/${c.id}`} className="hover:underline">
                  {c.title}
                </Link>
                <GameTags games={c.games} />
              </li>
            ))}
          </ul>
          {season && (
            <details className="mt-1">
              <summary className="cursor-pointer text-sm text-muted">New candidate Campaign</summary>
              <CampaignForm quarterId="" goals={season.goals} containers={containers} />
            </details>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Loose Tasks</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {looseTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <form action={toggleWorkDoneForm}>
                  <Hidden kind="task" id={t.id} />
                  <button>{t.doneAt ? "☑" : "☐"}</button>
                </form>
                <span className={t.doneAt ? "line-through opacity-60" : ""}>{t.title}</span>
                <span className="text-xs text-muted">{t.durationMin} min</span>
                <GameTags games={t.games} />
                <form action={deleteTask} className="ml-auto">
                  <Hidden id={t.id} />
                  <button className="text-muted hover:text-red-600">×</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={createTask} className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input name="title" required placeholder="Loose Task (e.g. renew passport)" className="input" />
              <input name="durationMin" type="number" min={15} step={15} defaultValue={30} className="input w-24" />
              <button className="btn">Add</button>
            </div>
            <GamesPicker />
          </form>
        </div>
      </section>
    </div>
  );
}

function CampaignForm({
  quarterId,
  goals,
  containers,
}: {
  quarterId: string;
  goals: { id: string; title: string }[];
  containers: { id: string; name: string }[];
}) {
  return (
    <form action={createCampaign} className="mt-2 flex flex-col gap-2">
      <Hidden quarterId={quarterId} />
      <input name="title" required placeholder="Campaign title (e.g. Build Ivan OS)" className="input" />
      <LongText name="goal" rows={2} placeholder="Goal — what" />
      <LongText name="why" rows={2} placeholder="Why" />
      <LongText name="antiGoal" rows={2} placeholder="Anti-goal — what I avoid, constraints" />
      <div className="flex flex-wrap gap-2">
        <select name="seasonGoalId" className="input w-auto" defaultValue={goals[0]?.id ?? ""}>
          <option value="">No Season Goal</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              Serves: {g.title}
            </option>
          ))}
        </select>
        <select name="blockTypeId" className="input w-auto" defaultValue={containers[0]?.id ?? ""}>
          <option value="">No Container Block</option>
          {containers.map((t) => (
            <option key={t.id} value={t.id}>
              Played in: {t.name}
            </option>
          ))}
        </select>
      </div>
      <GamesPicker />
      <button className="btn-primary self-start">Create Campaign</button>
    </form>
  );
}
