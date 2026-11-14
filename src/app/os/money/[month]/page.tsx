import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MoneyMonth, MonthLink } from "@/components/money";
import { AddMovementButton } from "@/components/money-add";
import { addMonths, isIsoMonth, monthLabel, monthOf } from "@/domain/dates";
import { moneyTab } from "@/domain/money";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getMoneyMonth } from "@/server/money";

export const metadata = { title: "Money" };

/** Where my money went this month, and the Accounts and Categories behind it (Ronda 59). */
export default async function MoneyPage({ params, searchParams }: PageProps<"/os/money/[month]">) {
  await requireIvan();
  const { month } = await params;
  const tab = moneyTab((await searchParams).tab);
  if (!isIsoMonth(month)) notFound();
  const now = today();
  const view = await getMoneyMonth(month, now);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Suspense
          fallback={
            <Link className="btn" href={`/os/money/${addMonths(month, -1)}`} aria-label="Previous month">
              ←
            </Link>
          }
        >
          <MonthLink className="btn" month={addMonths(month, -1)} aria-label="Previous month">
            ←
          </MonthLink>
        </Suspense>
        <h1 className="text-xl font-semibold tracking-tight">Money · {monthLabel(month)}</h1>
        <Suspense
          fallback={
            <Link className="btn" href={`/os/money/${addMonths(month, 1)}`} aria-label="Next month">
              →
            </Link>
          }
        >
          <MonthLink className="btn" month={addMonths(month, 1)} aria-label="Next month">
            →
          </MonthLink>
        </Suspense>
        {monthOf(now) !== month && (
          <Link className="btn" href={`/os/money/${monthOf(now)}`}>
            This month
          </Link>
        )}
        <div className="flex-1" />
        {view.accounts.length > 0 && <AddMovementButton />}
      </div>
      <MoneyMonth key={month} view={view} today={now} tab={tab} />
    </div>
  );
}
