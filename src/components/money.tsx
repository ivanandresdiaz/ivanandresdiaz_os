"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { IsoDate } from "@/domain/dates";
import {
  amountInput,
  amountTyping,
  CURRENCIES,
  formatAmount,
  MAX_MONEY_NAME,
  MONEY_TABS,
  parseBalance,
  pieSlices,
  shareLabel,
  type Currency,
  type MoneyTab,
} from "@/domain/money";
import {
  adjustAccount,
  confirmOccurrence,
  createAccount,
  createCategory,
  deleteAccount,
  deleteAdjustment,
  deleteCategory,
  loadCampaignMoney,
  mergeCategory,
  renameCategory,
  skipOccurrence,
  unskipOccurrence,
  updateAccount,
} from "@/server/money-actions";
import type {
  AccountView,
  AdjustmentView,
  CampaignMoneyView,
  CategoryKind,
  CategoryMonthView,
  CategoryView,
  MoneyMonthView,
  MovementView,
  OccurrenceView,
  RecurringView,
} from "@/server/money";
import { ConfirmDelete } from "./confirm-delete";
import { ConfirmWithChanges, EditMovement, RecurringButton } from "./money-add";
import { ClipIcon } from "./money-receipts";
import { shortDate } from "./upkeeps";

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The month at a glance (Q12): what came in, what went out, what was saved, and where it went. */
export function MoneyMonth({ view, today, tab: initialTab }: { view: MoneyMonthView; today: IsoDate; tab: MoneyTab }) {
  const [tab, setTab] = useState<MoneyTab>(initialTab);

  if (view.accounts.length === 0) {
    return (
      <Section title="Start here">
        <p className="text-sm">
          Create the Accounts you have money in (cash, Nequi, Bancolombia…), each with what it holds today. Then
          use the <span className="font-semibold">+</span> to add what you spend.
        </p>
        <AccountForm />
      </Section>
    );
  }

  const pending = view.occurrences.filter((o) => o.state === "pending");

  function choose(next: MoneyTab) {
    setTab(next);
    // Kept in the address, so a reload or going back lands on the same tab (Q1).
    const url = new URL(window.location.href);
    if (next === "movements") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {view.summary.map((line) => (
          <section key={line.currency} className="card grid grid-cols-3 gap-2">
            <Stat label="Income" value={formatAmount(line.income, line.currency)} />
            <Stat label="Expenses" value={formatAmount(line.expenses, line.currency)} />
            <Stat
              label="Saved"
              value={formatAmount(line.saved, line.currency)}
              hint={line.savedShare === null ? undefined : `${shareLabel(line.savedShare)} of Income`}
            />
            {view.summary.length > 1 && <p className="col-span-3 text-[11px] text-muted">{line.currency}</p>}
          </section>
        ))}
      </div>

      {pending.length > 0 && (
        <Section title={`To confirm · ${pending.length}`}>
          <ul className="flex flex-col gap-1">
            {pending.map((o) => (
              <OccurrenceRow key={`${o.recurring.id}:${o.month}`} occurrence={o} today={today} />
            ))}
          </ul>
        </Section>
      )}

      <WhereItWent byCategory={view.byCategory} incomeByCategory={view.incomeByCategory} today={today} />

      <div className="flex flex-col gap-3">
        <MoneyTabs tab={tab} onChoose={choose} pending={pending.length} />
        <div role="tabpanel" id={`money-panel-${tab}`} aria-labelledby={`money-tab-${tab}`} className="flex flex-col gap-4">
          {tab === "movements" && <Movements movements={view.movements} adjustments={view.adjustments} today={today} />}
          {tab === "recurrings" && (
            <Recurrings occurrences={view.occurrences} recurrings={view.recurrings} today={today} />
          )}
          {tab === "accounts" && <Accounts accounts={view.accounts} />}
          {tab === "categories" && (
            <>
              <Categories kind="expense" categories={view.categories.filter((c) => c.kind === "expense")} />
              <Categories kind="income" categories={view.categories.filter((c) => c.kind === "income")} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

const TAB_LABEL: Record<MoneyTab, string> = {
  movements: "Movements",
  recurrings: "Recurrings",
  accounts: "Accounts",
  categories: "Categories",
};

/** The tabs under the summary (Ronda 61): a line under each, the chosen one in the accent color. */
function MoneyTabs({ tab, onChoose, pending }: { tab: MoneyTab; onChoose: (tab: MoneyTab) => void; pending: number }) {
  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = MONEY_TABS[(MONEY_TABS.indexOf(tab) + step + MONEY_TABS.length) % MONEY_TABS.length];
    onChoose(next);
    document.getElementById(`money-tab-${next}`)?.focus();
  }
  return (
    <div role="tablist" aria-label="Money" onKeyDown={onKeyDown} className="flex overflow-x-auto border-b border-line [scrollbar-width:none]">
      {MONEY_TABS.map((t) => {
        const selected = t === tab;
        return (
          <button
            key={t}
            id={`money-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`money-panel-${t}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChoose(t)}
            className={`-mb-px flex min-h-10 flex-1 shrink-0 items-center justify-center gap-1.5 border-b-2 px-1.5 text-sm whitespace-nowrap transition ${
              selected
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted hover:border-line hover:text-foreground"
            }`}
          >
            {TAB_LABEL[t]}
            {t === "recurrings" && pending > 0 && (
              <span className="rounded-full bg-accent/15 px-1.5 text-xs font-medium text-accent tabular-nums">
                {pending}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="label">{label}</span>
      <span className="truncate text-lg font-semibold tabular-nums" title={value}>
        {value}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

/**
 * Eight colors, in their validated order; any Category past the eighth (and
 * old Income without one, at -1) is gray. Written out so Tailwind sees them.
 */
const SLICE_FILL = [
  "fill-(--series-1)",
  "fill-(--series-2)",
  "fill-(--series-3)",
  "fill-(--series-4)",
  "fill-(--series-5)",
  "fill-(--series-6)",
  "fill-(--series-7)",
  "fill-(--series-8)",
];
const SLICE_BG = [
  "bg-(--series-1)",
  "bg-(--series-2)",
  "bg-(--series-3)",
  "bg-(--series-4)",
  "bg-(--series-5)",
  "bg-(--series-6)",
  "bg-(--series-7)",
  "bg-(--series-8)",
];
const sliceFill = (index: number) => SLICE_FILL[index] ?? "fill-(--series-rest)";
const sliceBg = (index: number) => SLICE_BG[index] ?? "bg-(--series-rest)";

const PIE = { size: 168, outer: 80, inner: 52 };

function arc(start: number, end: number): string {
  const c = PIE.size / 2;
  const at = (turn: number, r: number) => {
    const a = turn * 2 * Math.PI - Math.PI / 2;
    return `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  };
  const large = end - start > 0.5 ? 1 : 0;
  return [
    `M ${at(start, PIE.outer)}`,
    `A ${PIE.outer} ${PIE.outer} 0 ${large} 1 ${at(end, PIE.outer)}`,
    `L ${at(end, PIE.inner)}`,
    `A ${PIE.inner} ${PIE.inner} 0 ${large} 0 ${at(start, PIE.inner)}`,
    "Z",
  ].join(" ");
}

/** A small switch between a few options, like Expense / Income in the "+". */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-background p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs whitespace-nowrap ${
            value === o.value ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const sliceKey = (c: CategoryMonthView) => c.categoryId ?? "none";

/**
 * Where the month's pesos went, or where they came from (Q3–Q5): a donut with
 * one slice per Category, the most money first, and the list beside it.
 * Tapping either opens its movements.
 */
function WhereItWent({
  byCategory,
  incomeByCategory,
  today,
}: {
  byCategory: CategoryMonthView[];
  incomeByCategory: CategoryMonthView[];
  today: IsoDate;
}) {
  const [side, setSide] = useState<"expense" | "income">("expense");
  const [open, setOpen] = useState<string | null>(null);
  const pesos = (side === "expense" ? byCategory : incomeByCategory).filter((c) => c.currency === "COP");
  const total = pesos.reduce((sum, c) => sum + c.total, 0);
  const slices = pieSlices(pesos.map((c) => c.total));
  const chosen = pesos.find((c) => sliceKey(c) === open);
  const toggle = (c: CategoryMonthView) => setOpen(open === sliceKey(c) ? null : sliceKey(c));

  return (
    <Section
      title={side === "expense" ? "Where it went" : "Where it came from"}
      aside={
        <Segmented
          label="Show"
          value={side}
          options={[
            { value: "expense", label: "Expenses" },
            { value: "income", label: "Income" },
          ]}
          onChange={(s) => {
            setSide(s);
            setOpen(null);
          }}
        />
      }
    >
      {pesos.length === 0 ? (
        <p className="text-sm text-muted">{side === "expense" ? "No Expenses this month." : "No Income this month."}</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <svg
            viewBox={`0 0 ${PIE.size} ${PIE.size}`}
            className="size-44 shrink-0"
            role="img"
            aria-label={`${side === "expense" ? "Expenses" : "Income"} by Category, ${formatAmount(total, "COP")} in all`}
          >
            {pesos.length === 1 ? (
              <circle
                cx={PIE.size / 2}
                cy={PIE.size / 2}
                r={(PIE.outer + PIE.inner) / 2}
                fill="none"
                strokeWidth={PIE.outer - PIE.inner}
                className={`cursor-pointer ${pesos[0].categoryId ? "stroke-(--series-1)" : "stroke-(--series-rest)"}`}
                onClick={() => toggle(pesos[0])}
              >
                <title>{`${pesos[0].name}: ${formatAmount(pesos[0].total, "COP")}`}</title>
              </circle>
            ) : (
              pesos.map((c, i) => (
                <path
                  key={sliceKey(c)}
                  d={arc(slices[i].start, slices[i].end)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={chosen && sliceKey(chosen) !== sliceKey(c) ? 0.3 : 1}
                  className={`cursor-pointer stroke-surface transition-opacity ${sliceFill(c.categoryId ? i : -1)}`}
                  onClick={() => toggle(c)}
                >
                  <title>{`${c.name}: ${formatAmount(c.total, "COP")} · ${shareLabel(c.total / total)}`}</title>
                </path>
              ))
            )}
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              className="fill-muted text-[10px] font-medium tracking-wide uppercase"
            >
              {chosen ? chosen.name.slice(0, 14) : side === "expense" ? "Spent" : "Came in"}
            </text>
            <text x="50%" y="58%" textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
              {formatAmount(chosen ? chosen.total : total, "COP")}
            </text>
          </svg>

          <ul className="flex w-full min-w-0 flex-1 flex-col gap-0.5">
            {pesos.map((c, i) => {
              const expanded = open === sliceKey(c);
              return (
                <li key={sliceKey(c)}>
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    aria-expanded={expanded}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-background ${
                      expanded ? "bg-background" : ""
                    }`}
                  >
                    <span className={`size-3 shrink-0 rounded-sm ${sliceBg(c.categoryId ? i : -1)}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">{shareLabel(c.total / total)}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatAmount(c.total, "COP")}
                      <span className="ml-2 text-xs text-muted">×{c.expenses.length}</span>
                    </span>
                  </button>
                  {expanded && (
                    <ul className="mt-1 mb-2 ml-2 flex flex-col border-l border-line pl-2">
                      {c.expenses.map((m) => (
                        <MovementRow key={m.id} movement={m} today={today} hideCategory />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
}

function describe(m: MovementView, hideCategory = false): string {
  if (m.kind === "expense") return hideCategory ? m.accountName : `${m.categoryName ?? "?"} · ${m.accountName}`;
  if (m.kind === "income") return hideCategory ? m.accountName : `${m.categoryName ?? "Income"} · ${m.accountName}`;
  return `${m.accountName} → ${m.toAccountName ?? "?"}`;
}

function MovementRow({ movement: m, today, hideCategory }: { movement: MovementView; today: IsoDate; hideCategory?: boolean }) {
  const sign = m.kind === "income" ? "+" : m.kind === "expense" ? "−" : "";
  const crossed = m.kind === "transfer" && m.toCurrency && m.toCurrency !== m.currency && m.toAmount !== null;
  return (
    <li>
      <EditMovement
        movement={m}
        className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-background"
      >
        <span className="w-20 shrink-0 text-xs text-muted">{shortDate(m.date, today)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate">
              {describe(m, hideCategory)}
              {m.campaigns.length > 0 && (
                <span className="text-xs text-muted"> · {m.campaigns.map((c) => c.title).join(", ")}</span>
              )}
            </span>
            {m.receipts.length > 0 && (
              <span
                className="flex shrink-0 items-center gap-0.5 text-xs text-muted"
                title={`${m.receipts.length} ${m.receipts.length === 1 ? "Receipt" : "Receipts"}`}
              >
                <ClipIcon className="size-3.5" />
                {m.receipts.length > 1 && m.receipts.length}
              </span>
            )}
          </span>
          {m.note && <span className="block truncate text-xs text-muted">{m.note}</span>}
        </span>
        <span className={`shrink-0 tabular-nums ${m.kind === "income" ? "text-green-700 dark:text-green-500" : ""}`}>
          {sign}
          {formatAmount(m.amount, m.currency)}
          {crossed && <span className="block text-right text-xs text-muted">→ {formatAmount(m.toAmount!, m.toCurrency!)}</span>}
        </span>
      </EditMovement>
    </li>
  );
}

type Line = { type: "movement"; item: MovementView } | { type: "adjustment"; item: AdjustmentView };

function Movements({
  movements,
  adjustments,
  today,
}: {
  movements: MovementView[];
  adjustments: AdjustmentView[];
  today: IsoDate;
}) {
  const [all, setAll] = useState(false);
  // Both lists come newest first; a stable sort by date keeps that within a day.
  const lines: Line[] = [
    ...movements.map((item) => ({ type: "movement" as const, item })),
    ...adjustments.map((item) => ({ type: "adjustment" as const, item })),
  ].sort((a, b) => b.item.date.localeCompare(a.item.date));
  const shown = all ? lines : lines.slice(0, 15);
  return (
    <Section title="Movements">
      {lines.length === 0 && <p className="text-sm text-muted">Nothing moved this month.</p>}
      <ul className="flex flex-col">
        {shown.map((line) =>
          line.type === "movement" ? (
            <MovementRow key={line.item.id} movement={line.item} today={today} />
          ) : (
            <AdjustmentRow key={line.item.id} adjustment={line.item} today={today} />
          ),
        )}
      </ul>
      {lines.length > shown.length && (
        <button type="button" className="btn self-start" onClick={() => setAll(true)}>
          Show all {lines.length}
        </button>
      )}
    </Section>
  );
}

/** An Adjustment isn't edited: a wrong one is deleted and the Account adjusted again. */
function AdjustmentRow({ adjustment: a, today }: { adjustment: AdjustmentView; today: IsoDate }) {
  return (
    <li className="flex items-baseline gap-2 px-2 py-1.5 text-sm">
      <span className="w-20 shrink-0 text-xs text-muted">{shortDate(a.date, today)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">Adjustment · {a.accountName}</span>
        {a.note && <span className="block truncate text-xs text-muted">{a.note}</span>}
      </span>
      <span className="shrink-0 text-muted tabular-nums">
        {a.delta > 0 ? "+" : ""}
        {formatAmount(a.delta, a.currency)}
      </span>
      <ConfirmDelete action={deleteAdjustment} id={a.id} what="Adjustment" title={formatAmount(a.delta, a.currency)} />
    </li>
  );
}

// ─── Recurrings ──────────────────────────────────────────────────────────────

function flowSign(kind: MovementView["kind"]): string {
  return kind === "income" ? "+" : kind === "expense" ? "−" : "";
}

function flowLine(f: Pick<RecurringView, "kind" | "accountName" | "toAccountName" | "categoryName">): string {
  if (f.kind === "expense") return `${f.categoryName ?? "?"} · ${f.accountName}`;
  if (f.kind === "income") return `${f.categoryName ?? "Income"} · ${f.accountName}`;
  return `${f.accountName} → ${f.toAccountName ?? "?"}`;
}

const KIND_PLURAL: Record<MovementView["kind"], string> = {
  expense: "Expenses",
  income: "Income",
  transfer: "Transfers",
};

/**
 * The Recurrings tab (Q2): what is coming this month and what was confirmed or
 * skipped, then every Recurring to change or stop, one kind at a time. What is
 * pending asks above the tabs.
 */
function Recurrings({
  occurrences,
  recurrings,
  today,
}: {
  occurrences: OccurrenceView[];
  recurrings: RecurringView[];
  today: IsoDate;
}) {
  const [kind, setKind] = useState<MovementView["kind"]>("expense");
  const ofKind = recurrings.filter((r) => r.kind === kind);
  const settled = occurrences.filter((o) => o.state !== "pending" && o.recurring.kind === kind);
  const waiting = occurrences.filter((o) => o.state === "pending" && o.recurring.kind === kind).length;
  const word = KIND_PLURAL[kind].toLowerCase();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Kind"
          value={kind}
          options={(["expense", "income", "transfer"] as const).map((k) => {
            const n = recurrings.filter((r) => r.kind === k).length;
            return {
              value: k,
              label: (
                <>
                  {KIND_PLURAL[k]}
                  {n > 0 && <span className="text-muted tabular-nums">{n}</span>}
                </>
              ),
            };
          })}
          onChange={setKind}
        />
        <RecurringButton kind={kind} className="btn">
          + Recurring
        </RecurringButton>
      </div>

      {recurrings.length === 0 ? (
        <Section title="Recurrings">
          <p className="text-sm text-muted">
            Your pay, the transfer to savings, your Bills: add each once. On its day it asks; you confirm or skip.
          </p>
        </Section>
      ) : (
        <>
          <Section title="This month">
            {settled.length === 0 && (
              <p className="text-sm text-muted">
                {waiting > 0 ? "Only what is waiting above, to confirm." : `No ${word} due this month.`}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {settled.map((o) => (
                <OccurrenceRow key={`${o.recurring.id}:${o.month}`} occurrence={o} today={today} />
              ))}
            </ul>
          </Section>
          <Section title={`All Recurrings · ${ofKind.length}`}>
            {ofKind.length === 0 && <p className="text-sm text-muted">No recurring {word} yet.</p>}
            <ul className="flex flex-col">
              {ofKind.map((r) => (
                <li key={r.id}>
                  <RecurringButton
                    recurring={r}
                    className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-background"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {r.schedule} · {flowLine(r)}
                        {r.campaigns.length > 0 && ` · ${r.campaigns.map((c) => c.title).join(", ")}`}
                        {r.next && ` · next ${shortDate(r.next.due, today)}`}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {flowSign(r.kind)}
                      {formatAmount(r.amount, r.currency)}
                    </span>
                  </RecurringButton>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}

function OccurrenceRow({ occurrence: o, today }: { occurrence: OccurrenceView; today: IsoDate }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const r = o.recurring;
  const open = o.state === "pending" || o.state === "upcoming";
  const overdue = o.state === "pending" && o.due < today;
  const amount = o.movement ?? r;

  return (
    <li className={`flex flex-col gap-1 rounded-md px-2 py-1.5 ${o.state === "pending" ? "bg-accent/5" : ""}`}>
      <div className={`flex items-baseline gap-2 text-sm ${open ? "" : "text-muted"}`}>
        <span className={`w-20 shrink-0 text-xs ${overdue ? "font-medium text-red-600" : "text-muted"}`}>
          {shortDate(o.due, today)}
          {overdue && <span className="block">overdue</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${o.state === "skipped" ? "line-through" : ""}`}>{r.name}</span>
          <span className="block truncate text-xs text-muted">{flowLine(r)}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {flowSign(r.kind)}
          {formatAmount(amount.amount, amount.currency)}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {open && (
          <>
            <button
              type="button"
              className={o.state === "pending" ? "btn-primary min-h-8" : "btn min-h-8"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await confirmOccurrence({ recurringId: r.id, month: o.month });
                  setError(result?.error ?? null);
                })
              }
            >
              {pending ? "…" : "Confirm"}
            </button>
            <ConfirmWithChanges occurrence={o} className="btn min-h-8">
              Change…
            </ConfirmWithChanges>
            <button
              type="button"
              className="btn min-h-8 text-muted"
              disabled={pending}
              onClick={() => startTransition(() => skipOccurrence({ recurringId: r.id, month: o.month }))}
              title="Not this month"
            >
              Skip
            </button>
          </>
        )}
        {o.state === "confirmed" && o.movement && (
          <EditMovement movement={o.movement} className="text-xs text-muted hover:underline">
            ✓ Confirmed
          </EditMovement>
        )}
        {o.state === "skipped" && (
          <>
            <span className="text-xs text-muted">Skipped</span>
            <button
              type="button"
              className="text-xs text-muted underline hover:text-foreground"
              disabled={pending}
              onClick={() => startTransition(() => unskipOccurrence({ recurringId: r.id, month: o.month }))}
            >
              Undo
            </button>
          </>
        )}
      </div>
      {error && <p className="text-right text-xs text-red-600">{error}</p>}
    </li>
  );
}

// ─── Accounts ────────────────────────────────────────────────────────────────

function Accounts({ accounts }: { accounts: AccountView[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <Section
      title="Accounts"
      aside={
        !adding && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Account
          </button>
        )
      }
    >
      {adding && <AccountForm onDone={() => setAdding(false)} />}
      <ul className="flex flex-col gap-1">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} />
        ))}
      </ul>
      <p className="text-xs text-muted">Balances today, from each opening balance and every movement since.</p>
    </Section>
  );
}

function AccountRow({ account: a }: { account: AccountView }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="flex flex-col gap-2">
        <AccountForm account={a} onDone={() => setEditing(false)} />
        <AdjustForm account={a} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 text-sm">
      <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setEditing(true)}>
        {a.name}
      </button>
      {a.savings && <span className="rounded-full border border-line px-1.5 text-[11px] text-muted">Savings</span>}
      {a.currency !== "COP" && <span className="text-[11px] text-muted">{a.currency}</span>}
      <span className="flex flex-col items-end">
        <span className={`tabular-nums ${a.balance < 0 ? "text-red-600" : ""}`}>{formatAmount(a.balance, a.currency)}</span>
        {a.monthAdjusted !== null && (
          <span className="text-[11px] text-muted tabular-nums" title="What this month's Adjustments added up to">
            adjusted {a.monthAdjusted > 0 ? "+" : ""}
            {formatAmount(a.monthAdjusted, a.currency)}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Creating an Account, or changing one. Its currency is chosen once, at birth (Q8).
 * Without `onDone` (the very first Account) there is nothing to cancel back to.
 */
function AccountForm({ account, onDone }: { account?: AccountView; onDone?: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? "COP");
  const [savings, setSavings] = useState(account?.savings ?? false);
  const [opening, setOpening] = useState(account ? amountInput(account.openingBalance, account.currency) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const openingUnits = parseBalance(opening, currency);

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (openingUnits === null) return setError("The opening balance isn't a number.");
        startTransition(async () => {
          const result = account
            ? await updateAccount({ id: account.id, name, savings, openingBalance: openingUnits })
            : await createAccount({ name, currency, savings, openingBalance: openingUnits });
          if (result) return setError(result.error);
          onDone?.();
        });
      }}
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_MONEY_NAME}
          required
          autoFocus
          placeholder="Name, e.g. Nequi"
          className="input"
          aria-label="Account name"
        />
        {account ? (
          <span className="flex items-center text-xs text-muted">{account.currency}</span>
        ) : (
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            className="input w-24"
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="label">Opening balance</span>
        <input
          value={opening}
          onChange={(event) => setOpening(amountTyping(event.target.value, { balance: true }))}
          inputMode={currency === "COP" ? "numeric" : "decimal"}
          placeholder="What it holds when you start"
          className="input tabular-nums"
        />
        <span className="h-4 text-xs text-muted tabular-nums">
          {openingUnits !== null && opening.trim() !== "" ? formatAmount(openingUnits, currency) : ""}
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={savings} onChange={(event) => setSavings(event.target.checked)} />
        Savings Account: what goes in counts as saved
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        {account && !account.inUse && (
          <ConfirmDelete action={deleteAccount} id={account.id} what="Account" title={account.name} className="btn text-red-600">
            Delete
          </ConfirmDelete>
        )}
        {account?.inUse && <span className="text-xs text-muted">It has history, so it stays.</span>}
        <div className="flex-1" />
        {onDone && (
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
        )}
        <button className="btn-primary" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : account ? "Save" : "Create"}
        </button>
      </div>
    </form>
  );
}

/**
 * Setting an Account to what it really holds (Q11): ZuluTrade moved with the
 * market, or the cash count came up short. The difference is an Adjustment.
 */
function AdjustForm({ account, onDone }: { account: AccountView; onDone: () => void }) {
  const [real, setReal] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const realUnits = real.trim() === "" ? null : parseBalance(real, account.currency);
  const delta = realUnits === null ? null : realUnits - account.balance;

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (realUnits === null) return setError("Type what it really holds.");
        startTransition(async () => {
          const result = await adjustAccount({ accountId: account.id, realBalance: realUnits, note });
          if (result) return setError(result.error);
          onDone();
        });
      }}
    >
      <span className="label">Adjust to the real balance</span>
      <p className="text-xs text-muted">
        Ivan OS says {formatAmount(account.balance, account.currency)}. The difference is kept as an Adjustment, never as
        an Expense or an Income.
      </p>
      <div className="flex gap-2">
        <input
          value={real}
          onChange={(event) => setReal(amountTyping(event.target.value, { balance: true }))}
          inputMode={account.currency === "COP" ? "numeric" : "decimal"}
          placeholder="What it really holds"
          className="input tabular-nums"
          aria-label="Real balance"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          className="input"
          aria-label="Adjustment note"
        />
      </div>
      <span className="h-4 text-xs text-muted tabular-nums">
        {delta !== null && delta !== 0 && `Difference: ${delta > 0 ? "+" : ""}${formatAmount(delta, account.currency)}`}
        {delta === 0 && "It already matches."}
      </span>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn self-end" disabled={pending || delta === null || delta === 0}>
        {pending ? "Adjusting…" : "Adjust"}
      </button>
    </form>
  );
}

// ─── Categories ──────────────────────────────────────────────────────────────

/** Expenses and Incomes each have their own Categories (Ronda 61); a merge stays within one kind. */
function Categories({ kind, categories }: { kind: CategoryKind; categories: CategoryView[] }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Section title={kind === "expense" ? "Expense Categories" : "Income Categories"}>
      {categories.length === 0 && (
        <p className="text-sm text-muted">
          {kind === "expense"
            ? "None yet. Create them here or from the +."
            : "None yet, e.g. Salary, Freelance, Sale. Create them here or from the +."}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} others={categories.filter((o) => o.id !== c.id)} />
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          startTransition(async () => {
            await createCategory({ name, kind });
            setName("");
          });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_MONEY_NAME}
          placeholder={kind === "expense" ? "New Expense Category" : "New Income Category"}
          className="input"
          aria-label={kind === "expense" ? "New Expense Category" : "New Income Category"}
        />
        <button className="btn" disabled={pending || !name.trim()}>
          Add
        </button>
      </form>
    </Section>
  );
}

