import Link from "next/link";
import { notFound } from "next/navigation";
import { GamesPicker, Hidden } from "@/components/ui";
import { addDays, startOfWeek } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import {
  createMove,
  createStep,
  createTask,
  deleteCampaign,
  deleteMove,
  deleteStep,
  deleteTask,
  setCampaignStatus,
  setMoveWeek,
  toggleStep,
  toggleWorkDoneForm,
  updateCampaign,
  updateMove,
  updateTask,
} from "@/server/actions";
import { getActiveSeason, getBlockTypes, getCampaignDetail, getQuarter } from "@/server/queries";
import { quarterOf } from "@/domain/dates";

export default async function CampaignPage({ params }: PageProps<"/os/campaigns/[id]">) {
  await requireIvan();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const detail = await getCampaignDetail(id);
  if (!detail) notFound();
  const { campaign, moves } = detail;

  const now = today();
  const thisWeek = startOfWeek(now);
  const nextWeek = addDays(thisWeek, 7);
  const [season, blockTypes, currentQuarter] = await Promise.all([
    getActiveSeason(),
    getBlockTypes(),
    getQuarter(quarterOf(now)),
  ]);
  const containers = blockTypes.filter((t) => t.kind === "container");
  const weekLabel = (weekOf: string | null) =>
    weekOf === thisWeek ? "This week" : weekOf === nextWeek ? "Next week" : weekOf ? `Week of ${weekOf}` : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link href="/os/plan" className="text-sm text-muted hover:underline">
        ← Plan
      </Link>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="label flex-1">Campaign · {campaign.status}</div>
          {campaign.status === "candidate" && currentQuarter && (
            <form action={setCampaignStatus}>
              <Hidden id={campaign.id} status="active" quarterId={currentQuarter.id} />
              <button className="btn">Activate in current Quarter</button>
            </form>
          )}
          {campaign.status === "active" && (
            <>
              <form action={setCampaignStatus}>
                <Hidden id={campaign.id} status="done" quarterId="" />
                <button className="btn">Mark done</button>
              </form>
              <form action={setCampaignStatus}>
                <Hidden id={campaign.id} status="dropped" quarterId="" />
                <button className="btn">Drop</button>
              </form>
            </>
          )}
          {(campaign.status === "done" || campaign.status === "dropped") && (
            <form action={setCampaignStatus}>
              <Hidden id={campaign.id} status="active" quarterId="" />
              <button className="btn">Reactivate</button>
            </form>
          )}
        </div>
        <form action={updateCampaign} className="flex flex-col gap-2">
          <Hidden id={campaign.id} />
          <input name="title" defaultValue={campaign.title} required className="input text-lg font-semibold" />
          <label className="label" htmlFor="goal">Goal</label>
          <textarea id="goal" name="goal" rows={2} defaultValue={campaign.goal} className="input" />
          <label className="label" htmlFor="why">Why</label>
          <textarea id="why" name="why" rows={2} defaultValue={campaign.why} className="input" />
          <label className="label" htmlFor="antiGoal">Anti-goal / constraints</label>
          <textarea id="antiGoal" name="antiGoal" rows={2} defaultValue={campaign.antiGoal} className="input" />
          <div className="flex flex-wrap gap-2">
            <select name="seasonGoalId" className="input w-auto" defaultValue={campaign.seasonGoalId ?? ""}>
              <option value="">No Season Goal</option>
              {season?.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  Serves: {g.title}
                </option>
              ))}
            </select>
            <select name="blockTypeId" className="input w-auto" defaultValue={campaign.blockTypeId ?? ""}>
              <option value="">No Container Block</option>
              {containers.map((t) => (
                <option key={t.id} value={t.id}>
                  Played in: {t.name}
                </option>
              ))}
            </select>
          </div>
          <GamesPicker selected={campaign.games} />
          <div className="flex gap-2">
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Moves</h2>
        <p className="text-sm text-muted">
          A Move fits in a week. Choose it for a week; it then shows up in the Stack to drag onto the calendar.
          Moves with Tasks are scheduled through their Tasks.
        </p>
        {moves.map((move) => (
          <div key={move.id} className="card flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <form action={toggleWorkDoneForm}>
                <Hidden kind="move" id={move.id} />
                <button className="text-lg leading-none">{move.doneAt ? "☑" : "☐"}</button>
              </form>
              <form action={updateMove} className="flex min-w-48 flex-1 gap-2">
                <Hidden id={move.id} />
                <input
                  name="title"
                  defaultValue={move.title}
                  className={`input font-medium ${move.doneAt ? "line-through opacity-60" : ""}`}
                />
                <button className="btn">Save</button>
              </form>
              {weekLabel(move.weekOf) && (
                <span className="rounded bg-accent/15 px-1.5 text-xs text-accent">{weekLabel(move.weekOf)}</span>
              )}
              {move.weekOf !== thisWeek && (
                <form action={setMoveWeek}>
                  <Hidden id={move.id} weekOf={thisWeek} />
                  <button className="btn">This week</button>
                </form>
              )}
              {move.weekOf !== nextWeek && (
                <form action={setMoveWeek}>
                  <Hidden id={move.id} weekOf={nextWeek} />
                  <button className="btn">Next week</button>
                </form>
              )}
              {move.weekOf && (
                <form action={setMoveWeek}>
                  <Hidden id={move.id} weekOf="" />
                  <button className="btn">Unchoose</button>
                </form>
              )}
              <form action={deleteMove}>
                <Hidden id={move.id} />
                <button className="text-muted hover:text-red-600" title="Delete Move">
                  ×
                </button>
              </form>
            </div>

            <ul className="ml-6 flex flex-col gap-2">
              {move.tasks.map((task) => (
                <li key={task.id} className="rounded-md border border-line p-2">
                  <div className="flex items-center gap-2">
                    <form action={toggleWorkDoneForm}>
                      <Hidden kind="task" id={task.id} />
                      <button>{task.doneAt ? "☑" : "☐"}</button>
                    </form>
                    <form action={updateTask} className="flex flex-1 gap-2">
                      <Hidden id={task.id} />
                      <input
                        name="title"
                        defaultValue={task.title}
                        className={`input ${task.doneAt ? "line-through opacity-60" : ""}`}
                      />
                      <input
                        name="durationMin"
                        type="number"
                        min={15}
                        step={15}
                        defaultValue={task.durationMin}
                        className="input w-20"
                        title="Duration (min)"
                      />
                      <button className="btn">Save</button>
                    </form>
                    <form action={deleteTask}>
                      <Hidden id={task.id} />
                      <button className="text-muted hover:text-red-600" title="Delete Task">
                        ×
                      </button>
                    </form>
                  </div>
                  <ul className="ml-6 mt-1 flex flex-col gap-0.5 text-sm">
                    {task.steps.map((step) => (
                      <li key={step.id} className="flex items-center gap-2">
                        <form action={toggleStep}>
                          <Hidden id={step.id} />
                          <button>{step.done ? "☑" : "☐"}</button>
                        </form>
                        <span className={step.done ? "line-through opacity-60" : ""}>{step.title}</span>
                        <form action={deleteStep} className="ml-auto">
                          <Hidden id={step.id} />
                          <button className="text-muted hover:text-red-600">×</button>
                        </form>
                      </li>
                    ))}
                    <li>
                      <form action={createStep} className="flex gap-2">
                        <Hidden taskId={task.id} />
                        <input name="title" required placeholder="Add a Step" className="input text-xs" />
                      </form>
                    </li>
                  </ul>
                </li>
              ))}
              <li>
                <form action={createTask} className="flex gap-2">
                  <Hidden moveId={move.id} />
                  <input name="title" required placeholder="Add a Task" className="input" />
                  <input
                    name="durationMin"
                    type="number"
                    min={15}
                    step={15}
                    defaultValue={60}
                    className="input w-20"
                    title="Duration (min)"
                  />
                  <button className="btn">Add</button>
                </form>
              </li>
            </ul>
          </div>
        ))}
        <form action={createMove} className="card flex flex-wrap gap-2">
          <Hidden campaignId={campaign.id} />
          <input name="title" required placeholder="New Move (e.g. SSO login)" className="input min-w-48 flex-1" />
          <select name="weekOf" className="input w-auto" defaultValue={thisWeek}>
            <option value={thisWeek}>This week</option>
            <option value={nextWeek}>Next week</option>
            <option value="">Not chosen yet</option>
          </select>
          <button className="btn-primary">Add Move</button>
        </form>
      </section>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Danger zone</summary>
        <form action={deleteCampaign} className="mt-2">
          <Hidden id={campaign.id} />
          <button className="btn text-red-600">Delete Campaign and all its Moves</button>
        </form>
      </details>
    </div>
  );
}
