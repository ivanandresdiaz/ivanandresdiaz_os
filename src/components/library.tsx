"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { useState, useTransition } from "react";
import {
  ACCEPTED_SAMPLE_TYPES,
  MAX_LIBRARY_NAME,
  MAX_SAMPLE_TITLE,
  sampleKindOf,
  validateSampleFile,
} from "@/domain/library";
import { referenceContentType } from "@/domain/references";
import { pasteLink } from "@/server/clip-actions";
import { trimSample } from "@/server/trim-actions";
import {
  confirmSampleUpload,
  createCreator,
  createSampleUpload,
  createTopic,
  deleteCreator,
  deleteSample,
  deleteTopic,
  moveClipToCreator,
  moveCreator,
  renameCreator,
  renameSample,
  renameTopic,
  reorderCreators,
  reorderSamples,
  reorderTopics,
} from "@/server/library-actions";
import type { CreatorView, SampleView, TopicView } from "@/server/library";
import { ClipPicker } from "./clip-picker";
import { ConfirmDelete } from "./confirm-delete";
import { IncomingList, PasteLink } from "./incoming";
import { Handle, Reorderable } from "./priority-list";
import { MediaUploader } from "./references";
import { TrimButton, TrimState } from "./trim";
import { AddIconButton } from "./ui";

const SAMPLE_PROBLEM = {
  "unsupported-type": "Only JPG, PNG, WebP, GIF, MP4, WebM or MOV.",
  empty: "The file is empty.",
  "too-large": "Over 200 MB.",
} as const;

export const UNTITLED_SAMPLE = "Untitled";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** Topics, their Creators and their Samples, each in the order Ivan drags. One Topic and one Creator open at a time. */
export function Library({ topics }: { topics: TopicView[] }) {
  const [openTopic, setOpenTopic] = useState<string | null>(topics.length === 1 ? topics[0].id : null);
  const [openCreator, setOpenCreator] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Topics</h2>
        <AddIconButton label="Add Topic" onClick={() => setAdding(true)} />
      </div>
      {adding && (
        <NameForm
          placeholder="Topic, e.g. Sales"
          onCancel={() => setAdding(false)}
          onSave={async (title) => {
            await createTopic({ title });
            setAdding(false);
          }}
        />
      )}
      {topics.length === 0 && !adding && (
        <p className="text-sm text-muted">
          No Topics yet. Add one (e.g. Sales), then its Creators, then upload their reels or bring them from Clips.
        </p>
      )}
      <Reorderable items={topics} save={(ids) => reorderTopics({ ids })}>
        {(shown) => (
          <ul className="flex flex-col gap-3">
            {shown.map((topic, i) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                index={i}
                topics={topics}
                open={openTopic === topic.id}
                onToggle={() => setOpenTopic((id) => (id === topic.id ? null : topic.id))}
                openCreator={openCreator}
                onToggleCreator={(id) => setOpenCreator((open) => (open === id ? null : id))}
              />
            ))}
          </ul>
        )}
      </Reorderable>
    </div>
  );
}

