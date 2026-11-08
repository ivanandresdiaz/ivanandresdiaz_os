"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addDays, startOfWeek } from "@/domain/dates";
import {
  chapterProgress,
  daysLeft,
  explorationDue,
  explorationEndsOn,
  isObsidianLink,
  MAX_ACTIVE_PATHS,
  nextChapter,
} from "@/domain/learning-paths";
import {
  createChapter,
  createLearningPath,
  deleteChapter,
  deleteExploration,
  deleteLearningPath,
  endExploration,
  reorderChapters,
  reorderLearningPaths,
  saveLearningPath,
  setLearningPathStatus,
  startExploration,
  toggleChapter,
  updateChapter,
} from "@/server/learning-path-actions";
import type { ChapterView, ExplorationView, LearningPathView, WeekChapter } from "@/server/learning-paths";
import { ConfirmDelete } from "./confirm-delete";
import { LongText } from "./long-text";
import { OrderedList, PriorityList } from "./priority-list";
import { GamesPicker, GameTags, Hidden, WeekChip } from "./ui";

type Block = { id: string; name: string };
type CampaignOption = { id: string; title: string; status: string };

export function LearningBoard({
  paths,
  explorations,
  blocks,
  campaigns,
  defaultBlockId,
  today,
}: {
  paths: LearningPathView[];
  explorations: ExplorationView[];
  blocks: Block[];
  campaigns: CampaignOption[];
  defaultBlockId: string | null;
  today: string;
}) {
  const [editing, setEditing] = useState<{ path: LearningPathView; activate: boolean } | null>(null);
  const active = paths.filter((p) => p.status === "active");
  const candidates = paths.filter((p) => p.status === "candidate");
  const closed = paths.filter((p) => p.status === "done" || p.status === "dropped");
  const open = explorations.find((e) => e.verdict === null) ?? null;
  const ended = explorations.filter((e) => e.verdict !== null);
  const full = active.length >= MAX_ACTIVE_PATHS;

  return (
    <div className="flex flex-col gap-6">
      <form action={createLearningPath} className="flex gap-2" key={paths.length}>
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Capture something to learn (a course, a book…)"
          aria-label="New Candidate"
          className="input flex-1"
        />
        <button className="btn-primary">Capture</button>
      </form>

      <section className="flex flex-col gap-2">
        <SectionTitle title="Active" count={`${active.length}/${MAX_ACTIVE_PATHS}`} />
        {active.length === 0 ? (
          <Empty>No Active Learning Path. Activate a Candidate: it needs its why now and its Infinite Games.</Empty>
        ) : (
          active.map((path) => (
            <ActivePath key={path.id} path={path} today={today} onEdit={() => setEditing({ path, activate: false })} />
          ))
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="Exploration" count={open ? "1/1" : "0/1"} />
        {open ? <OpenExploration exploration={open} today={today} /> : <StartExploration today={today} />}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="Candidates" count={String(candidates.length)} />
        <p className="-mt-1 text-xs text-muted">
          The stack, in my priority. It asks nothing of me until I activate one.
        </p>
        {candidates.length === 0 ? (
          <Empty>Nothing in the stack.</Empty>
        ) : (
          <PriorityList items={candidates} save={(ids) => reorderLearningPaths({ ids })}>
            {(path) => (
              <CandidateRow
                path={path}
                full={full}
                onEdit={() => setEditing({ path, activate: false })}
                onActivate={() => setEditing({ path, activate: true })}
              />
            )}
          </PriorityList>
        )}
      </section>

      {(closed.length > 0 || ended.length > 0) && (
        <details className="border-t border-line pt-3">
          <summary className="label cursor-pointer">
            Done and Dropped ({closed.length + ended.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {closed.map((path) => (
              <ClosedPath key={path.id} path={path} />
            ))}
            {ended.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-sm opacity-70">
                <span className="min-w-0 flex-1 break-words">
                  {e.title}
                  <span className="ml-2 text-xs text-muted">
                    Exploration · {e.verdict === "path" ? "became a Candidate" : "dropped"} · {e.startedOn} → {e.endedOn}
                  </span>
                </span>
                <ConfirmDelete action={deleteExploration} id={e.id} what="Exploration" title={e.title} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && (
        <PathEditor
          key={`${editing.path.id}:${editing.activate}`}
          path={editing.path}
          activate={editing.activate}
          full={full}
          blocks={blocks}
          campaigns={campaigns}
          defaultBlockId={defaultBlockId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: string }) {
  return (
    <h2 className="flex items-baseline gap-2 font-semibold">
      {title}
      <span className="text-xs font-normal text-muted">{count}</span>
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function NotesLink({ link, label = "Open notes" }: { link: string; label?: string }) {
  if (!link) return null;
  return (
    <a
      href={link}
      target={isObsidianLink(link) ? undefined : "_blank"}
      rel="noreferrer"
      className="shrink-0 text-xs text-accent hover:underline"
    >
      {isObsidianLink(link) ? `${label} in Obsidian ↗` : `${label} ↗`}
    </a>
  );
}

function weekLabel(weekOf: string, today: string): { label: string; now: boolean } {
  const thisWeek = startOfWeek(today);
  if (weekOf === thisWeek) return { label: "This week", now: true };
  if (weekOf === addDays(thisWeek, 7)) return { label: "Next week", now: false };
  return { label: `Week of ${weekOf}`, now: false };
}

// ─── Active ──────────────────────────────────────────────────────────────────

function ActivePath({ path, today, onEdit }: { path: LearningPathView; today: string; onEdit: () => void }) {
  const progress = chapterProgress(path.chapters);
  const next = nextChapter(path.chapters);
  return (
    <article className="card flex flex-col gap-3">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words">{path.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {path.block && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <span className="size-2 rounded-full" style={{ backgroundColor: path.block.color }} />
                {path.block.name}
              </span>
            )}
            <GameTags games={path.games} />
            {path.campaigns.map((c) => (
              <span key={c.id} className="rounded bg-line px-1.5 text-[11px] text-muted">
                {c.title}
              </span>
            ))}
          </div>
        </div>
        <NotesLink link={path.link} />
      </header>

      {path.whyNow.trim() && (
        <p className="text-sm whitespace-pre-line">
          <span className="label mr-1">Why now</span>
          {path.whyNow}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            {progress.done}/{progress.total} Chapters
          </span>
          {progress.total > 0 && (
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </span>
          )}
        </div>
        <ChapterList path={path} today={today} nextId={next?.id ?? null} reorderable />
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm">
        <button type="button" className="btn" onClick={onEdit}>
          Edit
        </button>
        <StatusButton id={path.id} status="done" label="Finish" />
        <StatusButton id={path.id} status="candidate" label="Stop" title="Back to the Candidates; frees its place" />
        <StatusButton id={path.id} status="dropped" label="Drop" />
      </footer>
    </article>
  );
}

function StatusButton({
  id,
  status,
  label,
  title,
}: {
  id: string;
  status: "candidate" | "done" | "dropped";
  label: string;
  title?: string;
}) {
  return (
    <form action={setLearningPathStatus}>
      <Hidden id={id} status={status} />
      <button className="btn" title={title}>
        {label}
      </button>
    </form>
  );
}

// ─── Chapters ────────────────────────────────────────────────────────────────

function ChapterList({
  path,
  today,
  nextId,
  reorderable,
}: {
  path: LearningPathView;
  today: string;
  nextId: string | null;
  reorderable: boolean;
}) {
  const row = (chapter: ChapterView) => (
    <ChapterRow chapter={chapter} today={today} next={chapter.id === nextId} />
  );
  return (
    <div className="flex flex-col gap-1">
      {path.chapters.length === 0 ? (
        <Empty>No Chapters yet. A Chapter is what one week of this Path covers.</Empty>
      ) : reorderable ? (
        <OrderedList
          items={path.chapters}
          save={(ids) => reorderChapters({ pathId: path.id, ids })}
          className="flex flex-col gap-0.5"
        >
          {row}
        </OrderedList>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {path.chapters.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              {row(c)}
            </li>
          ))}
        </ul>
      )}
      <form action={createChapter} className="flex gap-2" key={path.chapters.length}>
        <Hidden pathId={path.id} />
        <input name="title" required maxLength={200} placeholder="New Chapter" aria-label="New Chapter" className="input flex-1 py-1 text-sm" />
        <button className="btn text-sm">Add</button>
      </form>
    </div>
  );
}

function ChapterRow({ chapter, today, next }: { chapter: ChapterView; today: string; next: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <ChapterEditor chapter={chapter} onDone={() => setEditing(false)} />;
  const week = chapter.weekOf && !chapter.done ? weekLabel(chapter.weekOf, today) : null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
      <form action={toggleChapter} className="flex">
        <Hidden id={chapter.id} />
        <button aria-label={chapter.done ? `Mark ${chapter.title} not done` : `Mark ${chapter.title} done`}>
          {chapter.done ? "☑" : "☐"}
        </button>
      </form>
      <span className={`min-w-0 flex-1 break-words ${chapter.done ? "line-through opacity-60" : ""}`}>
        {chapter.title}
        {next && <span className="ml-2 text-[11px] text-accent">next</span>}
      </span>
      {week && <WeekChip label={week.label} now={week.now} />}
      <NotesLink link={chapter.link} label="Lessons" />
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Edit Chapter"
        aria-label={`Edit ${chapter.title}`}
        className="text-muted hover:text-foreground"
      >
        ✎
      </button>
      <ConfirmDelete action={deleteChapter} id={chapter.id} what="Chapter" title={chapter.title} />
    </div>
  );
}

function ChapterEditor({ chapter, onDone }: { chapter: ChapterView; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updateChapter({
            id: chapter.id,
            title: String(fd.get("title") ?? ""),
            link: String(fd.get("link") ?? ""),
          });
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
    >
      <input name="title" defaultValue={chapter.title} required maxLength={200} aria-label="Chapter title" className="input min-w-40 flex-1 py-1 text-sm" autoFocus />
      <input name="link" defaultValue={chapter.link} placeholder="obsidian://… (optional)" aria-label="Link to its lessons" className="input min-w-40 flex-1 py-1 text-sm" />
      <button className="btn text-sm" disabled={pending}>
        Save
      </button>
      <button type="button" className="btn text-sm" onClick={onDone}>
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

// ─── Candidates and history ──────────────────────────────────────────────────

function CandidateRow({
  path,
  full,
  onEdit,
  onActivate,
}: {
  path: LearningPathView;
  full: boolean;
  onEdit: () => void;
  onActivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left text-sm">
          <span className="block font-medium break-words">{path.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <GameTags games={path.games} />
            {path.whyNow.trim() && <span className="truncate">{path.whyNow.split("\n")[0]}</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="shrink-0 text-xs text-muted hover:text-foreground"
        >
          {open ? "▾" : "▸"} {path.chapters.length} Chapter{path.chapters.length === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          className="btn shrink-0 px-2 py-0.5 text-xs"
          onClick={onActivate}
          disabled={full}
          title={full ? `${MAX_ACTIVE_PATHS} Paths are already Active` : "Play it now"}
        >
          Activate
        </button>
        <ConfirmDelete action={deleteLearningPath} id={path.id} what="Learning Path" title={path.title} counts="learningPath" />
      </div>
      {open && <ChapterList path={path} today="" nextId={null} reorderable={false} />}
    </div>
  );
}

function ClosedPath({ path }: { path: LearningPathView }) {
  const progress = chapterProgress(path.chapters);
  return (
    <li className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-sm opacity-70">
      <span className="min-w-0 flex-1 break-words">
        {path.title}
        <span className="ml-2 text-xs text-muted">
          {path.status === "done" ? "Done" : "Dropped"} · {progress.done}/{progress.total} Chapters
        </span>
      </span>
      <NotesLink link={path.link} />
      <StatusButton id={path.id} status="candidate" label="Back to Candidates" />
      <ConfirmDelete action={deleteLearningPath} id={path.id} what="Learning Path" title={path.title} counts="learningPath" />
    </li>
  );
}

// ─── Exploration ─────────────────────────────────────────────────────────────

function StartExploration({ today }: { today: string }) {
  return (
    <form action={startExploration} className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="label">Explore freely, with an end date</span>
        <input name="title" required maxLength={200} placeholder="e.g. Remotion for background videos" className="input" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Ends on</span>
        <input name="endsOn" type="date" min={addDays(today, 1)} defaultValue={explorationEndsOn(today)} className="input" />
      </label>
      <button className="btn-primary">Start</button>
    </form>
  );
}

function OpenExploration({ exploration, today }: { exploration: ExplorationView; today: string }) {
  const due = explorationDue(exploration.endsOn, today);
  const left = daysLeft(exploration.endsOn, today);
  return (
    <article className={`card flex flex-col gap-2 ${due ? "border-accent" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="min-w-0 flex-1 font-semibold break-words">{exploration.title}</h3>
        <span className="text-xs text-muted">
          {exploration.startedOn} → {exploration.endsOn}
          {!due && ` · ${left} day${left === 1 ? "" : "s"} left`}
        </span>
      </div>
      <p className="text-sm">{due ? "Time's up. Is it worth a Path?" : "Ready early? Give it its verdict."}</p>
      <div className="flex flex-wrap gap-2">
        <form action={endExploration}>
          <Hidden id={exploration.id} verdict="path" />
          <button className="btn-primary">Worth a Path</button>
        </form>
        <form action={endExploration}>
          <Hidden id={exploration.id} verdict="drop" />
          <button className="btn">Drop it</button>
        </form>
      </div>
    </article>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function PathEditor({
  path,
  activate,
  full,
  blocks,
  campaigns,
  defaultBlockId,
  onClose,
}: {
  path: LearningPathView;
  activate: boolean;
  full: boolean;
  blocks: Block[];
  campaigns: CampaignOption[];
  defaultBlockId: string | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [whyNow, setWhyNow] = useState(path.whyNow);
  const [pending, startTransition] = useTransition();
  const linked = new Set(path.campaigns.map((c) => c.id));
  const choices = [
    ...campaigns,
    // A Campaign closed since it was tied stays visible, so saving never unties it by surprise.
    ...path.campaigns.filter((c) => !campaigns.some((o) => o.id === c.id)).map((c) => ({ ...c, status: "closed" })),
  ];

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function submit(fd: FormData) {
    startTransition(async () => {
      const result = await saveLearningPath({
        id: path.id,
        title: String(fd.get("title") ?? ""),
        whyNow,
        games: fd.getAll("games").map(String),
        blockTypeId: String(fd.get("blockTypeId") ?? "") || null,
        link: String(fd.get("link") ?? ""),
        campaignIds: fd.getAll("campaignIds").map(String),
        activate,
      });
      if (result.ok) dialog.current?.close();
      else setError(result.error);
    });
  }

  return (
    <dialog
      ref={dialog}
      aria-label={activate ? `Activate ${path.title}` : `Edit ${path.title}`}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <form
        className="flex max-h-[85dvh] flex-col gap-3 overflow-y-auto p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
      >
        <h2 className="font-semibold">{activate ? "Activate this Learning Path" : "Learning Path"}</h2>
        {activate && (
          <p className="text-xs text-muted">
            An Active Path needs its why now and its Infinite Games. Its Chapters get their week in the Weekly Review.
          </p>
        )}
        {activate && full && (
          <p className="text-sm text-red-600">
            {MAX_ACTIVE_PATHS} Paths are already Active: finish, stop or drop one first.
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="label">Title</span>
          <input name="title" defaultValue={path.title} required maxLength={200} className="input" />
        </label>
        <div className="flex flex-col gap-1">
          <span className="label">Why now</span>
          <LongText
            value={whyNow}
            onValueChange={setWhyNow}
            rows={3}
            aria-label="Why now"
            placeholder="Why does learning this matter now?"
          />
        </div>
        <GamesPicker selected={path.games} />
        <label className="flex flex-col gap-1">
          <span className="label">Played in</span>
          <select name="blockTypeId" defaultValue={path.block?.id ?? defaultBlockId ?? ""} className="input">
            <option value="">No Block</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="label mb-1">Serves the Campaigns (optional)</legend>
          {choices.length === 0 ? (
            <Empty>No open Campaigns.</Empty>
          ) : (
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {choices.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="campaignIds" value={c.id} defaultChecked={linked.has(c.id)} />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="text-xs text-muted">{c.status === "active" ? "Active" : c.status === "candidate" ? "Candidate" : "Closed"}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="label">Link to its notes</span>
          <input
            name="link"
            defaultValue={path.link}
            placeholder="obsidian://open?vault=…  (Copy Obsidian URL)"
            className="input"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button className="btn-primary" disabled={pending || (activate && full)}>
            {pending ? "Saving…" : activate ? "Activate" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ─── In the Week ─────────────────────────────────────────────────────────────

/** The Chapters chosen for the week, beside the Stack: their time is their Container Block. */
export function WeekChapters({ chapters }: { chapters: WeekChapter[] }) {
  if (chapters.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-2">
      <h3 className="label">Chapters</h3>
      <ul className="flex flex-col gap-1">
        {chapters.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            <form action={toggleChapter} className="flex">
              <Hidden id={c.id} />
              <button aria-label={c.done ? `Mark ${c.title} not done` : `Mark ${c.title} done`}>{c.done ? "☑" : "☐"}</button>
            </form>
            <span className="min-w-0 flex-1">
              <span className={`block break-words ${c.done ? "line-through opacity-60" : ""}`}>{c.title}</span>
              <span className="flex items-center gap-1 text-xs text-muted">
                {c.block && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.block.color }} />}
                <span className="truncate">
                  {c.pathTitle}
                  {c.block && ` · ${c.block.name}`}
                </span>
              </span>
            </span>
            <NotesLink link={c.link} label="Lessons" />
          </li>
        ))}
      </ul>
    </section>
  );
}
