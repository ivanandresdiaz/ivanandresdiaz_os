import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar } from "@/components/calendar";
import { Stack } from "@/components/stack";
import { addDays, isIsoDate, monthOf, startOfWeek, weekDates } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { APP_TIMEZONE, today } from "@/lib/today";
import { getBlockTypes, getCalendar, getStack } from "@/server/queries";

export default async function WeekPage({ params }: PageProps<"/os/week/[date]">) {
  await requireIvan();
  const { date } = await params;
  if (!isIsoDate(date)) notFound();
  const monday = startOfWeek(date);
  if (monday !== date) redirect(`/os/week/${monday}`);

  const now = today();
  const dates = weekDates(monday);
  const [days, stack, blockTypes] = await Promise.all([getCalendar(dates), getStack(monday), getBlockTypes()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link className="btn" href={`/os/week/${addDays(monday, -7)}`}>
          ←
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          Week of {monday}
        </h1>
        <Link className="btn" href={`/os/week/${addDays(monday, 7)}`}>
          →
        </Link>
        {!dates.includes(now) && (
          <Link className="btn" href={`/os/week/${startOfWeek(now)}`}>
            This week
          </Link>
        )}
        <Link className="btn" href={`/os/month/${monthOf(monday)}`}>
          Month view
        </Link>
      </div>
      <p className="-mt-2 text-xs text-muted">
        With the mouse, change a day&apos;s Blocks from today on: draw to add one, click one to reassign it, × to
        remove it, ↺ to return the day to the Structure.
      </p>
      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(260px,300px)]">
        <Calendar days={days} today={now} timeZone={APP_TIMEZONE} blockTypes={blockTypes} />
        <aside className="flex flex-col gap-2">
          <h2 className="font-semibold">Stack</h2>
          <p className="text-xs text-muted">Drag work onto a day.</p>
          <Stack thisWeek={stack.thisWeek} carriedOver={stack.carriedOver} loose={stack.loose} />
        </aside>
      </div>
    </>
  );
}
