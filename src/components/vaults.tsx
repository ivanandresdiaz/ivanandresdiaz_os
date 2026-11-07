"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import {
  CLIPBOARD_CLEAR_S,
  createPassphrase,
  IDLE_LOCK_MIN,
  MAX_SECRET_TEXT,
  MAX_SECRET_TITLE,
  MAX_VAULT_NAME,
  MIN_PASSPHRASE,
  open,
  passphraseProblem,
  type PassphraseRecord,
  seal,
  unlock,
  type VaultKeys,
} from "@/domain/vault";
import { backupFileName, buildBackupHtml } from "@/domain/vault-backup";
import {
  changePassphrase,
  createSecret,
  createVault,
  deleteSecret,
  deleteVault,
  renameVault,
  setUpPassphrase,
  updateSecret,
} from "@/server/vault-actions";
import type { VaultSecretView, VaultsView, VaultView } from "@/server/queries";
import { ConfirmDelete } from "./confirm-delete";

/**
 * The Vaults. One unlock opens all of them; they lock together, by hand, after
 * a few idle minutes or when Ivan leaves the page. The keys live only in this
 * component's memory: never in storage, never sent anywhere.
 */
export function Vaults({ view, today }: { view: VaultsView; today: string }) {
  // Cache Components keeps a left page alive but hidden (React Activity), state and DOM
  // included. Hiding runs this cleanup: a new key drops the keys, any revealed text and
  // any half-typed field, so leaving the page really locks the Vaults.
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((n) => n + 1), []);
  return <VaultsPage key={visit} view={view} today={today} />;
}

function VaultsPage({ view, today }: { view: VaultsView; today: string }) {
  const [keys, setKeys] = useState<VaultKeys | null>(null);
  // The Passphrase this page just created or changed to. The server's copy arrives a
  // moment later; until then the old one must not open anything.
  const [ownRecord, setOwnRecord] = useState<PassphraseRecord | null>(null);
  const record = ownRecord ?? view.passphrase;
  const lock = useCallback(() => setKeys(null), []);
  useIdleLock(keys !== null, lock);

  function take(next: PassphraseRecord, nextKeys: VaultKeys) {
    setOwnRecord(next);
    setKeys(nextKeys);
  }

  if (!record) return <SetUp onReady={take} />;
  // Secrets still sealed with the old Passphrase, until the refresh brings them sealed with the new one.
  const settling = view.passphrase?.salt !== record.salt;

  return (
    <div className="flex flex-col gap-4">
      {keys ? (
        <OpenBar
          view={view}
          record={record}
          keys={keys}
          today={today}
          settling={settling}
          onLock={lock}
          onChanged={take}
        />
      ) : (
        <UnlockForm record={record} onOpen={setKeys} />
      )}
      {view.vaults.length === 0 && (
        <p className="text-sm text-muted">{keys ? "No Vaults yet. Create the first one." : "No Vaults yet."}</p>
      )}
      {view.vaults.map((vault) => (
        <VaultCard key={vault.id} vault={vault} vaults={view.vaults} keys={keys} />
      ))}
      {keys && <NewVault proof={keys.proof} />}
    </div>
  );
}

/** Locks after IDLE_LOCK_MIN without a touch, and when the page is left (or kept in the back/forward cache). */
function useIdleLock(unlocked: boolean, lock: () => void) {
  useEffect(() => {
    if (!unlocked) return;
    let timer = window.setTimeout(lock, IDLE_LOCK_MIN * 60_000);
    const touch = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, IDLE_LOCK_MIN * 60_000);
    };
    const events = ["pointerdown", "keydown", "scroll", "pointermove"] as const;
    for (const event of events) window.addEventListener(event, touch, { passive: true });
    window.addEventListener("pagehide", lock);
    return () => {
      window.clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, touch);
      window.removeEventListener("pagehide", lock);
    };
  }, [unlocked, lock]);
}

// ─── Passphrase ──────────────────────────────────────────────────────────────

/** Two password fields for a new Passphrase. Never offered to the browser's password manager. */
function NewPassphraseFields() {
  return (
    <>
      <input
        name="passphrase"
        type="password"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        required
        placeholder={`Passphrase (at least ${MIN_PASSPHRASE} characters)`}
        aria-label="Passphrase"
        className="input"
      />
      <input
        name="repeated"
        type="password"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        required
        placeholder="The same, again"
        aria-label="The same Passphrase, again"
        className="input"
      />
    </>
  );
}

