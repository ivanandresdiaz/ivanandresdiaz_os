"use client";

import { useState, useTransition } from "react";
import type { IsoDate } from "@/domain/dates";
import {
  amountInput,
  amountTyping,
  CURRENCIES,
  formatAmount,
  MAX_MONEY_NAME,
  parseBalance,
  shareLabel,
  type Currency,
} from "@/domain/money";
import {
  adjustAccount,
  confirmOccurrence,
  createAccount,
  createCategory,
  deleteAccount,
  deleteAdjustment,
  deleteCategory,
  mergeCategory,
  renameCategory,
  skipOccurrence,
  unskipOccurrence,
  updateAccount,
} from "@/server/money-actions";
import type {
  AccountView,
  AdjustmentView,
  CategoryMonthView,
  CategoryView,
  MoneyMonthView,
  MovementView,
  OccurrenceView,
  RecurringView,
} from "@/server/money";
import { ConfirmDelete } from "./confirm-delete";
import { ConfirmWithChanges, EditMovement, RecurringButton } from "./money-add";
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
export function MoneyMonth({ view, today }: { view: MoneyMonthView; today: IsoDate }) {
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

      <Recurrings occurrences={view.occurrences} recurrings={view.recurrings} today={today} />
      <WhereItWent byCategory={view.byCategory} today={today} />
      <Movements movements={view.movements} adjustments={view.adjustments} today={today} />

      <div className="grid gap-4 md:grid-cols-2">
        <Accounts accounts={view.accounts} />
        <Categories categories={view.categories} />
      </div>
    </>
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

function WhereItWent({ byCategory, today }: { byCategory: CategoryMonthView[]; today: IsoDate }) {
  const [open, setOpen] = useState<string | null>(null);
  const top = new Map<Currency, number>();
  for (const c of byCategory) top.set(c.currency, Math.max(top.get(c.currency) ?? 0, c.total));

  return (
    <Section title="Where it went">
      {byCategory.length === 0 && <p className="text-sm text-muted">No Expenses this month.</p>}
      <ul className="flex flex-col gap-1">
        {byCategory.map((c) => {
          const key = `${c.currency}:${c.categoryId}`;
          const expanded = open === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : key)}
                aria-expanded={expanded}
                className="flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-background"
              >
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatAmount(c.total, c.currency)}
                    <span className="ml-2 text-xs text-muted">×{c.expenses.length}</span>
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, (c.total / (top.get(c.currency) || 1)) * 100)}%` }}
                  />
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
    </Section>
  );
}

function describe(m: MovementView, hideCategory = false): string {
  if (m.kind === "expense") return hideCategory ? m.accountName : `${m.categoryName ?? "?"} · ${m.accountName}`;
  if (m.kind === "income") return `Income · ${m.accountName}`;
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
          <span className="block truncate">{describe(m, hideCategory)}</span>
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
  if (f.kind === "income") return `Income · ${f.accountName}`;
  return `${f.accountName} → ${f.toAccountName ?? "?"}`;
}

/**
 * The Recurrings of the month (Q10, Q12): what is pending asks first, the
 * oldest first; then what is coming; then what was confirmed or skipped.
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
  const [showAll, setShowAll] = useState(false);
  const pending = occurrences.filter((o) => o.state === "pending").length;
  return (
    <Section
      title={pending > 0 ? `Recurring · ${pending} pending` : "Recurring"}
      aside={<RecurringButton className="btn">+ Recurring</RecurringButton>}
    >
      {recurrings.length === 0 && (
        <p className="text-sm text-muted">
          Your pay, the transfer to savings, your Bills: add each once. On its day it asks; you confirm or skip.
        </p>
      )}
      {recurrings.length > 0 && occurrences.length === 0 && (
        <p className="text-sm text-muted">Nothing due this month.</p>
      )}
      <ul className="flex flex-col gap-1">
        {occurrences.map((o) => (
          <OccurrenceRow key={`${o.recurring.id}:${o.month}`} occurrence={o} today={today} />
        ))}
      </ul>
      {recurrings.length > 0 && (
        <div className="flex flex-col gap-1">
          <button type="button" className="self-start text-xs text-muted hover:underline" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Hide" : "All"} Recurrings ({recurrings.length})
          </button>
          {showAll && (
            <ul className="flex flex-col">
              {recurrings.map((r) => (
                <li key={r.id}>
                  <RecurringButton
                    recurring={r}
                    className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-background"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {r.schedule} · {flowLine(r)}
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
          )}
        </div>
      )}
    </Section>
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

function Categories({ categories }: { categories: CategoryView[] }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Section title="Categories">
      {categories.length === 0 && <p className="text-sm text-muted">None yet. Create them here or from the +.</p>}
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
            await createCategory({ name });
            setName("");
          });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_MONEY_NAME}
          placeholder="New Category"
          className="input"
          aria-label="New Category"
        />
        <button className="btn" disabled={pending || !name.trim()}>
          Add
        </button>
      </form>
    </Section>
  );
}

/** Rename it any time; one with Expenses merges into another instead of being deleted (Q7). */
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
        <span className="text-xs text-muted tabular-nums">
          {c.expenses} Expense{c.expenses === 1 ? "" : "s"}
          {c.recurrings > 0 && ` · ${c.recurrings} Bill${c.recurrings === 1 ? "" : "s"}`}
        </span>
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
          Its {c.expenses} Expense{c.expenses === 1 ? "" : "s"}
          {c.recurrings > 0 && ` and ${c.recurrings} Bill${c.recurrings === 1 ? "" : "s"}`} move to {target.name} and “
          {c.name}” disappears.
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
