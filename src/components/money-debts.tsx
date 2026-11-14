"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { IsoDate } from "@/domain/dates";
import { MAX_DEBT_WHO, openingKind, paymentKind, paymentProblem, debtTotals, type DebtSide } from "@/domain/debts";
import { amountInput, amountTyping, formatAmount, MAX_MONEY_NAME, MAX_MOVEMENT_NOTE, parseAmount } from "@/domain/money";
import {
  closeDebt,
  createCategory,
  deleteDebt,
  deleteDebtPayment,
  loadMoneyChoices,
  payDebt,
  reopenDebt,
  saveDebt,
} from "@/server/money-actions";
import type { DebtView, MoneyChoices } from "@/server/money";
import { ConfirmDelete, keepEvents } from "./confirm-delete";
import { Segmented } from "./segmented";
import { shortDate } from "./upkeeps";
import { useRemembered } from "./use-remembered";

const SIDE_LABEL: Record<DebtSide, string> = { owe: "I owe", owed: "Owed to me" };

/**
 * The Debts tab (Ronda 62): what I owe and what I'm owed, one side at a time,
 * with what is still owed each way on top. Paid and closed ones fold below.
 */
export function Debts({ debts, today }: { debts: DebtView[]; today: IsoDate }) {
  const [side, setSide] = useState<DebtSide>("owe");
  const totals = debtTotals(debts);
  const mine = debts.filter((d) => d.side === side);
  const open = mine.filter((d) => d.state === "open");
  const finished = mine.filter((d) => d.state !== "open");

  return (
    <>
      <section className="card grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="label">I owe</span>
          <span className="truncate text-lg font-semibold tabular-nums">{formatAmount(totals.owe, "COP")}</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="label">Owed to me</span>
          <span className="truncate text-lg font-semibold tabular-nums">{formatAmount(totals.owed, "COP")}</span>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Side"
          value={side}
          options={(["owe", "owed"] as const).map((s) => {
            const n = debts.filter((d) => d.side === s && d.state === "open").length;
            return {
              value: s,
              label: (
                <>
                  {SIDE_LABEL[s]}
                  {n > 0 && <span className="text-muted tabular-nums">{n}</span>}
                </>
              ),
            };
          })}
          onChange={setSide}
        />
        <DebtButton side={side} className="btn">
          + Debt
        </DebtButton>
      </div>

      <section className="card flex flex-col gap-3">
        {open.length === 0 && (
          <p className="text-sm text-muted">
            {side === "owe"
              ? "Nothing owed. Add what you have to pay once: a loan, the university's graduation fee…"
              : "Nobody owes you. Add money you lent or are waiting to collect."}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {open.map((d) => (
            <DebtRow key={d.id} debt={d} today={today} />
          ))}
        </ul>
      </section>

      {finished.length > 0 && (
        <details className="card">
          <summary className="label cursor-pointer">
            {side === "owe" ? "Paid and closed" : "Collected and closed"} · {finished.length}
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {finished.map((d) => (
              <DebtRow key={d.id} debt={d} today={today} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function DebtRow({ debt: d, today }: { debt: DebtView; today: IsoDate }) {
  const [showPayments, setShowPayments] = useState(false);
  const [pending, startTransition] = useTransition();
  const paid = d.amount - d.left;
  const overdue = d.state === "open" && d.dueDate !== null && d.dueDate < today;

  return (
    <li className={`flex flex-col gap-2 rounded-lg border border-line p-3 ${d.state === "open" ? "" : "opacity-75"}`}>
      <div className="flex items-baseline gap-2">
        <DebtButton debt={d} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-medium hover:underline">{d.who}</span>
          <span className="block truncate text-xs text-muted">
            {d.categoryName}
            {d.note && ` · ${d.note}`}
          </span>
        </DebtButton>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block font-semibold">{formatAmount(d.left, "COP")}</span>
          <span className="block text-xs text-muted">left of {formatAmount(d.amount, "COP")}</span>
        </span>
      </div>

      <span
        className="h-1.5 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-label={d.side === "owe" ? "Paid" : "Collected"}
        aria-valuemin={0}
        aria-valuemax={d.amount}
        aria-valuenow={paid}
      >
        <span className="block h-full rounded-full bg-accent" style={{ width: `${(paid / d.amount) * 100}%` }} />
      </span>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {d.dueDate && (
          <span className={overdue ? "font-medium text-red-600" : ""}>
            {overdue ? "Overdue · " : "Due "}
            {shortDate(d.dueDate, today)}
          </span>
        )}
        {d.reminder && !d.reminder.done && <span>Reminder {shortDate(d.reminder.day, today)}</span>}
        {d.state === "paid" && <span>✓ {d.side === "owe" ? "Paid" : "Collected"}</span>}
        {d.state === "closed" && <span>Closed with {formatAmount(d.left, "COP")} unpaid</span>}
        {d.payments.length > 0 && (
          <button type="button" className="underline hover:text-foreground" onClick={() => setShowPayments(!showPayments)}>
            {d.payments.length} {d.payments.length === 1 ? "payment" : "payments"}
          </button>
        )}
        <div className="flex-1" />
        {d.state === "open" && (
          <PayButton debt={d} className="btn-primary min-h-8">
            {d.side === "owe" ? "Pay" : "Collect"}
          </PayButton>
        )}
        {d.state === "closed" && (
          <button
            type="button"
            className="btn min-h-8"
            disabled={pending}
            onClick={() => startTransition(() => reopenDebt({ id: d.id }))}
          >
            Reopen
          </button>
        )}
      </div>

      {showPayments && (
        <ul className="flex flex-col border-l border-line pl-2">
          {d.payments.map((p) => (
            <li key={p.id} className="flex items-baseline gap-2 px-1 py-1 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted">{shortDate(p.date, today)}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.accountName ?? "No Account"}</span>
              <span className="shrink-0 tabular-nums">{formatAmount(p.amount, "COP")}</span>
              <ConfirmDelete
                action={async () => {
                  await deleteDebtPayment({ id: p.id });
                }}
                id={p.id}
                what="payment"
                title={formatAmount(p.amount, "COP")}
                buttonTitle={p.movementId ? "Undo it; its movement goes too" : "Undo it"}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

type Choices = MoneyChoices & { today: string };

/** The Accounts and Categories a Debt's dialogs pick from, loaded when one opens. */
function useChoices() {
  const [choices, setChoices] = useState<Choices | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadMoneyChoices()
      .then((found) => live && setChoices(found))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  return { choices, setChoices, failed };
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-9 rounded-full border px-3 text-sm ${
        selected ? "border-accent bg-accent/15 font-medium text-accent" : "border-line hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}

/** Category chips of one kind, with "+ New" to create one there. */
function CategoryPicker({
  legend,
  kind,
  value,
  onChange,
  choices,
  setChoices,
}: {
  legend: string;
  kind: "expense" | "income";
  value: string | null;
  onChange: (id: string) => void;
  choices: Choices;
  setChoices: (update: (c: Choices | null) => Choices | null) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const categories = choices.categories.filter((c) => c.kind === kind);

  async function add() {
    const name = adding?.trim();
    if (!name) return;
    const created = await createCategory({ name, kind });
    setChoices((c) => (c && !c.categories.some((x) => x.id === created.id) ? { ...c, categories: [...c.categories, created] } : c));
    onChange(created.id);
    setAdding(null);
  }

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="label mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <Chip key={c.id} selected={value === c.id} onClick={() => onChange(c.id)}>
            {c.name}
          </Chip>
        ))}
        {adding === null && (
          <Chip selected={false} onClick={() => setAdding("")}>
            + New
          </Chip>
        )}
      </div>
      {adding !== null && (
        <div className="mt-1 flex gap-2">
          <input
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void add();
              }
            }}
            maxLength={MAX_MONEY_NAME}
            placeholder={kind === "income" ? "New Income Category" : "New Expense Category"}
            className="input"
            aria-label={kind === "income" ? "New Income Category" : "New Expense Category"}
            autoFocus
          />
          <button type="button" className="btn" onClick={() => void add()} disabled={!adding.trim()}>
            Add
          </button>
        </div>
      )}
    </fieldset>
  );
}

/** Peso Accounts only: a Debt is in pesos (Q7). */
function AccountPicker({
  legend,
  value,
  onChange,
  choices,
}: {
  legend: string;
  value: string | null;
  onChange: (id: string) => void;
  choices: Choices;
}) {
  const accounts = choices.accounts.filter((a) => a.currency === "COP");
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="label mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {accounts.map((a) => (
          <Chip key={a.id} selected={value === a.id} onClick={() => onChange(a.id)}>
            {a.name}
          </Chip>
        ))}
        {accounts.length === 0 && <span className="text-sm text-muted">Create a peso Account first.</span>}
      </div>
    </fieldset>
  );
}

function Dialog({
  dialog,
  title,
  onClose,
  children,
}: {
  dialog: React.RefObject<HTMLDialogElement | null>;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [dialog]);
  return (
    <div className="contents" {...keepEvents}>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={onClose}
        onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        {children}
      </dialog>
    </div>
  );
}

/** Creates a Debt on `side`, or opens `debt` to change, close or delete it. */
function DebtButton({
  debt,
  side,
  children,
  className,
}: {
  debt?: DebtView;
  side?: DebtSide;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <DebtDialog debt={debt} side={debt?.side ?? side ?? "owe"} onClose={() => setOpen(false)} />}
    </>
  );
}

function DebtDialog({ debt, side, onClose }: { debt?: DebtView; side: DebtSide; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  const { choices, setChoices, failed } = useChoices();
  const [lastAccount, setLastAccount] = useRemembered("money:account");
  const [who, setWho] = useState(debt?.who ?? "");
  const [amount, setAmount] = useState(debt ? amountInput(debt.amount, "COP") : "");
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(debt?.categoryId ?? null);
  const [record, setRecord] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [recordDate, setRecordDate] = useState("");
  const [recordCategoryId, setRecordCategoryId] = useState<string | null>(null);
  const openReminder = debt?.reminder && !debt.reminder.done ? debt.reminder : null;
  const [remind, setRemind] = useState(!!openReminder);
  const [remindOn, setRemindOn] = useState(openReminder?.day ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const units = parseAmount(amount, "COP");
  const today = choices?.today ?? "";
  const pesoAccounts = choices?.accounts.filter((a) => a.currency === "COP") ?? [];
  const account =
    pesoAccounts.find((a) => a.id === accountId) ?? pesoAccounts.find((a) => a.id === lastAccount) ?? pesoAccounts[0];
  const title = debt ? `Edit ${debt.who}` : side === "owe" ? "New Debt · I owe" : "New Debt · Owed to me";

  function save() {
    setError(null);
    if (!who.trim()) return setError(side === "owe" ? "Say who you owe." : "Say who owes you.");
    if (units === null) return setError("Type an amount above 0.");
    if (!categoryId) return setError("Pick a Category.");
    const recording = !debt && record;
    if (recording && !account) return setError("Pick an Account.");
    if (recording && !recordCategoryId) return setError("Pick the Category of the money now.");
    if (remind && !remindOn) return setError("Pick the day of the reminder.");
    startTransition(async () => {
      const result = await saveDebt({
        id: debt?.id,
        side,
        who,
        amount: units,
        dueDate: dueDate || null,
        note,
        categoryId,
        record: recording ? { accountId: account!.id, date: recordDate || today, categoryId: recordCategoryId! } : null,
        remindOn: remind ? remindOn : null,
      });
      if (result) return setError(result.error);
      if (recording) setLastAccount(account!.id);
      close();
    });
  }

  return (
    <Dialog dialog={dialog} title={title} onClose={onClose}>
      <form
          className="flex flex-col gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h2 className="font-semibold">{title}</h2>

          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="label">{side === "owe" ? "To" : "From"}</span>
              <input
                value={who}
                onChange={(event) => setWho(event.target.value)}
                maxLength={MAX_DEBT_WHO}
                required
                autoFocus={!debt}
                placeholder={side === "owe" ? "e.g. Universidad" : "e.g. Carlos UIF"}
                className="input"
              />
            </label>
            <label className="flex w-36 flex-col gap-1">
              <span className="label">Amount</span>
              <input
                value={amount}
                onChange={(event) => setAmount(amountTyping(event.target.value))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                className="input tabular-nums"
                aria-label="Amount"
              />
              <span className="h-4 text-xs text-muted tabular-nums">{units !== null ? formatAmount(units, "COP") : ""}</span>
            </label>
          </div>

          {failed && <p className="text-sm text-red-600">Couldn&apos;t load your Accounts. Close and try again.</p>}
          {!choices && !failed && <p className="text-sm text-muted">Loading…</p>}

          {choices && (
            <CategoryPicker
              legend={side === "owe" ? "Category, when I pay it" : "Category, when I collect it"}
              kind={paymentKind(side)}
              value={categoryId}
              onChange={setCategoryId}
              choices={choices}
              setChoices={setChoices}
            />
          )}

          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="label">Note</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={MAX_MOVEMENT_NOTE}
                placeholder="Optional"
                className="input"
              />
            </label>
            <label className="flex w-36 flex-col gap-1">
              <span className="label">Due</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="input" />
            </label>
          </div>

          {!debt && choices && (
            <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={record} onChange={(event) => setRecord(event.target.checked)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Record the money now</span>
                  <span className="block text-xs text-muted">
                    {side === "owe"
                      ? "It was lent to me: it comes into an Account as Income. Leave it off for something like a fee."
                      : "I lent it: it leaves an Account as an Expense."}
                  </span>
                </span>
              </label>
              {record && (
                <>
                  <AccountPicker
                    legend={side === "owe" ? "Into" : "From"}
                    value={account?.id ?? null}
                    onChange={setAccountId}
                    choices={choices}
                  />
                  <CategoryPicker
                    legend={side === "owe" ? "Income Category, e.g. Loans" : "Expense Category, e.g. Loans"}
                    kind={openingKind(side)}
                    value={recordCategoryId}
                    onChange={setRecordCategoryId}
                    choices={choices}
                    setChoices={setChoices}
                  />
                  <label className="flex w-40 flex-col gap-1">
                    <span className="label">On</span>
                    <input
                      type="date"
                      value={recordDate || today}
                      onChange={(event) => setRecordDate(event.target.value)}
                      className="input"
                    />
                  </label>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={remind} onChange={(event) => setRemind(event.target.checked)} />
              Remind me on
            </label>
            {remind && (
              <input
                type="date"
                value={remindOn}
                min={today || undefined}
                onChange={(event) => setRemindOn(event.target.value)}
                className="input w-40"
                aria-label="Reminder day"
              />
            )}
            {remind && <span className="w-full text-xs text-muted">A Secondary Task on that day&apos;s Check-in.</span>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {debt && (
              <ConfirmDelete
                action={async (fd) => {
                  await deleteDebt(fd);
                  close();
                }}
                id={debt.id}
                what="Debt"
                title={debt.who}
                buttonTitle="Delete it; what it moved stays as movements"
                className="btn text-red-600"
              >
                Delete
              </ConfirmDelete>
            )}
            {debt?.state === "open" && (
              <button
                type="button"
                className="btn"
                title="Forgiven, or it won't be paid: what is left stays unpaid"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await closeDebt({ id: debt.id });
                    close();
                  })
                }
              >
                Close
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary min-h-9 px-4" disabled={pending || !choices}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
      </form>
    </Dialog>
  );
}

function PayButton({ debt, children, className }: { debt: DebtView; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <PayDialog debt={debt} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Pay or collect part or all of what is left (Q11). */
function PayDialog({ debt, onClose }: { debt: DebtView; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  const { choices, failed } = useChoices();
  const [lastAccount, setLastAccount] = useRemembered("money:account");
  const [amount, setAmount] = useState(amountInput(debt.left, "COP"));
  const [date, setDate] = useState("");
  const [moves, setMoves] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const units = parseAmount(amount, "COP");
  const pesoAccounts = choices?.accounts.filter((a) => a.currency === "COP") ?? [];
  const account =
    pesoAccounts.find((a) => a.id === accountId) ?? pesoAccounts.find((a) => a.id === lastAccount) ?? pesoAccounts[0];
  const owe = debt.side === "owe";
  const title = owe ? `Pay ${debt.who}` : `Collect from ${debt.who}`;

  function save() {
    setError(null);
    const problem = paymentProblem(units, debt.left);
    if (problem) return setError(problem);
    if (moves && !account) return setError("Pick an Account.");
    startTransition(async () => {
      const result = await payDebt({
        debtId: debt.id,
        amount: units!,
        date: date || choices!.today,
        accountId: moves ? account!.id : null,
      });
      if (result) return setError(result.error);
      if (moves) setLastAccount(account!.id);
      close();
    });
  }

  return (
    <Dialog dialog={dialog} title={title} onClose={onClose}>
      <form
          className="flex flex-col gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h2 className="font-semibold">{title}</h2>
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="label">Amount</span>
              <input
                value={amount}
                onChange={(event) => setAmount(amountTyping(event.target.value))}
                inputMode="numeric"
                autoComplete="off"
                className="input py-2 text-2xl font-semibold tabular-nums"
                aria-label="Amount"
                autoFocus
              />
              <span className="h-4 text-xs text-muted tabular-nums">
                {formatAmount(debt.left, "COP")} left
              </span>
            </label>
            <label className="flex w-36 flex-col gap-1">
              <span className="label">Date</span>
              <input
                type="date"
                value={date || choices?.today || ""}
                onChange={(event) => setDate(event.target.value)}
                className="input"
              />
            </label>
          </div>

          {failed && <p className="text-sm text-red-600">Couldn&apos;t load your Accounts. Close and try again.</p>}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={moves} onChange={(event) => setMoves(event.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">{owe ? "From an Account" : "Into an Account"}</span>
              <span className="block text-xs text-muted">
                {moves
                  ? `Recorded as ${owe ? "an Expense" : "an Income"} in ${debt.categoryName}.`
                  : "Only the Debt goes down; no Account changes."}
              </span>
            </span>
          </label>
          {moves && choices && (
            <AccountPicker legend={owe ? "From" : "Into"} value={account?.id ?? null} onChange={setAccountId} choices={choices} />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <div className="flex-1" />
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary min-h-9 px-4" disabled={pending || !choices}>
              {pending ? "Saving…" : owe ? "Pay" : "Collect"}
            </button>
          </div>
      </form>
    </Dialog>
  );
}