/** Rename it any time; one with Expenses merges into another instead of being deleted (Q7). */
/** "3 Expenses · 1 Bill", or "2 Incomes · 1 Recurring". */
function uses(c: CategoryView, joiner = " · "): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const moved = plural(c.expenses, c.kind === "expense" ? "Expense" : "Income");
  const repeats = c.recurrings > 0 ? plural(c.recurrings, c.kind === "expense" ? "Bill" : "Recurring") : null;
  return repeats ? `${moved}${joiner}${repeats}` : moved;
}

function CategoryRow({ category: c, others }: { category: CategoryView; others: CategoryView[] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [into, setInto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <li className="flex items-center gap-2 text-sm">
        <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setEditing(true)}>
          {c.name}
        </button>
        <span className="text-xs text-muted tabular-nums">{uses(c)}</span>
      </li>
    );
  }

  const target = others.find((o) => o.id === into);
  return (
    <li className="flex flex-col gap-2 rounded-md border border-line p-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await renameCategory({ id: c.id, name });
            if (result) return setError(result.error);
            setEditing(false);
          });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_MONEY_NAME}
          required
          autoFocus
          className="input"
          aria-label="Category name"
        />
        <button className="btn" disabled={pending || !name.trim() || name.trim() === c.name}>
          Rename
        </button>
      </form>
      {others.length > 0 && (
        <div className="flex gap-2">
          <select value={into} onChange={(event) => setInto(event.target.value)} className="input" aria-label="Merge into">
            <option value="">Merge into…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn shrink-0"
            disabled={pending || !target}
            onClick={() =>
              startTransition(async () => {
                await mergeCategory({ id: c.id, intoId: into });
              })
            }
          >
            {target ? `Merge into ${target.name}` : "Merge"}
          </button>
        </div>
      )}
      {target && (
        <p className="text-xs text-muted">
          Its {uses(c, " and ")} move to {target.name} and “{c.name}” disappears.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        {c.expenses === 0 && c.recurrings === 0 && (
          <ConfirmDelete action={deleteCategory} id={c.id} what="Category" title={c.name} className="btn text-red-600">
            Delete
          </ConfirmDelete>
        )}
        <div className="flex-1" />
        <button
          type="button"
          className="btn"
          onClick={() => {
            setEditing(false);
            setName(c.name);
            setInto("");
            setError(null);
          }}
        >
          Close
        </button>
      </div>
    </li>
  );
}

