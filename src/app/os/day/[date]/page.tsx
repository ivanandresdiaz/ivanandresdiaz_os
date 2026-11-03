import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar } from "@/components/calendar";
import { CheckInPrinciples } from "@/components/check-in-principles";
import { CycleStartForm } from "@/components/cycle-start-form";
import { Highlights } from "@/components/highlights";
import { NoiseItems } from "@/components/noise-items";
import { SecondaryTasks } from "@/components/secondary-tasks";
import { Stack } from "@/components/stack";
import { Hidden } from "@/components/ui";
import {
  addDays,
  formatDuration,
  formatMinutes,
  isIsoDate,
  localMoment,
  monthOf,
  quarterLabel,
  startOfWeek,
  WEEKDAY_NAMES,
  weekdayOf,
} from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { APP_TIMEZONE, today } from "@/lib/today";
import { completeCheckIn } from "@/server/actions";
import {
  getActiveCycle,
  getCalendar,
  getCheckInContext,
  getCycleHistory,
  getCyclePresets,
  getDailyNote,
  getFeedProgress,
  getStack,
} from "@/server/queries";

export default async function DayPage({ params }: PageProps<"/os/day/[date]">) {
  await requireIvan();
  const { date } = await params;
  if (!isIsoDate(date)) notFound();

  const now = today();
  const [context, note, [day], stack, presets, cycles, activeCycle, feed] = await Promise.all([
    getCheckInContext(date),
    getDailyNote(date),
    getCalendar([date]),
    getStack(date),
    getCyclePresets(),
    getCycleHistory(date, date),
    getActiveCycle(),
    date === now ? getFeedProgress(date) : null,
  ]);
  const realFocus = cycles.reduce((sum, c) => sum + c.realFocusMin, 0);
  const stackItems = stack.pickable;

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
        <Link className="btn" href={`/os/month/${monthOf(date)}`}>
          Month view
        </Link>
        {feed && (
          // Optional: no checkbox, no XP, no nudge when skipped.
          <Link className="ml-auto text-sm text-muted hover:text-foreground" href="/os/feed">
            Feed {feed.seen}/{feed.total}
          </Link>
        )}
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

            <CheckInPrinciples principles={context.principles} />

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
                      <Link href={`/os/plan?campaign=${c.id}&col=campaign`} className="font-medium hover:underline">
                        {c.title}
                      </Link>
                      {c.goal && <span className="text-muted"> — {c.goal}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <Highlights
            date={date}
            highlights={note.highlights.map(({ id, title, why, done }) => ({ id, title, why, done }))}
            workOptions={stackItems.map((item) => ({
              value: `${item.kind}:${item.id}`,
              label: item.campaignTitle ? `${item.title} (${item.campaignTitle})` : item.title,
            }))}
          />

          <SecondaryTasks date={date} today={now} tasks={note.secondaryTasks} />

          <NoiseItems date={date} items={note.noiseItems} />

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

          <Link href={`/os/week/${startOfWeek(date)}`} className="px-1 text-xs text-muted hover:underline">
            Change this day&apos;s Blocks in the Week
          </Link>
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