function SetUp({ onReady }: { onReady: (record: PassphraseRecord, keys: VaultKeys) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card flex max-w-md flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const passphrase = String(form.get("passphrase"));
        const found = passphraseProblem(passphrase, String(form.get("repeated")));
        setProblem(found);
        if (found) return;
        startTransition(async () => {
          try {
            const { record, keys } = await createPassphrase(passphrase);
            await setUpPassphrase({ record, proof: keys.proof });
            onReady(record, keys);
          } catch {
            setProblem("It couldn't be created. Reload and try again.");
          }
        });
      }}
    >
      <h2 className="font-semibold">Create your Passphrase</h2>
      <p className="text-sm">One Passphrase opens every Vault. Use one you use nowhere else, not even on Google.</p>
      <p className="text-sm font-medium text-red-600">
        It can&apos;t be recovered. If you forget it, everything in the Vaults is lost: not even Ivan OS can open them.
      </p>
      <NewPassphraseFields />
      {problem && <p className="text-sm text-red-600">{problem}</p>}
      <button className="btn-primary self-start disabled:opacity-50" disabled={pending}>
        {pending ? "Creating…" : "Create Passphrase"}
      </button>
    </form>
  );
}

function UnlockForm({ record, onOpen }: { record: PassphraseRecord; onOpen: (keys: VaultKeys) => void }) {
  const [wrong, setWrong] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("passphrase") as HTMLInputElement;
        const passphrase = input.value;
        startTransition(async () => {
          const keys = await unlock(passphrase, record);
          setWrong(!keys);
          if (keys) onOpen(keys);
          else input.select();
        });
      }}
    >
      <span aria-hidden>🔒</span>
      <input
        name="passphrase"
        type="password"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        required
        autoFocus
        placeholder="Passphrase"
        aria-label="Passphrase"
        className="input min-w-0 flex-1"
      />
      <button className="btn-primary disabled:opacity-50" disabled={pending}>
        {pending ? "Opening…" : "Unlock"}
      </button>
      {wrong && <p className="w-full text-sm text-red-600">That&apos;s not the Passphrase.</p>}
    </form>
  );
}

function OpenBar({
  view,
  record,
  keys,
  today,
  settling,
  onLock,
  onChanged,
}: {
  view: VaultsView;
  record: PassphraseRecord;
  keys: VaultKeys;
  today: string;
  settling: boolean;
  onLock: () => void;
  onChanged: (record: PassphraseRecord, keys: VaultKeys) => void;
}) {
  const [changing, setChanging] = useState(false);

  function downloadBackup() {
    const html = buildBackupHtml({
      downloadedAt: today,
      passphrase: record,
      vaults: view.vaults.map((vault) => ({
        name: vault.name,
        secrets: vault.secrets.map(({ title, iv, ciphertext }) => ({
          title,
          iv,
          ciphertext,
        })),
      })),
    });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName(today);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          <span aria-hidden>🔓</span> Open. They lock after {IDLE_LOCK_MIN} idle minutes or when you leave.
        </span>
        <span className="flex-1" />
        <span className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            disabled={settling}
            onClick={downloadBackup}
            title="A file with every Vault, still encrypted, that opens offline with this Passphrase"
          >
            Download Backup
          </button>
          <button type="button" className="btn" disabled={settling} onClick={() => setChanging((now) => !now)}>
            Change Passphrase
          </button>
          <button type="button" className="btn-primary" onClick={onLock}>
            Lock
          </button>
        </span>
      </div>
      {changing && (
        <ChangePassphrase
          view={view}
          keys={keys}
          onDone={(next, nextKeys) => {
            setChanging(false);
            onChanged(next, nextKeys);
          }}
        />
      )}
    </div>
  );
}

