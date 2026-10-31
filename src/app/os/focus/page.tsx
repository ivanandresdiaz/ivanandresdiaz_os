import Link from "next/link";
import { CycleStartForm } from "@/components/cycle-start-form";
import { FocusScreen } from "@/components/focus-screen";
import { NotificationsToggle } from "@/components/pwa";
import { PageTitle } from "@/components/ui";
import { formatDuration, formatMinutes, localMoment } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { APP_TIMEZONE, today } from "@/lib/today";
import { getActiveCycle, getCycleHistory, getCyclePresets, getStack } from "@/server/queries";

export const metadata = { title: "Focus" };

export default async function FocusPage() {
  await requireIvan();
  const [active, presets] = await Promise.all([getActiveCycle(), getCyclePresets()]);
  if (active) return <FocusScreen key={active.id} cycle={active} presets={presets} />;

  const date = today();
  const [stack, history] = await Promise.all([getStack(date), getCycleHistory(date, date)]);
  const work = [...stack.carriedOver, ...stack.thisWeek, ...stack.loose].filter((i) => !i.done);
  const total = history.reduce((sum, c) => sum + c.realFocusMin, 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageTitle aside={<NotificationsToggle />}>Focus</PageTitle>
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Start a Cycle</h2>
        <CycleStartForm presets={presets} work={work} />
        <p className="text-xs text-muted">
          Cycles are optional. They measure real time as a focus aid; your plan stays on the calendar.{" "}
          <Link href="/os/cycles" className="underline">
            Presets and history
          </Link>
        </p>
      </section>
      {history.length > 0 && (
        <section className="card flex flex-col gap-2">
          <h2 className="font-semibold">
            Today <span className="text-sm font-normal text-muted">· {formatDuration(total)} of real focus</span>
          </h2>
          <ul className="space-y-1 text-sm">
            {history.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className="w-12 text-muted">{formatMinutes(localMoment(c.startedAt, APP_TIMEZONE).minute)}</span>
                <span className="flex-1">{c.work?.title ?? (c.label || "Free Cycle")}</span>
                <span className={c.complete ? "text-accent" : "text-muted"}>
                  {formatDuration(c.realFocusMin)} {c.complete ? "✓" : `/ ${c.focusMin}m`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
