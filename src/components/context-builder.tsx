"use client";

import { useMemo, useState } from "react";
import {
  categoryState,
  clampCount,
  CONTEXT_CATEGORIES,
  contextItems,
  contextSize,
  DEFAULT_COUNTS,
  isPicked,
  MAX_COUNT,
  parseSelection,
  renderContext,
  searchContext,
  toggleCategory,
  toggleItem,
  visibleItems,
  WHOLE_CATEGORIES,
  WINDOWED,
  type CategoryState,
  type ContextCategory,
  type ContextItem,
  type ContextSelection,
  type ContextSource,
  type Windowed,
} from "@/domain/context";
import { useRemembered } from "./use-remembered";

const isWindowed = (key: ContextCategory): key is Windowed => (WINDOWED as readonly string[]).includes(key);

function Check({
  state,
  disabled,
  onChange,
  label,
}: {
  state: CategoryState;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={state === "on"}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = state === "some";
      }}
      onChange={onChange}
      className="size-4 shrink-0 accent-accent disabled:opacity-40"
    />
  );
}

function ItemRow({
  item,
  picked,
  onToggle,
  tag,
}: {
  item: ContextItem;
  picked: boolean;
  onToggle: () => void;
  tag?: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-baseline gap-2 rounded px-1 py-0.5 text-sm hover:bg-background">
      <input type="checkbox" checked={picked} onChange={onToggle} className="size-3.5 shrink-0 translate-y-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {(tag || item.detail) && (
          <span className="block truncate text-xs text-muted">{[tag, item.detail].filter(Boolean).join(" · ")}</span>
        )}
      </span>
    </label>
  );
}

/**
 * Builds a Context: Ivan picks categories, or single pieces of them (searching
 * the whole history), and copies the Markdown into an AI. What he picks is
 * remembered on this device; the Context itself is never saved.
 */
export function ContextBuilder({ source }: { source: ContextSource }) {
  const [raw, setRaw] = useRemembered("ivan-os:context-selection");
  const selection = useMemo(() => parseSelection(raw), [raw]);
  const save = (next: ContextSelection) => setRaw(JSON.stringify(next));
  const [open, setOpen] = useState<ContextCategory[]>([]);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  const markdown = useMemo(() => renderContext(source, selection), [source, selection]);
  const size = contextSize(markdown);
  const found = useMemo(() => searchContext(source, query), [source, query]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 2000);
  }

  const toggleOpen = (key: ContextCategory) =>
    setOpen((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Generate my context</h2>
        <p className="text-sm text-muted">
          Pick what an AI should know about you, then copy it. Nothing is saved or sent; it only leaves Ivan OS when you
          copy it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search everything (an old idea, a Journal…)"
            aria-label="Search everything"
            className="input"
          />

          {query.trim() ? (
            <div className="flex flex-col gap-0.5">
              {found.length === 0 && <p className="text-sm text-muted">Nothing found.</p>}
              {found.slice(0, 50).map(({ key, label, item }) => (
                <ItemRow
                  key={`${key}:${item.id}`}
                  item={item}
                  tag={label}
                  picked={isPicked(source, selection, key, item.id)}
                  onToggle={() => save(toggleItem(source, selection, key, item.id))}
                />
              ))}
              {found.length > 50 && <p className="text-xs text-muted">{found.length - 50} more: add a word.</p>}
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {CONTEXT_CATEGORIES.map(({ key, label }) => {
                const whole = WHOLE_CATEGORIES.includes(key);
                const items = whole ? [] : visibleItems(source, selection, key);
                const all = whole ? 0 : contextItems(source, key).length;
                const state = categoryState(source, selection, key);
                const picked = items.filter((i) => isPicked(source, selection, key, i.id)).length;
                // A Quarter with no active Campaign still has its own text to give.
                const empty = !whole && key !== "quarter" && all === 0;
                const expanded = open.includes(key) && items.length > 0;
                return (
                  <li key={key} className="rounded-md border border-line px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Check
                        label={label}
                        state={state}
                        disabled={empty}
                        onChange={() => save(toggleCategory(source, selection, key))}
                      />
                      <button
                        type="button"
                        onClick={() => items.length > 0 && toggleOpen(key)}
                        aria-expanded={items.length > 0 ? expanded : undefined}
                        className={`flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium ${empty ? "text-muted" : ""}`}
                      >
                        {items.length > 0 && <span className="w-3 text-xs text-muted">{expanded ? "▾" : "▸"}</span>}
                        <span className="truncate">{label}</span>
                        {!whole && (
                          <span className="text-xs font-normal text-muted">
                            {empty ? "none yet" : `${picked}/${items.length}`}
                          </span>
                        )}
                      </button>
                      {isWindowed(key) && (
                        <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                          last
                          <input
                            type="number"
                            min={1}
                            max={MAX_COUNT}
                            value={selection.counts[key]}
                            onChange={(event) =>
                              save({
                                ...selection,
                                counts: {
                                  ...selection.counts,
                                  [key]: clampCount(event.target.value, DEFAULT_COUNTS[key]),
                                },
                              })
                            }
                            aria-label={`How many ${label}`}
                            className="input w-16 px-1 py-0.5 text-xs"
                          />
                        </label>
                      )}
                    </div>
                    {expanded && (
                      <div className="mt-1 ml-6 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                        {items.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            picked={isPicked(source, selection, key, item.id)}
                            onToggle={() => save(toggleItem(source, selection, key, item.id))}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="label">What I want to talk about (optional)</span>
            <textarea
              value={selection.topic}
              onChange={(event) => save({ ...selection, topic: event.target.value })}
              rows={2}
              placeholder="e.g. Help me revive this idea"
              className="input resize-y"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={copy} className="btn-primary min-h-10 px-4">
              {copied === "yes" ? "Copied ✓" : "Copy"}
            </button>
            <span className="text-xs text-muted">
              {size.words.toLocaleString("en-US")} words · ~{size.tokens.toLocaleString("en-US")} tokens
            </span>
            {copied === "failed" && (
              <span className="text-xs text-red-600">Could not copy: select the text below and copy it.</span>
            )}
          </div>
          <pre
            aria-label="Context preview"
            className="max-h-[70vh] min-h-48 overflow-auto rounded-md border border-line bg-background p-3 text-xs leading-relaxed break-words whitespace-pre-wrap"
          >
            {markdown}
          </pre>
        </div>
      </div>
    </section>
  );
}