function TopicRow({
  topic,
  index,
  topics,
  open,
  onToggle,
  openCreator,
  onToggleCreator,
}: {
  topic: TopicView;
  index: number;
  topics: TopicView[];
  open: boolean;
  onToggle: () => void;
  openCreator: string | null;
  onToggleCreator: (id: string) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: topic.id, index });
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const samples = topic.creators.reduce((n, c) => n + c.samples.length, 0);

  return (
    <li ref={ref} className={`card flex flex-col gap-3 ${isDragging ? "shadow-lg ring-1 ring-accent" : ""}`}>
      <div className="flex items-center gap-2">
        <Handle ref={handleRef} title={topic.title} className="-my-2 -ml-2 min-h-11 w-8 text-lg" />
        {renaming ? (
          <div className="min-w-0 flex-1">
            <NameForm
              initial={topic.title}
              onCancel={() => setRenaming(false)}
              onSave={async (title) => {
                await renameTopic({ id: topic.id, title });
                setRenaming(false);
              }}
            />
          </div>
        ) : (
          <>
            <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
              <div className="font-medium break-words hover:text-accent">{topic.title}</div>
              <div className="text-xs text-muted">
                {plural(topic.creators.length, "Creator")} · {plural(samples, "Sample")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Rename"
              aria-label={`Rename ${topic.title}`}
              className="text-muted hover:text-foreground"
            >
              ✎
            </button>
            <ConfirmDelete action={deleteTopic} id={topic.id} what="Topic" title={topic.title} counts="topic" />
          </>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex items-center gap-2">
            <span className="label">Creators</span>
            <AddIconButton label="Add Creator" onClick={() => setAdding(true)} />
          </div>
          {adding && (
            <NameForm
              placeholder="Creator's name"
              onCancel={() => setAdding(false)}
              onSave={async (name) => {
                await createCreator({ topicId: topic.id, name });
                setAdding(false);
              }}
            />
          )}
          {topic.creators.length === 0 && !adding && (
            <p className="text-sm text-muted">
              No Creators yet. For content with no known author, make one like “Varios”.
            </p>
          )}
          <Reorderable
            items={topic.creators.map((c) => ({ ...c, title: c.name }))}
            save={(ids) => reorderCreators({ topicId: topic.id, ids })}
          >
            {(shown) => (
              <ul className="flex flex-col gap-2">
                {shown.map((creator, i) => (
                  <CreatorRow
                    key={creator.id}
                    creator={creator}
                    index={i}
                    topics={topics}
                    open={openCreator === creator.id}
                    onToggle={() => onToggleCreator(creator.id)}
                  />
                ))}
              </ul>
            )}
          </Reorderable>
        </div>
      )}
    </li>
  );
}