/** Opens every Secret with the current key and seals it again with the new Passphrase's. */
function ChangePassphrase({
  view,
  keys,
  onDone,
}: {
  view: VaultsView;
  keys: VaultKeys;
  onDone: (record: PassphraseRecord, keys: VaultKeys) => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-md flex-col gap-2 border-t border-line pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const passphrase = String(form.get("passphrase"));
        const found = passphraseProblem(passphrase, String(form.get("repeated")));
        setProblem(found);
        if (found) return;
        startTransition(async () => {
          try {
            const next = await createPassphrase(passphrase);
            const secrets = await Promise.all(
              view.vaults
                .flatMap((vault) => vault.secrets)
                .map(async (secret) => ({
                  id: secret.id,
                  ...(await seal(next.keys.key, await open(keys.key, secret))),
                })),
            );
            await changePassphrase({
              proof: keys.proof,
              record: next.record,
              newProof: next.keys.proof,
              secrets,
            });
            onDone(next.record, next.keys);
          } catch {
            setProblem("It didn't change; the old Passphrase still works. Reload and try again.");
          }
        });
      }}
    >
      <p className="text-sm">
        The new one opens every Vault from now on. Backups you already downloaded still open with the old one.
      </p>
      <NewPassphraseFields />
      {problem && <p className="text-sm text-red-600">{problem}</p>}
      <button className="btn-primary self-start disabled:opacity-50" disabled={pending}>
        {pending ? "Changing…" : "Change it"}
      </button>
    </form>
  );
}

// ─── Vaults ──────────────────────────────────────────────────────────────────

function NewVault({ proof }: { proof: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const name = String(new FormData(form).get("name")).trim();
        if (!name) return;
        startTransition(async () => {
          await createVault({ proof, name });
          form.reset();
        });
      }}
    >
      <input
        name="name"
        required
        maxLength={MAX_VAULT_NAME}
        placeholder="New Vault (e.g. Infra, Finance)"
        className="input"
      />
      <button className="btn-primary disabled:opacity-50" disabled={pending}>
        Add
      </button>
    </form>
  );
}

