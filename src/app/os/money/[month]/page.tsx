import Link from "next/link";
import { notFound } from "next/navigation";
import { MoneyMonth } from "@/components/money";
import { AddMovementButton } from "@/components/money-add";
import { addMonths, isIsoMonth, monthLabel, monthOf } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getMoneyMonth } from "@/server/money";

export const metadata = { title: "Money" };

/** Where my money went this month, and the Accounts and Categories behind it (Ronda 59). */
export default async function MoneyPage({ params }: PageProps<"/os/money/[month]">) {
  await requireIvan();
  const { month } = await params;
  if (!isIsoMonth(month)) notFound();
  const now = today();
  const view = await getMoneyMonth(month);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link className="btn" href={`/os/money/${addMonths(month, -1)}`} aria-label="Previous month">
          ←
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Money · {monthLabel(month)}</h1>
        <Link className="btn" href={`/os/money/${addMonths(month, 1)}`} aria-label="Next month">
          →
        </Link>
        {monthOf(now) !== month && (
          <Link className="btn" href={`/os/money/${monthOf(now)}`}>
            This month
          </Link>
        )}
        <div className="flex-1" />
        {view.accounts.length > 0 && <AddMovementButton />}
      </div>
      <MoneyMonth view={view} today={now} />
    </div>
  );
}
