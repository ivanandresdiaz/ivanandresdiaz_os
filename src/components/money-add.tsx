"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  amountInput,
  formatAmount,
  MAX_MONEY_NAME,
  MAX_MOVEMENT_NOTE,
  parseAmount,
  type Currency,
  type MovementKind,
} from "@/domain/money";
import { createCategory, deleteMovement, loadMoneyChoices, saveMovement } from "@/server/money-actions";
import type { MoneyChoices, MovementView } from "@/server/money";
import { ConfirmDelete, keepEvents } from "./confirm-delete";
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

/** Opens a movement of the month to change or delete it. */
export function EditMovement({ movement, children, className }: { movement: MovementView; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} title="Edit">
        {children}
      </button>
      {open && <MovementDialog initial={movement} onClose={() => setOpen(false)} />}
    </>
  );
}

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
 * the Category, both one tap away; the Account is the last one used (Q3).
 */
function MovementDialog({ initial, onClose }: { initial?: MovementView; onClose: () => void }) {
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
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    startTransition(async () => {
      const result = await saveMovement({
        id: initial?.id,
        kind,
        date,
        amount: units,
        accountId: from.id,
        toAccountId: kind === "transfer" ? (to?.id ?? null) : null,
        toAmount: crossCurrency ? toUnits : null,
        categoryId: kind === "expense" ? categoryId : null,
        note,
      });
      if (result) return setError(result.error);
      setLastAccount(from.id);
      if (kind === "transfer" && to) setLastToAccount(to.id);
      dialog.current?.close();
    });
  }

  const title = initial ? `Edit ${KIND_LABEL[kind]}` : `Add ${KIND_LABEL[kind]}`;

  return (
    <div className="contents" {...keepEvents}>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={onClose}
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
              onChange={(event) => setAmount(event.target.value)}
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
                onChange={(event) => setToAmount(event.target.value)}
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
              <span className="label">Date</span>
              <input
                type="date"
                value={date}
                required
                onChange={(event) => setDate(event.target.value)}
                className="input"
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            {initial && (
              <ConfirmDelete
                action={async (fd) => {
                  await deleteMovement(fd);
                  dialog.current?.close();
                }}
                id={initial.id}
                what={KIND_LABEL[initial.kind]}
                title={formatAmount(initial.amount, initial.currency)}
                className="btn text-red-600"
              >
                Delete
              </ConfirmDelete>
            )}
            <div className="flex-1" />
            <button type="button" className="btn" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button className="btn-primary min-h-9 px-4" disabled={pending || !choices || accounts.length === 0 || !date}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
