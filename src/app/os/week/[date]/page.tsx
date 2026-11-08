import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar } from "@/components/calendar";
import { WeekChapters } from "@/components/learning-paths";
import { Stack } from "@/components/stack";
import { ReviewPanel } from "@/components/weekly-review";
import { addDays, isIsoDate, monthOf, startOfWeek, weekDates } from "@/domain/dates";
import { openReview, reviewStep } from "@/domain/reviews";
import { requireIvan } from "@/lib/session";
import { APP_TIMEZONE, today } from "@/lib/today";
import { getChaptersOfWeek } from "@/server/learning-paths";
import { getBlockTypes, getCalendar, getCalendarConnected, getStack, isReviewDone } from "@/server/queries";

export default async function WeekPage({ params, searchParams }: PageProps<"/os/week/[date]">) {
  await requireIvan();
  const [{ date }, { review }] = await Promise.all([params, searchParams]);
  if (!isIsoDate(date)) notFound();
  const monday = startOfWeek(date);
  if (monday !== date) redirect(`/os/week/${monday}`);

  const now = today();
  const dates = weekDates(monday);
  const open = openReview(now);
  const [days, stack, blockTypes, calendarConnected, reviewDone, chapters] = await Promise.all([
    getCalendar(dates),
    getStack(monday),
    getBlockTypes(),
    getCalendarConnected(),
    open ? isReviewDone(open.week) : false,
    getChaptersOfWeek(monday),
  ]);
  const pending = open && !reviewDone ? open : null;
  const step = reviewStep(typeof review === "string" ? review : undefined, monday, pending);
  const reviewHref = pending
    ? `/os/week/${pending.week}?review=look`
    : `/os/week/${open?.week ?? monday}?review=read`;

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
        <Link className="btn" href={reviewHref}>
          Weekly Review
        </Link>
        {reviewDone && <span className="text-xs text-accent">✓ done</span>}
      </div>
      <p className="-mt-2 text-xs text-muted">
        With the mouse, change a day&apos;s Blocks from today on: draw to add one, click one to reassign it, × to
        remove it, ↺ to return the day to the Structure.
      </p>
      <div
        className={`grid gap-4 ${step ? "xl:grid-cols-[auto_minmax(0,1fr)_minmax(260px,300px)]" : "xl:grid-cols-[1fr_minmax(260px,300px)]"}`}
      >
        {step && <ReviewPanel step={step} week={monday} pending={pending} today={now} />}
        <Calendar days={days} today={now} timeZone={APP_TIMEZONE} blockTypes={blockTypes} calendarConnected={calendarConnected} />
        <aside className="flex flex-col gap-2">
          <h2 className="font-semibold">Stack</h2>
          <p className="text-xs text-muted">Drag work onto a day.</p>
          <Stack
            thisWeek={stack.thisWeek}
            carriedOver={stack.carriedOver}
            loose={stack.loose}
            movesTitle={monday === addDays(startOfWeek(now), 7) ? "Next week's Moves" : undefined}
          />
          <WeekChapters chapters={chapters} />
        </aside>
      </div>
    </>
  );
}