/** A link to another month that keeps the tab Ivan is on. */
export function MonthLink({ month, children, ...props }: { month: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  const tab = useSearchParams().get("tab");
  const href = `/os/money/${month}${tab && tab !== "movements" ? `?tab=${tab}` : ""}`;
  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
}

/**
 * A Campaign's money (Q11): every Expense and Income that served it, from all
 * months, and what it cost and brought in, in pesos. A record, not a budget;
 * nothing shows until something serves it.
 */
export function CampaignMoney({ campaignId }: { campaignId: string }) {
  const [found, setFound] = useState<(CampaignMoneyView & { today: string }) | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    loadCampaignMoney({ campaignId })
      .then((v) => live && setFound(v))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [campaignId]);

  if (!found || found.movements.length === 0) return null;
  const shown = all ? found.movements : found.movements.slice(0, 10);
  return (
    <div className="flex flex-col gap-2">
      <div className="label">Money</div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Spent" value={formatAmount(found.spent, "COP")} />
        <Stat label="Came in" value={formatAmount(found.cameIn, "COP")} />
      </div>
      <ul className="flex flex-col">
        {shown.map((m) => (
          <li key={m.id}>
            <Link
              href={`/os/money/${m.date.slice(0, 7)}`}
              className="flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background"
            >
              <span className="w-24 shrink-0 text-xs text-muted">{shortDate(m.date, found.today)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{describe(m)}</span>
                {m.note && <span className="block truncate text-xs text-muted">{m.note}</span>}
              </span>
              <span className={`shrink-0 tabular-nums ${m.kind === "income" ? "text-green-700 dark:text-green-500" : ""}`}>
                {flowSign(m.kind)}
                {formatAmount(m.amount, m.currency)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {found.movements.length > shown.length && (
        <button type="button" className="btn self-start" onClick={() => setAll(true)}>
          Show all {found.movements.length}
        </button>
      )}
    </div>
  );
}
