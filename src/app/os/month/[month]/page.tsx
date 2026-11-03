import Link from "next/link";
import { notFound } from "next/navigation";
import { MonthView } from "@/components/month-view";
import { addMonths, isIsoMonth, monthGrid, monthLabel, monthOf } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getMonth, getUpkeeps } from "@/server/queries";

/**
 * A way to look ahead and reach a far day. Scheduling happens in that day's
 * Day; here only pending Secondary Tasks move to another day. Its Upkeeps open
 * in a drawer (`?upkeep=<id>` opens it on one).
 */
export default async function MonthPage({ params, searchParams }: PageProps<"/os/month/[month]">) {
  await requireIvan();
  const { month } = await params;
  if (!isIsoMonth(month)) notFound();
  const { upkeep } = await searchParams;

  const now = today();
  const [days, upkeeps] = await Promise.all([getMonth(monthGrid(month).flat()), getUpkeeps()]);

  return (
    <MonthView
      month={month}
      days={days}
      today={now}
      upkeeps={upkeeps}
      focusUpkeepId={typeof upkeep === "string" ? upkeep : null}
      header={
        <>
          <Link className="btn" href={`/os/month/${addMonths(month, -1)}`}>
            ←
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{monthLabel(month)}</h1>
          <Link className="btn" href={`/os/month/${addMonths(month, 1)}`}>
            →
          </Link>
          {monthOf(now) !== month && (
            <Link className="btn" href={`/os/month/${monthOf(now)}`}>
              This month
            </Link>
          )}
        </>
      }
    />
  );
}
