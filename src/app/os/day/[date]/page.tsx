import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar } from "@/components/calendar";
import { CycleStartForm } from "@/components/cycle-start-form";
import { Stack } from "@/components/stack";
import { Hidden } from "@/components/ui";
import {
  addDays,
  formatDuration,
  formatMinutes,
  isIsoDate,
  localMoment,
  quarterLabel,
  startOfWeek,
  WEEKDAY_NAMES,
  weekdayOf,
} from "@/domain/dates";
import { MAX_HIGHLIGHTS } from "@/domain/highlights";
import { requireIvan } from "@/lib/session";
import { APP_TIMEZONE, today } from "@/lib/today";
import {
  addHighlight,
  completeCheckIn,
  deleteException,
  deleteHighlight,
  saveEliminate,
  setExceptionForm,
  toggleHighlight,
} from "@/server/actions";
import {
  getActiveCycle,
  getBlockTypes,
  getCalendar,
  getCheckInContext,
  getCycleHistory,
  getCyclePresets,
  getDailyNote,
  getStack,
} from "@/server/queries";

export default async function DayPage({ params }: PageProps<"/os/day/[date]">) {
  await requireIvan();
  const { date } = await params;
  if (!isIsoDate(date)) notFound();

  const now = today();
  const [context, note, [day], stack, blockTypes, presets, cycles, activeCycle] = await Promise.all([
    getCheckInContext(date),
    getDailyNote(date),
    getCalendar([date]),
    getStack(date),
    getBlockTypes(),
    getCyclePresets(),
    getCycleHistory(date, date),
    getActiveCycle(),
  ]);
  const realFocus = cycles.reduce((sum, c) => sum + c.realFocusMin, 0);
  const stackItems = [...stack.carriedOver, ...stack.thisWeek, ...stack.loose].filter((i) => !i.done);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link className="btn" href={`/os/day/${addDays(date, -1)}`}>
          ←
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {WEEKDAY_NAMES[weekdayOf(date)]} {date}
          {date === now && <span className="ml-2 text-sm font-normal text-accent">today</span>}
        </h1>
        <Link className="btn" href={`/os/day/${addDays(date, 1)}`}>
          →
        </Link>
        {date !== now && (
          <Link className="btn" href={`/os/day/${now}`}>
            Today
          </Link>
        )}
        <Link className="btn" href={`/os/week/${startOfWeek(date)}`}>
          Week view
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_1fr_minmax(260px,300px)]">
        {/* ── Check-in ── */}
        <div className="flex flex-col gap-4">
          {note.dayWon && (
            <div className="card border-accent text-center">
              <div className="text-lg font-semibold text-accent">Day Won 🏆</div>
              <p className="text-sm text-muted">Every Highlight is done. The remaining Container Blocks are free.</p>
            </div>
          )}

          <section className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Check-in</h2>
              {note.checkInDoneAt ? (
                <span className="text-xs text-accent">✓ done</span>
              ) : (
                <form action={completeCheckIn}>
                  <Hidden date={date} />
                  <button className="btn-primary">Complete check-in</button>
                </form>
              )}
            </div>

            <details>
              <summary className="label cursor-pointer">Principles</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {context.principles.map((p) => (
                  <li key={p.id}>
                    <span className="font-medium">{p.title}</span>
                    {p.body && <span className="text-muted"> — {p.body}</span>}
                  </li>
                ))}
              </ol>
            </details>

            {context.season && (
              <div>
                <div className="label">Season</div>
                <div className="text-sm font-medium">{context.season.title}</div>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                  {context.season.goals.map((g) => (
                    <li key={g.id}>{g.title}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="label">
                {quarterLabel(context.quarterRef)} Campaigns
              </div>
              {context.campaigns.length === 0 ? (
                <p className="text-sm text-muted">
                  No active Campaigns. <Link href="/os/plan" className="underline">Plan the Quarter</Link>.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {context.campaigns.map((c) => (
                    <li key={c.id}>
                      <Link href={`/os/campaigns/${c.id}`} className="font-medium hover:underline">
                        {c.title}
                      </Link>
                      {c.goal && <span className="text-muted"> — {c.goal}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card flex flex-col gap-3">
            <h2 className="font-semibold">
              Highlights <span className="text-sm font-normal text-muted">({note.highlights.length}/{MAX_HIGHLIGHTS})</span>
            </h2>
            {note.highlights.map((h) => (
              <div key={h.id} className="flex items-start gap-2">
                <form action={toggleHighlight}>
                  <Hidden id={h.id} />
                  <button className="mt-0.5 text-lg leading-none" aria-label={h.done ? "Mark not done" : "Mark done"}>
                    {h.done ? "☑" : "☐"}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${h.done ? "line-through opacity-60" : ""}`}>{h.title}</div>
                  <div className="text-sm text-muted">Why: {h.why}</div>
                </div>
                <form action={deleteHighlight}>
                  <Hidden id={h.id} />
                  <button className="text-muted hover:text-red-600" title="Remove">
                    ×
                  </button>
                </form>
              </div>
            ))}
            {note.highlights.length < MAX_HIGHLIGHTS && (
              <form action={addHighlight} className="flex flex-col gap-2 border-t border-line pt-3">
                <Hidden date={date} />
                <input name="title" required placeholder="What is critical to get done today?" className="input" />
                <input name="why" required placeholder="Why does it move the needle?" className="input" />
                <select name="work" className="input" defaultValue="">
                  <option value="">Not linked to a Task or Move</option>
                  {stackItems.map((item) => (
                    <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                      {item.title}
                      {item.campaignTitle ? ` (${item.campaignTitle})` : ""}
                    </option>
                  ))}
                </select>
                <button className="btn-primary self-start">Add Highlight</button>
              </form>
            )}
          </section>

          <section className="card">
            <form action={saveEliminate} className="flex flex-col gap-2">
              <Hidden date={date} />
              <label htmlFor="eliminate" className="font-semibold">
                Eliminate <span className="text-sm font-normal text-muted">(the noise for today)</span>
              </label>
              <textarea id="eliminate" name="eliminate" rows={3} defaultValue={note.eliminate} className="input" />
              <button className="btn self-start">Save</button>
            </form>
          </section>

          <section className="card flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Reality</h2>
              <Link href="/os/cycles" className="text-xs text-muted hover:underline">
                Cycles →
              </Link>
            </div>
            <p className="text-sm text-muted">
              {cycles.length === 0
                ? "No Cycles yet. They are optional: real time is a focus aid, not the measure."
                : `${formatDuration(realFocus)} of real focus · ${cycles.filter((c) => c.complete).length}/${cycles.length} Cycles complete`}
            </p>
            {cycles.length > 0 && (
              <ul className="space-y-0.5 text-xs">
                {cycles.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <span className="w-10 text-muted">{formatMinutes(localMoment(c.startedAt, APP_TIMEZONE).minute)}</span>
                    <span className="flex-1 truncate">{c.work?.title ?? (c.label || "Free Cycle")}</span>
                    <span className={c.complete ? "text-accent" : "text-muted"}>
                      {formatDuration(c.realFocusMin)}
                      {c.startDelayMin ? ` · ${c.startDelayMin > 0 ? "+" : ""}${c.startDelayMin}m` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {date === now &&
              (activeCycle ? (
                <Link href="/os/focus" className="btn-primary self-start">
                  Back to the running Cycle
                </Link>
              ) : (
                <details>
                  <summary className="cursor-pointer text-sm text-muted">Start a Cycle</summary>
                  <div className="mt-2">
                    <CycleStartForm presets={presets} work={stackItems} compact />
                  </div>
                </details>
              ))}
          </section>

          <section className="card flex flex-col gap-2">
            <h2 className="font-semibold">This day&apos;s Blocks</h2>
            <p className="text-xs text-muted">
              Drag a Block on the calendar to change it for this day only. The weekly{" "}
              <Link href="/os/structure" className="underline">Structure</Link> stays the same.
            </p>
            <ul className="space-y-1 text-sm">
              {day.blocks.map((b) => (
                <li key={b.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.type.color }} />
                  <span className="flex-1">{b.type.name}</span>
                  {b.exceptionId ? (
                    <form action={deleteException}>
                      <Hidden id={b.exceptionId} />
                      <button className="text-xs text-muted hover:underline">
                        {b.structureBlockId ? "reset" : "remove"}
                      </button>
                    </form>
                  ) : (
                    <form action={setExceptionForm}>
                      <Hidden
                        date={date}
                        structureBlockId={b.structureBlockId ?? ""}
                        removed="true"
                        startMin="00:00"
                        endMin="00:00"
                        blockTypeId={b.blockTypeId}
                      />
                      <button className="text-xs text-muted hover:underline">skip today</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <details>
              <summary className="cursor-pointer text-sm text-muted">Add a Block for this day</summary>
              <form action={setExceptionForm} className="mt-2 flex flex-wrap items-end gap-2">
                <Hidden date={date} structureBlockId="" removed="false" />
                <select name="blockTypeId" className="input w-auto" required>
                  {blockTypes
                    .filter((t) => !t.archived)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <input name="startMin" type="time" step={900} defaultValue="09:00" className="input w-auto" required />
                <input name="endMin" type="time" step={900} defaultValue="10:00" className="input w-auto" required />
                <button className="btn">Add</button>
              </form>
            </details>
          </section>
        </div>

        {/* ── Calendar ── */}
        <Calendar days={[day]} today={now} timeZone={APP_TIMEZONE} />

        {/* ── Stack ── */}
        <aside className="flex flex-col gap-2">
          <h2 className="font-semibold">Stack</h2>
          <p className="text-xs text-muted">Drag work onto the calendar.</p>
          <Stack thisWeek={stack.thisWeek} carriedOver={stack.carriedOver} loose={stack.loose} />
        </aside>
      </div>
    </>
  );
}