function CreatorRow({
  creator,
  index,
  topics,
  open,
  onToggle,
}: {
  creator: CreatorView;
  index: number;
  topics: TopicView[];
  open: boolean;
  onToggle: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: creator.id, index });
  const [mode, setMode] = useState<"rename" | "move" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <li
      ref={ref}
      className={`flex flex-col gap-2 rounded-md border border-line bg-background/60 p-2 ${
        isDragging ? "shadow-lg ring-1 ring-accent" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Handle ref={handleRef} title={creator.name} className="-my-1 min-h-10 w-6" />
        {mode === "rename" ? (
          <div className="min-w-0 flex-1">
            <NameForm
              initial={creator.name}
              onCancel={() => setMode(null)}
              onSave={async (name) => {
                await renameCreator({ id: creator.id, name });
                setMode(null);
              }}
            />
          </div>
        ) : (
          <>
            <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
              <div className="text-sm font-medium break-words hover:text-accent">{creator.name}</div>
              <div className="text-xs text-muted">
                {plural(creator.samples.length, "Sample")}
                {creator.incoming.length > 0 && ` · ${creator.incoming.length} on the way`}
                {creator.account && ` · @${creator.account}`}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("rename")}
              title="Rename"
              aria-label={`Rename ${creator.name}`}
              className="text-muted hover:text-foreground"
            >
              ✎
            </button>
            {topics.length > 1 && (
              <button
                type="button"
                onClick={() => setMode(mode === "move" ? null : "move")}
                title="Move to another Topic"
                aria-label={`Move ${creator.name} to another Topic`}
                className="text-muted hover:text-foreground"
              >
                ⇄
              </button>
            )}
            <ConfirmDelete
              action={deleteCreator}
              id={creator.id}
              what="Creator"
              title={creator.name}
              counts="creator"
            />
          </>
        )}
      </div>

      {mode === "move" && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Move to</span>
          <select
            className="input py-1 text-sm"
            defaultValue=""
            disabled={pending}
            aria-label="Topic"
            onChange={(event) => {
              const topicId = event.target.value;
              if (!topicId) return;
              startTransition(async () => {
                await moveCreator({ id: creator.id, topicId });
                setMode(null);
              });
            }}
          >
            <option value="">Choose a Topic</option>
            {topics
              .filter((t) => t.id !== creator.topicId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
          <button type="button" className="text-muted hover:text-foreground" onClick={() => setMode(null)}>
            Cancel
          </button>
        </label>
      )}

      {open && (
        <div className="flex flex-col gap-2">
          <PasteLink paste={(link) => pasteLink({ link, creatorId: creator.id })} />
          <IncomingList incoming={creator.incoming} />
          {creator.samples.length > 0 && (
            <Reorderable items={creator.samples} save={(ids) => reorderSamples({ creatorId: creator.id, ids })}>
              {(shown) => (
                <ul className="flex flex-col gap-1.5">
                  {shown.map((sample, i) => (
                    <SampleRow key={sample.id} sample={sample} index={i} />
                  ))}
                </ul>
              )}
            </Reorderable>
          )}
          <MediaUploader
            accept={ACCEPTED_SAMPLE_TYPES}
            label="Drop reels, videos or images, or click to choose"
            check={(file) => {
              const contentType = referenceContentType(file);
              const problem = validateSampleFile({ contentType, size: file.size });
              return { contentType, problem: problem && SAMPLE_PROBLEM[problem] };
            }}
            create={(contentType, size) => createSampleUpload({ creatorId: creator.id, contentType, size })}
            confirm={(key, contentType, title) =>
              confirmSampleUpload({ creatorId: creator.id, key, contentType, title })
            }
          />
          <ClipPicker what="Sample" move={(clipId) => moveClipToCreator({ clipId, creatorId: creator.id })} />
        </div>
      )}
    </li>
  );
}

function SampleRow({ sample, index }: { sample: SampleView; index: number }) {
  const { ref, handleRef, isDragging } = useSortable({ id: sample.id, index });
  const title = sample.title || UNTITLED_SAMPLE;
  return (
    <li
      ref={ref}
      className={`flex items-center gap-2 rounded ${isDragging ? "bg-background shadow-lg ring-1 ring-accent" : ""}`}
    >
      <Handle ref={handleRef} title={title} className="-my-1 min-h-10 w-6" />
      <a href={sample.url} target="_blank" rel="noreferrer" className="block shrink-0" aria-label={`Open ${title}`}>
        <SampleThumb sample={sample} />
      </a>
      <div className="flex min-w-0 flex-1 flex-col">
        <SampleTitle sample={sample} />
        <TrimState trim={sample.trim} className="px-1 text-xs" />
      </div>
      {sample.kind === "video" && (
        <TrimButton
          url={sample.url}
          kind="video"
          title={title}
          trim={sample.trim}
          onTrim={(range) => trimSample({ id: sample.id, ...range })}
        />
      )}
      <ConfirmDelete action={deleteSample} id={sample.id} what="Sample" title={title} />
    </li>
  );
}

export function SampleThumb({ sample, className = "w-10" }: { sample: SampleView; className?: string }) {
  const box = `aspect-[9/16] ${className} shrink-0 overflow-hidden rounded bg-line object-cover`;
  if (sampleKindOf(sample.contentType) === "video") {
    return (
      <video
        src={`${sample.url}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        className={`${box} pointer-events-none`}
      />
    );
  }
  // Signed R2 links expire, so they bypass the Next.js image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={sample.url} alt="" loading="lazy" className={box} />;
}

/** Saves on blur or Enter; Escape goes back to the saved title. */
function SampleTitle({ sample }: { sample: SampleView }) {
  const [value, setValue] = useState(sample.title);
  return (
    <input
      value={value}
      maxLength={MAX_SAMPLE_TITLE}
      aria-label="Sample title"
      placeholder={UNTITLED_SAMPLE}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.preventDefault();
          setValue(sample.title);
        }
      }}
      onBlur={() => {
        const next = value.trim();
        setValue(next);
        if (next !== sample.title) renameSample({ id: sample.id, title: next });
      }}
      className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-line focus:border-line"
    />
  );
}

/** A short name, saved with Enter; Escape cancels. */
function NameForm({
  initial = "",
  placeholder,
  onSave,
  onCancel,
}: {
  initial?: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const clean = value.trim();
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (!clean || clean === initial) return onCancel();
        startTransition(async () => {
          try {
            await onSave(clean);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't save it.");
          }
        });
      }}
    >
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && onCancel()}
          maxLength={MAX_LIBRARY_NAME}
          placeholder={placeholder}
          autoFocus
          aria-label={placeholder ?? "Name"}
          className="input min-w-0 flex-1 py-1 text-sm"
        />
        <button className="btn text-sm" disabled={!clean || pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
