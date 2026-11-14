"use client";

import { useState, useTransition } from "react";
import type { IsoDate } from "@/domain/dates";
import {
  amountInput,
  CURRENCIES,
  formatAmount,
  MAX_MONEY_NAME,
  parseBalance,
  shareLabel,
  type Currency,
} from "@/domain/money";
import {
  createAccount,
  createCategory,
  deleteAccount,
  deleteCategory,
  mergeCategory,
  renameCategory,
  updateAccount,
} from "@/server/money-actions";
import type { AccountView, CategoryMonthView, CategoryView, MoneyMonthView, MovementView } from "@/server/money";
import { ConfirmDelete } from "./confirm-delete";
import { EditMovement } from "./money-add";
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

      <WhereItWent byCategory={view.byCategory} today={today} />
      <Movements movements={view.movements} today={today} />

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

function Movements({ movements, today }: { movements: MovementView[]; today: IsoDate }) {
  const [all, setAll] = useState(false);
  const shown = all ? movements : movements.slice(0, 15);
  return (
    <Section title="Movements">
      {movements.length === 0 && <p className="text-sm text-muted">Nothing moved this month.</p>}
      <ul className="flex flex-col">
        {shown.map((m) => (
          <MovementRow key={m.id} movement={m} today={today} />
        ))}
      </ul>
      {movements.length > shown.length && (
        <button type="button" className="btn self-start" onClick={() => setAll(true)}>
          Show all {movements.length}
        </button>
      )}
    </Section>
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
      <li>
        <AccountForm account={a} onDone={() => setEditing(false)} />
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
      <span className={`tabular-nums ${a.balance < 0 ? "text-red-600" : ""}`}>{formatAmount(a.balance, a.currency)}</span>
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
          onChange={(event) => setOpening(event.target.value)}
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
        {account && account.movements === 0 && (
          <ConfirmDelete action={deleteAccount} id={account.id} what="Account" title={account.name} className="btn text-red-600">
            Delete
          </ConfirmDelete>
        )}
        {account && account.movements > 0 && (
          <span className="text-xs text-muted">It has movements, so it stays.</span>
        )}
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
          Its {c.expenses} Expense{c.expenses === 1 ? "" : "s"} move to {target.name} and “{c.name}” disappears.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        {c.expenses === 0 && (
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
