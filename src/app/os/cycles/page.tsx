import { NotificationsToggle } from "@/components/pwa";
import { Hidden, PageTitle } from "@/components/ui";
import { addDays, formatDuration, formatMinutes, localMoment, WEEKDAY_NAMES, weekdayOf } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { APP_TIMEZONE, today } from "@/lib/today";
import {
  createCyclePreset,
  deleteCyclePreset,
  makeDefaultCyclePreset,
  updateCyclePreset,
} from "@/server/actions";
import { getCycleHistory, getCyclePresets } from "@/server/queries";

export const metadata = { title: "Cycles" };

const HISTORY_DAYS = 7;

export default async function CyclesPage() {
  await requireIvan();
  const end = today();
  const start = addDays(end, -(HISTORY_DAYS - 1));
  const [presets, history] = await Promise.all([getCyclePresets(), getCycleHistory(start, end)]);
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(end, -i));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageTitle aside={<NotificationsToggle />}>Cycles</PageTitle>
      <p className="-mt-4 text-sm text-muted">
        Stretches of focus with a break. Optional: they measure real time as a focus aid and for the game — the
        plan and Alignment stay on the calendar.
      </p>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Presets</h2>
        <ul className="flex flex-col gap-2">
          {presets.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <form action={updateCyclePreset} className="flex flex-1 flex-wrap items-center gap-2">
                <Hidden id={p.id} />
                <input name="name" defaultValue={p.name} required className="input w-40" />
                <label className="flex items-center gap-1 text-sm">
                  <input name="focusMin" type="number" min={1} max={480} defaultValue={p.focusMin} className="input w-20" />
                  focus
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input name="breakMin" type="number" min={0} max={120} defaultValue={p.breakMin} className="input w-20" />
                  break
                </label>
                <button className="btn">Save</button>
              </form>
              {i === 0 ? (
                <span className="text-xs text-accent">default</span>
              ) : (
                <form action={makeDefaultCyclePreset}>
                  <Hidden id={p.id} />
                  <button className="text-xs text-muted hover:underline">make default</button>
                </form>
              )}
              <form action={deleteCyclePreset}>
                <Hidden id={p.id} />
                <button className="text-muted hover:text-red-600" title="Delete">
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createCyclePreset} className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input name="name" required placeholder="New preset" className="input w-40" />
          <input name="focusMin" type="number" min={1} max={480} defaultValue={45} className="input w-20" />
          <span className="text-sm">+</span>
          <input name="breakMin" type="number" min={0} max={120} defaultValue={5} className="input w-20" />
          <button className="btn">Add</button>
        </form>
        <p className="text-xs text-muted">The ▶ buttons on the calendar and the Stack use the default preset.</p>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="font-semibold">Last {HISTORY_DAYS} days</h2>
        {days.map((date) => {
          const own = history.filter((c) => localMoment(c.startedAt, APP_TIMEZONE).date === date);
          if (own.length === 0) return null;
          const total = own.reduce((sum, c) => sum + c.realFocusMin, 0);
          return (
            <div key={date}>
              <div className="flex items-baseline justify-between border-b border-line pb-1">
                <span className="text-sm font-medium">
                  {WEEKDAY_NAMES[weekdayOf(date)]} {date}
                </span>
                <span className="text-sm text-muted">
                  {formatDuration(total)} · {own.filter((c) => c.complete).length}/{own.length} complete
                </span>
              </div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {own.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <span className="w-12 text-muted">{formatMinutes(localMoment(c.startedAt, APP_TIMEZONE).minute)}</span>
                    <span className="flex-1 truncate">
                      {c.work?.title ?? (c.label || "Free Cycle")}
                      {c.work?.campaignTitle && <span className="text-muted"> · {c.work.campaignTitle}</span>}
                    </span>
                    {c.startDelayMin !== null && c.startDelayMin !== 0 && (
                      <span className="text-xs text-muted" title="Against the planned Slot">
                        {c.startDelayMin > 0 ? `+${c.startDelayMin}` : c.startDelayMin} min
                      </span>
                    )}
                    <span className={c.complete ? "text-accent" : "text-muted"}>
                      {formatDuration(c.realFocusMin)} {c.complete ? "✓" : `/ ${c.focusMin}m`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {history.length === 0 && <p className="text-sm text-muted">No Cycles in the last {HISTORY_DAYS} days.</p>}
      </section>
    </div>
  );
}
