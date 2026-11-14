"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  amountInput,
  amountTyping,
  formatAmount,
  MAX_MONEY_NAME,
  MAX_MOVEMENT_NOTE,
  parseAmount,
  type Currency,
  type MovementKind,
} from "@/domain/money";
import { isValidEvery, MAX_EVERY_MONTHS } from "@/domain/recurring";
import {
  createCategory,
  deleteMovement,
  deleteRecurring,
  loadMoneyChoices,
  saveMovement,
  saveRecurring,
} from "@/server/money-actions";
import type { MoneyChoices, MovementView, OccurrenceView, ReceiptView, RecurringView } from "@/server/money";
import { ConfirmDelete, keepEvents } from "./confirm-delete";
import { ReceiptsField, useReceipts } from "./money-receipts";
import { useRemembered } from "./use-remembered";

const KIND_LABEL: Record<MovementKind, string> = { expense: "Expense", income: "Income", transfer: "Transfer" };

/** On a phone, the "+" floats above the bottom bar on every screen, a thumb away at the register (Q4). */
export function MoneyFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add Expense"
        title="Add Expense"
        className="fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 flex size-12 items-center justify-center rounded-full bg-accent text-2xl leading-none text-white shadow-lg hover:opacity-90 md:hidden dark:text-stone-950"
      >
        +
      </button>
      {open && <MovementDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** The same "+" as a plain button, for the Money page on any screen. */
export function AddMovementButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Add
      </button>
      {open && <MovementDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** A button that opens the dialog for `target`, starting from `draft`. */
function Opener({
  target,
  draft,
  children,
  className,
  title,
}: {
  target: Target;
  draft?: Draft;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} title={title}>
        {children}
      </button>
      {open && <MovementDialog target={target} initial={draft} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Opens a movement of the month to change or delete it. */
export function EditMovement({ movement, children, className }: { movement: MovementView; children: React.ReactNode; className?: string }) {
  return (
    <Opener target={{ type: "movement", id: movement.id }} draft={movement} className={className} title="Edit">
      {children}
    </Opener>
  );
}

/** Confirms an occurrence with what really happened: another amount, Account or day. */
export function ConfirmWithChanges({ occurrence, children, className }: { occurrence: OccurrenceView; children: React.ReactNode; className?: string }) {
  const r = occurrence.recurring;
  return (
    <Opener
      target={{ type: "occurrence", recurringId: r.id, month: occurrence.month, name: r.name }}
      draft={{ ...r, note: r.name, date: occurrence.due }}
      className={className}
      title="Confirm with changes"
    >
      {children}
    </Opener>
  );
}

/** Creates a Recurring, or opens one to change or stop it. */
export function RecurringButton({ recurring, children, className }: { recurring?: RecurringView; children: React.ReactNode; className?: string }) {
  return (
    <Opener
      target={{ type: "recurring", id: recurring?.id, name: recurring?.name }}
      draft={recurring && { ...recurring, note: recurring.name, date: recurring.firstDate }}
      className={className}
    >
      {children}
    </Opener>
  );
}

/**
 * What the dialog saves: a movement (new, or changed when it has an id), an
 * occurrence of a Recurring confirmed with changes, or a Recurring itself.
 */
type Target =
  | { type: "movement"; id?: string }
  | { type: "occurrence"; recurringId: string; month: string; name: string }
  | { type: "recurring"; id?: string; name?: string };

/** What the fields start with. For a Recurring, the note is its name and the date its first one. */
type Draft = {
  kind: MovementKind;
  amount: number;
  currency: Currency;
  accountId: string;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: Currency | null;
  categoryId: string | null;
  note: string | null;
  date: string;
  everyMonths?: number;
  receipts?: ReceiptView[];
};

type Choices = MoneyChoices & { today: string };

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

/**
 * Adding (or changing) an Expense, an Income or a Transfer. Amount first, then
 * the Category, both one tap away; the Account is the last one used (Q3). The
 * same form confirms a Recurring with changes, and creates or edits one.
 */
function MovementDialog({
  target = { type: "movement" },
  initial,
  onClose,
}: {
  target?: Target;
  initial?: Draft;
  onClose: () => void;
}) {
  const isRule = target.type === "recurring";
  const dialog = useRef<HTMLDialogElement>(null);
  const amountField = useRef<HTMLInputElement>(null);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [failed, setFailed] = useState(false);
  const [lastAccount, setLastAccount] = useRemembered("money:account");
  const [lastToAccount, setLastToAccount] = useRemembered("money:to-account");

  const [kind, setKind] = useState<MovementKind>(initial?.kind ?? "expense");
  const [amount, setAmount] = useState(initial ? amountInput(initial.amount, initial.currency) : "");
  const [accountId, setAccountId] = useState<string | null>(initial?.accountId ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(initial?.toAccountId ?? null);
  // Only a Transfer that already changed currency has an "arrived" worth keeping.
  const [toAmount, setToAmount] = useState(
    initial?.toAmount && initial.toCurrency && initial.toCurrency !== initial.currency
      ? amountInput(initial.toAmount, initial.toCurrency)
      : "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [every, setEvery] = useState(String(initial?.everyMonths ?? 1));
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const receipts = useReceipts(initial?.receipts);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    amountField.current?.focus();
  }, []);

  useEffect(() => {
    let live = true;
    loadMoneyChoices()
      .then((found) => {
        if (!live) return;
        setChoices(found);
        setDate((d) => d || found.today);
        const has = (id: string | null) => !!id && found.accounts.some((a) => a.id === id);
        setAccountId((id) => (has(id) ? id : has(lastAccount) ? lastAccount : (found.accounts[0]?.id ?? null)));
        setToAccountId((id) => (has(id) ? id : has(lastToAccount) ? lastToAccount : null));
        if (found.categories.length === 0) setNewCategory("");
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // Loaded once per opening; the remembered Accounts are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accounts = choices?.accounts ?? [];
  const from = accounts.find((a) => a.id === accountId);
  // With only one other Account, that is where the money goes.
  const targets = accounts.filter((a) => a.id !== accountId);
  const to =
    kind === "transfer"
      ? (targets.find((a) => a.id === toAccountId) ?? (targets.length === 1 ? targets[0] : undefined))
      : undefined;
  const currency: Currency = from?.currency ?? "COP";
  const units = parseAmount(amount, currency);
  const crossCurrency = !!to && to.currency !== currency;
  const toUnits = crossCurrency ? parseAmount(toAmount, to.currency) : null;

  async function addCategory() {
    const name = newCategory?.trim();
    if (!name) return;
    const created = await createCategory({ name });
    setChoices((c) =>
      c && !c.categories.some((x) => x.id === created.id) ? { ...c, categories: [...c.categories, created] } : c,
    );
    setCategoryId(created.id);
    setNewCategory(null);
  }

  function save() {
    setError(null);
    if (!from) return setError("Pick an Account.");
    if (units === null) return setError("Type an amount above 0.");
    if (kind === "expense" && !categoryId) return setError("Pick a Category.");
    if (kind === "transfer" && !to) return setError("Pick where the money goes.");
    if (crossCurrency && toUnits === null) return setError(`Say how much arrived, in ${to!.currency}.`);
    if (isRule && !note.trim()) return setError("Give it a name, e.g. Internet.");
    if (isRule && !isValidEvery(Number(every))) return setError(`Repeat every 1 to ${MAX_EVERY_MONTHS} months.`);
    if (!isRule && receipts.uploading) return setError("Wait for the files to finish uploading.");
    const flow = {
      kind,
      amount: units,
      accountId: from.id,
      toAccountId: kind === "transfer" ? (to?.id ?? null) : null,
      toAmount: crossCurrency ? toUnits : null,
      categoryId: kind === "expense" ? categoryId : null,
    };
    startTransition(async () => {
      const result =
        target.type === "recurring"
          ? await saveRecurring({ ...flow, id: target.id, name: note, firstDate: date, everyMonths: Number(every) })
          : await saveMovement({
              ...flow,
              id: target.type === "movement" ? target.id : undefined,
              date,
              note,
              occurrence:
                target.type === "occurrence" ? { recurringId: target.recurringId, month: target.month } : undefined,
              receipts: receipts.payload(),
            });
      if (result) return setError(result.error);
      receipts.markSaved();
      if (target.type === "movement" && !target.id) {
        setLastAccount(from.id);
        if (kind === "transfer" && to) setLastToAccount(to.id);
      }
      dialog.current?.close();
    });
  }

  const title =
    target.type === "recurring"
      ? target.id
        ? `Edit ${target.name}`
        : "New Recurring"
      : target.type === "occurrence"
        ? `Confirm ${target.name}`
        : target.id
          ? `Edit ${KIND_LABEL[kind]}`
          : `Add ${KIND_LABEL[kind]}`;

  return (
    <div className="contents" {...keepEvents}>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={() => {
          receipts.discardUnsaved();
          onClose();
        }}
        onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <form
          className="flex flex-col gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {target.type !== "movement" && <h2 className="font-semibold">{title}</h2>}
          <div className="flex items-center gap-1 rounded-lg bg-background p-1" role="tablist" aria-label="Kind">
            {(["expense", "income", "transfer"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-9 flex-1 rounded-md text-sm ${
                  kind === k ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="label">{kind === "transfer" ? "Amount sent" : "Amount"}</span>
            <input
              ref={amountField}
              value={amount}
              onChange={(event) => setAmount(amountTyping(event.target.value))}
              inputMode={currency === "COP" ? "numeric" : "decimal"}
              autoComplete="off"
              placeholder="0"
              className="input py-2 text-3xl font-semibold tabular-nums"
              aria-label="Amount"
            />
            <span className="h-4 text-xs text-muted tabular-nums">
              {units !== null ? formatAmount(units, currency) : ""}
            </span>
          </label>

          {failed && <p className="text-sm text-red-600">Couldn&apos;t load your Accounts. Close and try again.</p>}
          {!choices && !failed && <p className="text-sm text-muted">Loading…</p>}

          {choices && accounts.length === 0 && (
            <p className="text-sm">
              First create an Account in{" "}
              <Link href="/os/money" className="text-accent underline" onClick={() => dialog.current?.close()}>
                Money
              </Link>
              .
            </p>
          )}

          {choices && kind === "expense" && (
            <fieldset className="flex flex-col gap-1">
              <legend className="label mb-1">Category</legend>
              <div className="flex flex-wrap gap-1.5">
                {choices.categories.map((c) => (
                  <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                    {c.name}
                  </Chip>
                ))}
                {newCategory === null && (
                  <Chip selected={false} onClick={() => setNewCategory("")}>
                    + New
                  </Chip>
                )}
              </div>
              {newCategory !== null && (
                <div className="mt-1 flex gap-2">
                  <input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addCategory();
                      }
                    }}
                    maxLength={MAX_MONEY_NAME}
                    placeholder={choices.categories.length === 0 ? "Your first Category, e.g. Food" : "New Category"}
                    className="input"
                    aria-label="New Category"
                  />
                  <button type="button" className="btn" onClick={() => void addCategory()} disabled={!newCategory.trim()}>
                    Add
                  </button>
                </div>
              )}
            </fieldset>
          )}

          {accounts.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="label mb-1">{kind === "income" ? "Into" : "From"}</legend>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map((a) => (
                  <Chip key={a.id} selected={accountId === a.id} onClick={() => setAccountId(a.id)}>
                    {a.name}
                    {a.currency !== "COP" && <span className="ml-1 text-[11px] text-muted">{a.currency}</span>}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}

          {kind === "transfer" && accounts.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="label mb-1">To</legend>
              <div className="flex flex-wrap gap-1.5">
                {targets.map((a) => (
                  <Chip key={a.id} selected={to?.id === a.id} onClick={() => setToAccountId(a.id)}>
                    {a.name}
                    {a.currency !== "COP" && <span className="ml-1 text-[11px] text-muted">{a.currency}</span>}
                  </Chip>
                ))}
                {accounts.length === 1 && <span className="text-sm text-muted">Create a second Account first.</span>}
              </div>
            </fieldset>
          )}

          {crossCurrency && (
            <label className="flex flex-col gap-1">
              <span className="label">Arrived, in {to.currency}</span>
              <input
                value={toAmount}
                onChange={(event) => setToAmount(amountTyping(event.target.value))}
                inputMode={to.currency === "COP" ? "numeric" : "decimal"}
                autoComplete="off"
                className="input tabular-nums"
              />
              <span className="h-4 text-xs text-muted tabular-nums">
                {toUnits !== null ? formatAmount(toUnits, to.currency) : ""}
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="label">{isRule ? "Name" : "Note"}</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={isRule ? MAX_MONEY_NAME : MAX_MOVEMENT_NOTE}
                required={isRule}
                placeholder={isRule ? "e.g. Internet, Pay" : "Optional"}
                className="input"
              />
            </label>
            <label className="flex w-36 flex-col gap-1">
              <span className="label">{isRule ? "First on" : "Date"}</span>
              <input
                type="date"
                value={date}
                required
                onChange={(event) => setDate(event.target.value)}
                className="input"
              />
            </label>
          </div>

          {isRule && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              Every
              <input
                type="number"
                min={1}
                max={MAX_EVERY_MONTHS}
                value={every}
                onChange={(event) => setEvery(event.target.value)}
                className="input w-16 tabular-nums"
                aria-label="Every how many months"
              />
              {Number(every) === 1 ? "month" : "months"}, on the day of the first date. It asks on its day; nothing is
              recorded until you confirm.
            </label>
          )}

          {!isRule && <ReceiptsField receipts={receipts} />}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            {target.type === "movement" && target.id && initial && (
              <ConfirmDelete
                action={async (fd) => {
                  await deleteMovement(fd);
                  dialog.current?.close();
                }}
                id={target.id}
                what={KIND_LABEL[initial.kind]}
                title={formatAmount(initial.amount, initial.currency)}
                className="btn text-red-600"
              >
                Delete
              </ConfirmDelete>
            )}
            {target.type === "recurring" && target.id && (
              <ConfirmDelete
                action={async (fd) => {
                  await deleteRecurring(fd);
                  dialog.current?.close();
                }}
                id={target.id}
                what="Recurring"
                title={target.name ?? ""}
                buttonTitle="Stop it; what it recorded stays"
                className="btn text-red-600"
              >
                Stop
              </ConfirmDelete>
            )}
            <div className="flex-1" />
            <button type="button" className="btn" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button
              className="btn-primary min-h-9 px-4"
              disabled={pending || !choices || accounts.length === 0 || !date || (!isRule && receipts.uploading)}
            >
              {pending ? "Saving…" : target.type === "occurrence" ? "Confirm" : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