function VaultCard({ vault, vaults, keys }: { vault: VaultView; vaults: VaultView[]; keys: VaultKeys | null }) {
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {keys && renaming ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name")).trim();
              if (!name) return;
              startTransition(async () => {
                await renameVault({ proof: keys.proof, id: vault.id, name });
                setRenaming(false);
              });
            }}
          >
            <input
              name="name"
              defaultValue={vault.name}
              required
              maxLength={MAX_VAULT_NAME}
              autoFocus
              className="input"
            />
            <button className="btn-primary disabled:opacity-50" disabled={pending}>
              Save
            </button>
            <button type="button" className="btn" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <h2 className="flex-1 font-semibold">{vault.name}</h2>
        )}
        {keys && !renaming && (
          <>
            <button
              type="button"
              className="text-xs text-muted hover:text-foreground"
              onClick={() => setRenaming(true)}
            >
              Rename
            </button>
            <ConfirmDelete
              action={async (fd) => {
                fd.set("proof", keys.proof);
                await deleteVault(fd);
              }}
              id={vault.id}
              what="Vault"
              title={vault.name}
              counts="vault"
            />
          </>
        )}
      </div>
      {vault.secrets.length === 0 && !adding && <p className="text-sm text-muted">No Secrets.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {vault.secrets.map((secret) => (
          <li key={secret.id} className="py-1.5">
            {keys ? (
              <SecretRow secret={secret} vault={vault} vaults={vaults} keys={keys} />
            ) : (
              <span className="text-sm">{secret.title}</span>
            )}
          </li>
        ))}
      </ul>
      {keys &&
        (adding ? (
          <SecretForm
            keys={keys}
            vaults={vaults}
            vaultId={vault.id}
            onCancel={() => setAdding(false)}
            onSave={async (v) => {
              await createSecret({
                proof: keys.proof,
                vaultId: v.vaultId,
                title: v.title,
                ...v.sealed,
              });
              setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="btn self-start" onClick={() => setAdding(true)}>
            + Secret
          </button>
        ))}
    </section>
  );
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

/** Clearing outlives the row: locking or closing it doesn't keep a copied Secret on the clipboard. */
let clipboardTimer: number | undefined;

function copyForAWhile(text: string) {
  void navigator.clipboard.writeText(text);
  window.clearTimeout(clipboardTimer);
  clipboardTimer = window.setTimeout(() => {
    navigator.clipboard.writeText("").catch(() => {});
  }, CLIPBOARD_CLEAR_S * 1000);
}

function SecretRow({
  secret,
  vault,
  vaults,
  keys,
}: {
  secret: VaultSecretView;
  vault: VaultView;
  vaults: VaultView[];
  keys: VaultKeys;
}) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const shown = text !== null;

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  async function reveal() {
    if (shown) {
      setText(null);
      setEditing(false);
      return;
    }
    try {
      setText(await open(keys.key, secret));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  // A fresh render (after an edit) brings new ciphertext: show the new text, not the stale one.
  const sealedNow = `${secret.iv}.${secret.ciphertext}`;
  const [lastSealed, setLastSealed] = useState(sealedNow);
  if (sealedNow !== lastSealed) {
    setLastSealed(sealedNow);
    setText(null);
    setFailed(false);
  }

  if (editing && text !== null) {
    return (
      <SecretForm
        keys={keys}
        vaults={vaults}
        vaultId={vault.id}
        initial={{ title: secret.title, text }}
        onCancel={() => setEditing(false)}
        onSave={async (v) => {
          await updateSecret({
            proof: keys.proof,
            id: secret.id,
            vaultId: v.vaultId,
            title: v.title,
            ...v.sealed,
          });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void reveal()}
          className="flex-1 text-left text-sm hover:text-accent"
          aria-expanded={shown}
        >
          {secret.title}
        </button>
        {shown && (
          <>
            <button
              type="button"
              className="text-xs text-muted hover:text-foreground"
              onClick={() => {
                copyForAWhile(text);
                setCopied(true);
                window.clearTimeout(copiedTimer.current);
                copiedTimer.current = window.setTimeout(() => setCopied(false), 2_000);
              }}
            >
              {copied ? `Copied, clears in ${CLIPBOARD_CLEAR_S} s` : "Copy"}
            </button>
            <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setEditing(true)}>
              Edit
            </button>
          </>
        )}
        <ConfirmDelete
          action={async (fd) => {
            fd.set("proof", keys.proof);
            await deleteSecret(fd);
          }}
          id={secret.id}
          what="Secret"
          title={secret.title}
        />
      </div>
      {failed && <p className="text-xs text-red-600">This Secret doesn&apos;t open with the current Passphrase.</p>}
      {shown && (
        <pre className="whitespace-pre-wrap break-words rounded-md border border-line bg-background p-2 font-mono text-xs">
          {text}
        </pre>
      )}
    </div>
  );
}

type SecretDraft = {
  vaultId: string;
  title: string;
  sealed: { iv: string; ciphertext: string };
};

/** The text is a plain field, not a Long text: no Dictation, no English Coach, nothing leaves the browser unsealed. */
function SecretForm({
  keys,
  vaults,
  vaultId,
  initial,
  onSave,
  onCancel,
}: {
  keys: VaultKeys;
  vaults: VaultView[];
  vaultId: string;
  initial?: { title: string; text: string };
  onSave: (draft: SecretDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-line p-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const title = String(form.get("title")).trim();
        const text = String(form.get("text"));
        const target = String(form.get("vaultId"));
        if (!title) return;
        startTransition(async () => {
          try {
            await onSave({
              vaultId: target,
              title,
              sealed: await seal(keys.key, text),
            });
          } catch {
            setProblem("It wasn't saved. Unlock again and retry.");
          }
        });
      }}
    >
      <input
        name="title"
        required
        maxLength={MAX_SECRET_TITLE}
        defaultValue={initial?.title}
        autoFocus
        autoComplete="off"
        placeholder="Title (always visible, e.g. Vercel recovery codes)"
        className="input"
      />
      <textarea
        name="text"
        rows={5}
        maxLength={MAX_SECRET_TEXT}
        defaultValue={initial?.text}
        autoComplete="off"
        spellCheck={false}
        placeholder="The secret text (encrypted before it leaves this page)"
        className="input font-mono"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm">
          <span className="text-muted">Vault</span>
          <select name="vaultId" defaultValue={vaultId} className="input w-auto">
            {vaults.map((vault) => (
              <option key={vault.id} value={vault.id}>
                {vault.name}
              </option>
            ))}
          </select>
        </label>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary disabled:opacity-50" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {problem && <p className="text-sm text-red-600">{problem}</p>}
    </form>
  );
}
