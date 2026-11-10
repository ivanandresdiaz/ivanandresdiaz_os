"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  BRIEF_TEMPLATE,
  interviewStatusLabel,
  LANGUAGES,
  MAX_THEME_DESCRIPTION,
  stagesFor,
} from "@/domain/discovery";
import {
  confirmOpeningImage,
  createOpeningImageUpload,
  createTheme,
  deleteDiscovery,
  deleteOpeningImage,
  deleteTheme,
  describeOpeningImage,
  discoveryExport,
  draftOpeningText,
  moveTheme,
  saveBrief,
  saveOpening,
  setDiscoveryStatus,
  updateDiscovery,
  updateTheme,
} from "@/server/discovery-actions";
import type { DiscoveryView } from "@/server/discoveries";
import { ConfirmDelete } from "../confirm-delete";
import { LongText } from "../long-text";
import { InsightsView } from "./insights-view";
import { Stakeholders, TryIt } from "./editor-people";

/**
 * Ivan's side of a Discovery: the hidden Brief, the Opening people read, the
 * Themes, who is invited, how far each Interview got, and the Insights (Q8–Q45).
 */
export function DiscoveryEditor({ view }: { view: DiscoveryView }) {
  const { discovery } = view;
  return (
    <div className="flex flex-col gap-4">
      <StatusBar view={view} />
      <Section title="Brief" hint="Hidden. Only the AI reads it: the company, the product, the codebase, what's decided.">
        <BriefForm id={discovery.id} brief={discovery.brief} />
      </Section>
      <Section title="Opening" hint="What every Stakeholder reads first, with your diagrams.">
        <OpeningForm view={view} />
      </Section>
      <Section title={`Themes · ${view.themes.length}`} hint="What people see as topics. “What I want to learn” stays hidden.">
        <Themes view={view} />
      </Section>
      <Section
        title={`Stakeholders · ${view.stakeholders.filter((p) => !p.isTest).length}`}
        hint="Who can sign in with a code. The role note is hidden; the AI reads it."
      >
        <Stakeholders view={view} />
      </Section>
      {discovery.status === "draft" && (
        <Section title="Try it" hint="Play a Stakeholder: the real Interview. Wiped when the Discovery opens.">
          <TryIt view={view} />
        </Section>
      )}
      <Section title="Progress" hint="Each person's Interview of each Theme.">
        <Progress view={view} />
      </Section>
      <Section title="Insights" hint="Per person and Theme, rewritten after every round. Nothing is merged across people.">
        <AllInsights view={view} />
      </Section>
      <Section title="Settings">
        <Settings view={view} />
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const STATUS_LABEL = { draft: "Draft", open: "Open", closed: "Closed" } as const;

function StatusBar({ view }: { view: DiscoveryView }) {
  const { discovery } = view;
  const status = discovery.status as keyof typeof STATUS_LABEL;
  const [asking, setAsking] = useState(false);
  const [signOut, setSignOut] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const path = `/d/${discovery.slug}`;
  const people = view.stakeholders.filter((p) => !p.isTest && !p.removedAt);
  const ready = [
    { done: discovery.brief.trim() !== BRIEF_TEMPLATE.trim() && discovery.brief.trim().length > 0, label: "Brief written" },
    { done: discovery.opening.trim().length > 0, label: "Opening written" },
    { done: view.themes.length > 0, label: "A Theme" },
    { done: people.length > 0, label: "A Stakeholder" },
  ];
  const change = (next: "open" | "closed", options?: { signOut: boolean }) =>
    start(async () => {
      await setDiscoveryStatus({ id: discovery.id, status: next, ...options });
      setAsking(false);
    });

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            status === "open" ? "bg-accent/15 text-accent" : status === "closed" ? "bg-line text-muted" : "bg-amber-100 text-amber-900"
          }`}
        >
          {STATUS_LABEL[status]}
        </span>
        <code className="min-w-0 truncate rounded bg-line px-1.5 py-0.5 text-xs">{path}</code>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void navigator.clipboard.writeText(`${window.location.origin}${path}`);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="btn" href={path} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      </div>

      {status === "draft" && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {ready.map((item) => (
            <li key={item.label} className={item.done ? "text-accent" : "text-muted"}>
              {item.done ? "✓" : "○"} {item.label}
            </li>
          ))}
        </ul>
      )}

      {!asking ? (
        <div className="flex flex-wrap gap-2">
          {status === "draft" && (
            <button type="button" className="btn-primary" onClick={() => setAsking(true)}>
              Open to Stakeholders
            </button>
          )}
          {status === "open" && (
            <button type="button" className="btn" onClick={() => setAsking(true)}>
              Close
            </button>
          )}
          {status === "closed" && (
            <button type="button" className="btn" disabled={pending} onClick={() => change("open")}>
              {pending ? "Reopening…" : "Reopen"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
          {status === "draft" ? (
            <p>
              Opening lets everyone invited sign in with a code. Your test Interviews are deleted.
              {ready.some((r) => !r.done) && <span className="text-amber-700"> Not everything is ready yet.</span>}
            </p>
          ) : (
            <>
              <p>Closing stops new answers. Everything said stays here.</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={signOut} onChange={(event) => setSignOut(event.target.checked)} />
                Sign everyone out
              </label>
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() => change(status === "draft" ? "open" : "closed", status === "draft" ? undefined : { signOut })}
            >
              {pending ? "…" : status === "draft" ? "Open it" : "Close it"}
            </button>
            <button type="button" className="btn" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SaveRow({ pending, saved, children }: { pending: boolean; saved?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && <span className="text-xs text-accent">Saved</span>}
      {children}
    </div>
  );
}

function BriefForm({ id, brief }: { id: string; brief: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const text = String(new FormData(event.currentTarget).get("brief") ?? "");
        start(() => saveBrief({ id, brief: text }));
      }}
    >
      <LongText name="brief" defaultValue={brief} markdown rows={14} aria-label="Brief" className="input font-mono text-xs" />
      <SaveRow pending={pending} />
    </form>
  );
}

function OpeningForm({ view }: { view: DiscoveryView }) {
  const { discovery } = view;
  const [text, setText] = useState(discovery.opening);
  const [saved, setSaved] = useState(discovery.opening);
  if (saved !== discovery.opening) {
    setSaved(discovery.opening);
    setText(discovery.opening);
  }
  const [error, setError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [saving, startSaving] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <LongText value={text} onValueChange={setText} markdown rows={8} aria-label="Opening" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary" disabled={saving || text === saved}>
            {saving ? "Saving…" : "Save"}
          </button>
          {text !== saved && <span className="text-xs text-amber-700">Unsaved</span>}
          <button
            type="button"
            className="btn"
            disabled={drafting}
            onClick={() =>
              startDrafting(async () => {
                setError(null);
                const result = await draftOpeningText({ id: discovery.id });
                if (result.ok) setText(result.text);
                else setError(result.error);
              })
            }
          >
            {drafting ? "Drafting…" : text.trim() ? "Draft again with AI" : "Draft with AI"}
          </button>
          <span className="text-xs text-muted">From the Brief and the Themes; you edit it before saving.</span>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
      <OpeningImages view={view} />
    </div>
  );

  function start() {
    startSaving(() => saveOpening({ id: discovery.id, opening: text }));
  }
}

function OpeningImages({ view }: { view: DiscoveryView }) {
  const discoveryId = view.discovery.id;
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function add(file: File) {
    setUploading((n) => n + 1);
    setError(null);
    try {
      const upload = await createOpeningImageUpload({ discoveryId, contentType: file.type, size: file.size });
      if (!upload.ok) throw new Error(upload.error);
      const res = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error("The upload failed.");
      await confirmOpeningImage({ discoveryId, key: upload.key, contentType: file.type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setUploading((n) => n - 1);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="label">Diagrams</p>
      {view.images.map((image, index) => (
        <div key={image.id} className="flex gap-3 rounded-lg border border-line p-2">
          <a href={image.url} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="size-20 rounded bg-white object-contain" />
          </a>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-muted">Diagram {index + 1} · the caption people read, and what the AI is told it shows</span>
            <ImageDescription id={image.id} description={image.description} />
          </div>
          <ConfirmDelete action={deleteOpeningImage} id={image.id} what="diagram" title={`Diagram ${index + 1}`} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={uploading > 0} onClick={() => input.current?.click()}>
          {uploading > 0 ? "Uploading…" : "Add diagram"}
        </button>
        <span className="text-xs text-muted">PNG, JPEG or WebP, up to 5 MB.</span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            files.forEach((file) => void add(file));
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ImageDescription({ id, description }: { id: string; description: string }) {
  const [value, setValue] = useState(description);
  const [pending, start] = useTransition();
  return (
    <textarea
      value={value}
      rows={2}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => value !== description && start(() => describeOpeningImage({ id, description: value }))}
      placeholder="What this diagram shows"
      aria-busy={pending}
      className={`input field-sizing-content transition-opacity ${pending ? "opacity-60" : ""}`}
    />
  );
}

function Themes({ view }: { view: DiscoveryView }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {view.themes.map((theme, index) => (
        <ThemeRow key={theme.id} theme={theme} first={index === 0} last={index === view.themes.length - 1} />
      ))}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          start(async () => {
            await createTheme({ discoveryId: view.discovery.id, title });
            setTitle("");
          });
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="New Theme, e.g. “Collecting overdue payments”"
          aria-label="New Theme"
          className="input"
        />
        <button type="submit" className="btn-primary shrink-0" disabled={pending || !title.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

function ThemeRow({ theme, first, last }: { theme: DiscoveryView["themes"][number]; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const [moving, startMoving] = useTransition();
  return (
    <div className="flex items-start gap-1 rounded-lg border border-line">
      <details className="min-w-0 flex-1">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{theme.title}</span>
        </summary>
        <form
          className="flex flex-col gap-2 border-t border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            start(() =>
              updateTheme({
                id: theme.id,
                title: String(fd.get("title") ?? ""),
                description: String(fd.get("description") ?? ""),
                learn: String(fd.get("learn") ?? ""),
              }),
            );
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="label">Title</span>
            <input name="title" defaultValue={theme.title} required className="input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Description · people see it</span>
            <input name="description" defaultValue={theme.description} maxLength={MAX_THEME_DESCRIPTION} className="input" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="label">What I want to learn · hidden</span>
            <LongText name="learn" defaultValue={theme.learn} rows={6} aria-label="What I want to learn" />
          </div>
          <SaveRow pending={pending} />
        </form>
      </details>
      <div className="flex shrink-0 items-center gap-1 p-1.5">
        <button
          type="button"
          className="btn px-1.5"
          disabled={first || moving}
          aria-label="Move up"
          onClick={() => startMoving(() => moveTheme({ id: theme.id, direction: -1 }))}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn px-1.5"
          disabled={last || moving}
          aria-label="Move down"
          onClick={() => startMoving(() => moveTheme({ id: theme.id, direction: 1 }))}
        >
          ↓
        </button>
        <ConfirmDelete action={deleteTheme} id={theme.id} what="Theme" title={theme.title} className="btn px-2 text-muted hover:text-red-600" />
      </div>
    </div>
  );
}

function Progress({ view }: { view: DiscoveryView }) {
  const people = view.stakeholders;
  if (people.length === 0 || view.themes.length === 0) {
    return <p className="text-sm text-muted">Add Themes and Stakeholders first.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="p-2 font-medium text-muted" />
            {view.themes.map((t) => (
              <th key={t.id} className="p-2 text-xs font-medium text-muted">
                {t.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="p-2 whitespace-nowrap">
                {p.name}
                {p.isTest && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-900">test</span>}
              </td>
              {view.themes.map((t) => {
                if (!p.themeIds.includes(t.id)) {
                  return (
                    <td key={t.id} className="p-2 text-muted">
                      —
                    </td>
                  );
                }
                const cell = view.cells[`${p.id}:${t.id}`];
                const label = interviewStatusLabel(cell ?? null, stagesFor(p));
                return (
                  <td key={t.id} className="p-2">
                    {cell ? (
                      <Link
                        href={`/os/profile/discoveries/${view.discovery.id}/interviews/${cell.id}`}
                        className={`underline-offset-2 hover:underline ${cell.phase === "failed" ? "text-amber-700" : cell.phase === "done" ? "text-accent" : ""}`}
                      >
                        {label}
                        {cell.hasInsights && (
                          <span className="block text-[11px] text-muted">
                            {cell.needs} needs · {cell.proposals} proposals
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-muted">{label}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Puts text on the clipboard that is still being made, so Safari keeps the click's permission. */
async function copyWhenReady(text: Promise<string>) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
  } else {
    await navigator.clipboard.writeText(await text);
  }
}

function AllInsights({ view }: { view: DiscoveryView }) {
  const [conversations, setConversations] = useState(false);
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const name = (id: string) => view.stakeholders.find((p) => p.id === id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={state === "copying"}
          onClick={() => {
            setState("copying");
            copyWhenReady(discoveryExport({ id: view.discovery.id, conversations }))
              .then(() => setState("copied"))
              .catch(() => setState("failed"));
          }}
        >
          {state === "copying" ? "Copying…" : state === "copied" ? "Copied ✓" : "Copy as Markdown"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={conversations} onChange={(event) => setConversations(event.target.checked)} />
          Include full conversations
        </label>
        {state === "failed" && <span className="text-xs text-red-600">Couldn&apos;t copy.</span>}
      </div>
      <p className="text-xs text-muted">The Markdown leaves out the Brief and the test Interviews.</p>
      {view.themes.map((theme) => {
        const entries = view.insights.filter((i) => i.themeId === theme.id);
        return (
          <div key={theme.id} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{theme.title}</h3>
            {entries.length === 0 && <p className="text-sm text-muted">No Insights yet.</p>}
            {entries.map((entry) => {
              const person = name(entry.stakeholderId);
              return (
                <details key={entry.id} className="rounded-lg border border-line">
                  <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm">
                    <span className="font-medium">{person?.name ?? "Someone"}</span>
                    {person?.roleNote && <span className="truncate text-xs text-muted">{person.roleNote}</span>}
                    {person?.isTest && <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-900">test</span>}
                    <span className="ml-auto shrink-0 text-xs text-muted">
                      {entry.insights.needs.length} needs · {entry.insights.proposals.length} proposals
                    </span>
                  </summary>
                  <div className="flex flex-col gap-2 border-t border-line p-3">
                    <InsightsView insights={entry.insights} />
                    <Link
                      href={`/os/profile/discoveries/${view.discovery.id}/interviews/${entry.id}`}
                      className="self-start text-xs text-accent underline underline-offset-2"
                    >
                      The conversation →
                    </Link>
                  </div>
                </details>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Settings({ view }: { view: DiscoveryView }) {
  const { discovery } = view;
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          start(() =>
            updateDiscovery({ id: discovery.id, title: String(fd.get("title") ?? ""), language: String(fd.get("language") ?? "es") }),
          );
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="label">Title · people see it</span>
          <input name="title" defaultValue={discovery.title} required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Language · of the AI, the buttons and the email</span>
          <select name="language" defaultValue={discovery.language} className="input">
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l === "es" ? "Spanish" : "English"}
              </option>
            ))}
          </select>
        </label>
        <SaveRow pending={pending} />
      </form>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">Deletes the Brief, the diagrams, every Interview and every file.</span>
        <ConfirmDelete
          action={deleteDiscovery}
          id={discovery.id}
          what="Discovery"
          title={discovery.title}
          className="btn shrink-0 text-red-600"
        >
          Delete Discovery
        </ConfirmDelete>
      </div>
    </div>
  );
}
