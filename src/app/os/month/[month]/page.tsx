import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addMonths,
  formatMinutes,
  isIsoMonth,
  monthGrid,
  monthLabel,
  monthOf,
  WEEKDAY_NAMES,
  WEEKDAYS,
  weekdayOf,
} from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getMonth, type MonthItem } from "@/server/queries";

/** A way to look ahead and reach a far day; scheduling happens in that day's Day. */
export default async function MonthPage({ params }: PageProps<"/os/month/[month]">) {
  await requireIvan();
  const { month } = await params;
  if (!isIsoMonth(month)) notFound();

  const now = today();
  const days = await getMonth(monthGrid(month).flat());

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
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
      </div>
      <p className="-mt-2 text-xs text-muted">Click a day to open it, then add or schedule there.</p>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="bg-surface py-1 text-center text-[11px] text-muted">
            {WEEKDAY_NAMES[weekday].slice(0, 3)}
          </div>
        ))}
        {days.map(({ date, items }) => {
          const outside = monthOf(date) !== month;
          return (
            <Link
              key={date}
              href={`/os/day/${date}`}
              title={`${WEEKDAY_NAMES[weekdayOf(date)]} ${date}`}
              className={`flex min-h-20 min-w-0 flex-col gap-0.5 bg-background p-1 hover:bg-surface sm:min-h-24 ${
                outside ? "opacity-45" : ""
              }`}
            >
              <span
                className={`self-start rounded px-1 text-xs ${
                  date === now ? "bg-accent font-semibold text-background" : "text-muted"
                }`}
              >
                {Number(date.slice(8))}
              </span>
              {items.map((item) => (
                <Item key={item.key} item={item} />
              ))}
            </Link>
          );
        })}
      </div>
    </>
  );
}

function Item({ item }: { item: MonthItem }) {
  return (
    <span
      className={`truncate border-l-2 pl-1 text-[11px] leading-tight ${
        item.done ? "text-muted line-through" : ""
      }`}
      style={{ borderColor: item.color }}
    >
      {/* On a phone the cell is too narrow for both: the title wins. */}
      {item.startMin !== null && (
        <span className="hidden text-muted tabular-nums sm:inline">{formatMinutes(item.startMin)} </span>
      )}
      {item.title}
    </span>
  );
}
