import { OS_PRIMER } from "./context-primer";
import { addDays, formatMinutes, WEEKDAY_NAMES, weekdayOf, type IsoDate, type Weekday } from "./dates";
import type { CampaignStatus } from "./plan";

/**
 * Context: the Markdown about Ivan that he copies into an AI so it can help
 * him think. He picks what goes in, by category or piece by piece. Nothing is
 * saved; it only leaves Ivan OS when he copies it.
 */

export type ContextLink = { title: string; url: string };
export type ContextTask = {
  id: string;
  title: string;
  done: boolean;
  description: string;
  steps: { title: string; done: boolean }[];
  links: ContextLink[];
  games: readonly string[];
};
export type ContextMove = {
  title: string;
  done: boolean;
  weekOf: IsoDate | null;
  description: string;
  links: ContextLink[];
  tasks: ContextTask[];
};
export type ContextCampaign = {
  id: string;
  title: string;
  status: CampaignStatus;
  /** "Q4 2026"; null for a candidate. */
  quarter: string | null;
  seasonGoal: string | null;
  blockType: string | null;
  games: readonly string[];
  goal: string;
  why: string;
  antiGoal: string;
  moves: ContextMove[];
};

/** Everything a Context can be made of, as Ivan OS holds it today. Lists run newest first. */
export type ContextSource = {
  today: IsoDate;
  quarter: { label: string; title: string; body: string };
  season: { title: string; body: string; startedOn: IsoDate; goals: string[] } | null;
  principles: { id: string; title: string; expansion: string }[];
  /** In Ivan's priority. */
  campaigns: ContextCampaign[];
  /** Open loose Tasks of the Backlog, in Ivan's priority. */
  looseTasks: ContextTask[];
  week: {
    weekOf: IsoDate;
    moves: { title: string; done: boolean; campaign: string }[];
    highlights: { date: IsoDate; title: string; why: string; done: boolean }[];
  };
  /** Written Journals only, newest first. */
  journals: { date: IsoDate; text: string }[];
  learning: { id: string; date: IsoDate; title: string; expansion: string }[];
  reviews: { weekOf: IsoDate; feltScore: number; notes: string; moves: string[] }[];
  structure: { weekday: Weekday; startMin: number; endMin: number; type: string; kind: "habit" | "container" }[];
};

export const CONTEXT_CATEGORIES = [
  { key: "os", label: "How my OS works" },
  { key: "season", label: "Season" },
  { key: "principles", label: "Principles" },
  { key: "quarter", label: "This Quarter" },
  { key: "week", label: "This week" },
  { key: "backlog", label: "Backlog" },
  { key: "past", label: "Past Campaigns" },
  { key: "journals", label: "Journals" },
  { key: "learning", label: "Learning entries" },
  { key: "reviews", label: "Weekly Reviews" },
  { key: "structure", label: "My Structure" },
] as const;

export type ContextCategory = (typeof CONTEXT_CATEGORIES)[number]["key"];

/** The categories that take only the last N of their items. */
export const WINDOWED = ["journals", "learning", "reviews"] as const;
export type Windowed = (typeof WINDOWED)[number];
const isWindowed = (key: ContextCategory): key is Windowed => (WINDOWED as readonly string[]).includes(key);

/** One piece of a category that can be picked alone. */
export type ContextItem = { id: string; label: string; detail?: string; text: string };

/**
 * A category is picked whole (`all`, minus `except`) or piece by piece
 * (`only`). An item in `only` stays picked even outside the last N.
 */
export type CategorySelection = { all: boolean; except: string[]; only: string[] };
export type ContextSelection = {
  categories: Record<ContextCategory, CategorySelection>;
  counts: Record<Windowed, number>;
  topic: string;
};

const none = (): CategorySelection => ({ all: false, except: [], only: [] });

export const DEFAULT_COUNTS: Record<Windowed, number> = { journals: 30, learning: 30, reviews: 4 };
export const MAX_COUNT = 999;

export function defaultSelection(): ContextSelection {
  const categories = Object.fromEntries(CONTEXT_CATEGORIES.map((c) => [c.key, none()])) as ContextSelection["categories"];
  categories.os = { all: true, except: [], only: [] };
  return { categories, counts: { ...DEFAULT_COUNTS }, topic: "" };
}

/** A remembered selection, read back safely: anything unknown or broken falls back to the default. */
export function parseSelection(raw: string): ContextSelection {
  const selection = defaultSelection();
  if (!raw) return selection;
  try {
    const value = JSON.parse(raw) as Partial<ContextSelection>;
    for (const { key } of CONTEXT_CATEGORIES) {
      const c = value.categories?.[key];
      if (!c) continue;
      selection.categories[key] = {
        all: c.all === true,
        except: Array.isArray(c.except) ? c.except.filter((id) => typeof id === "string") : [],
        only: Array.isArray(c.only) ? c.only.filter((id) => typeof id === "string") : [],
      };
    }
    for (const key of WINDOWED) selection.counts[key] = clampCount(value.counts?.[key], DEFAULT_COUNTS[key]);
    selection.topic = typeof value.topic === "string" ? value.topic : "";
  } catch {}
  return selection;
}

export function clampCount(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_COUNT, Math.max(1, Math.round(n)));
}

const firstLine = (text: string) => text.trim().split("\n")[0] ?? "";

/** Every piece of a category, the whole history included; empty for a category taken whole. */
export function contextItems(source: ContextSource, key: ContextCategory): ContextItem[] {
  switch (key) {
    case "principles":
      return source.principles.map((p) => ({ id: p.id, label: p.title, text: `${p.title}\n${p.expansion}` }));
    case "quarter":
      return source.campaigns
        .filter((c) => c.status === "active")
        .map((c) => ({ id: c.id, label: c.title, text: campaignText(c) }));
    case "backlog":
      return [
        ...source.campaigns
          .filter((c) => c.status === "candidate")
          .map((c) => ({ id: c.id, label: c.title, detail: "Candidate", text: campaignText(c) })),
        ...source.looseTasks.map((t) => ({
          id: t.id,
          label: t.title,
          detail: "Loose Task",
          text: `${t.title}\n${t.description}`,
        })),
      ];
    case "past":
      return source.campaigns
        .filter((c) => c.status === "done" || c.status === "dropped")
        .map((c) => ({
          id: c.id,
          label: c.title,
          detail: [c.status === "done" ? "Done" : "Dropped", c.quarter].filter(Boolean).join(" · "),
          text: campaignText(c),
        }));
    case "journals":
      return source.journals.map((j) => ({ id: j.date, label: j.date, detail: firstLine(j.text), text: j.text }));
    case "learning":
      return source.learning.map((l) => ({
        id: l.id,
        label: l.title,
        detail: l.date,
        text: `${l.title}\n${l.expansion}`,
      }));
    case "reviews":
      return source.reviews.map((r) => ({
        id: r.weekOf,
        label: `Week of ${r.weekOf}`,
        detail: `Felt ${r.feltScore}/10`,
        text: `${r.notes}\n${r.moves.join("\n")}`,
      }));
    default:
      return [];
  }
}

function campaignText(c: ContextCampaign): string {
  return [c.title, c.goal, c.why, c.antiGoal, ...c.moves.flatMap((m) => [m.title, ...m.tasks.map((t) => t.title)])].join(
    "\n",
  );
}

function windowIds(source: ContextSource, selection: ContextSelection, key: ContextCategory): Set<string> {
  const items = contextItems(source, key);
  return new Set((isWindowed(key) ? items.slice(0, selection.counts[key]) : items).map((i) => i.id));
}

/** The items a category shows: its last N (or all of them), plus any older one picked by search. */
export function visibleItems(source: ContextSource, selection: ContextSelection, key: ContextCategory): ContextItem[] {
  const inWindow = windowIds(source, selection, key);
  const only = new Set(selection.categories[key].only);
  return contextItems(source, key).filter((i) => inWindow.has(i.id) || only.has(i.id));
}

export function isPicked(source: ContextSource, selection: ContextSelection, key: ContextCategory, id: string): boolean {
  const c = selection.categories[key];
  if (c.only.includes(id)) return true;
  return c.all && !c.except.includes(id) && windowIds(source, selection, key).has(id);
}

export type CategoryState = "on" | "some" | "off";

export function categoryState(source: ContextSource, selection: ContextSelection, key: ContextCategory): CategoryState {
  const items = visibleItems(source, selection, key);
  const c = selection.categories[key];
  if (items.length === 0) return c.all ? "on" : "off";
  const picked = items.filter((i) => isPicked(source, selection, key, i.id)).length;
  if (picked === 0) return "off";
  return picked === items.length && c.all ? "on" : "some";
}

function withCategory(selection: ContextSelection, key: ContextCategory, next: CategorySelection): ContextSelection {
  return { ...selection, categories: { ...selection.categories, [key]: next } };
}

/** Checking a category takes all of it; unchecking a whole or half-picked one empties it. */
export function toggleCategory(source: ContextSource, selection: ContextSelection, key: ContextCategory): ContextSelection {
  const state = categoryState(source, selection, key);
  return withCategory(selection, key, state === "on" ? none() : { all: true, except: [], only: [] });
}

export function toggleItem(
  source: ContextSource,
  selection: ContextSelection,
  key: ContextCategory,
  id: string,
): ContextSelection {
  const c = selection.categories[key];
  const inWindow = windowIds(source, selection, key).has(id);
  const without = (ids: string[]) => ids.filter((x) => x !== id);
  if (isPicked(source, selection, key, id)) {
    return withCategory(selection, key, {
      all: c.all,
      only: without(c.only),
      except: c.all && inWindow ? [...without(c.except), id] : c.except,
    });
  }
  return withCategory(
    selection,
    key,
    c.all && inWindow ? { ...c, except: without(c.except) } : { ...c, only: [...without(c.only), id] },
  );
}

/** Pieces whose title or text holds every word of the query, across all history. */
export function searchContext(
  source: ContextSource,
  query: string,
): { key: ContextCategory; label: string; item: ContextItem }[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return CONTEXT_CATEGORIES.flatMap(({ key, label }) =>
    contextItems(source, key)
      .filter((item) => {
        const haystack = `${item.label}\n${item.text}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      })
      .map((item) => ({ key, label, item })),
  );
}

// ─── The Markdown ────────────────────────────────────────────────────────────

const box = (done: boolean) => (done ? "[x]" : "[ ]");
const indent = (text: string, by: number) =>
  text
    .split("\n")
    .map((line) => (line.trim() ? " ".repeat(by) + line : ""))
    .join("\n");
/** Ivan's own text, with its headings pushed below the `level` heading it sits under. */
export function nest(text: string, level: number): string {
  let fenced = false;
  return text
    .trim()
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      return line.replace(/^(\s*)(#{1,6})(?=\s|$)/, (_, space: string, hashes: string) =>
        space + "#".repeat(Math.min(6, hashes.length + level)),
      );
    })
    .join("\n");
}
const link = (l: ContextLink) => (l.title ? `[${l.title}](${l.url})` : `<${l.url}>`);
const longDate = (date: IsoDate) => `${WEEKDAY_NAMES[weekdayOf(date)]}, ${date}`;

function taskLines(task: ContextTask, by: number, level: number): string[] {
  const lines = [`${" ".repeat(by)}- ${box(task.done)} ${task.title}${task.games.length ? ` (${task.games.join(", ")})` : ""}`];
  if (task.description.trim()) lines.push(indent(nest(task.description, level), by + 2));
  for (const step of task.steps) lines.push(`${" ".repeat(by + 2)}- ${box(step.done)} ${step.title}`);
  for (const l of task.links) lines.push(`${" ".repeat(by + 2)}- Link: ${link(l)}`);
  return lines;
}

function campaignBlock(c: ContextCampaign, level: number): string {
  const h = "#".repeat(level);
  const status = { active: "Active", candidate: "Candidate in the Backlog", done: "Done", dropped: "Dropped" }[c.status];
  const facts = [
    status,
    c.quarter,
    c.seasonGoal && `serves the Season Goal "${c.seasonGoal}"`,
    c.blockType && `played in ${c.blockType} Blocks`,
    c.games.length > 0 && `Infinite Games: ${c.games.join(", ")}`,
  ].filter(Boolean);
  const parts = [`${h} ${c.title}`, facts.join(" · ")];
  if (c.goal.trim()) parts.push(`**Goal:** ${nest(c.goal, level)}`);
  if (c.why.trim()) parts.push(`**Why:** ${nest(c.why, level)}`);
  if (c.antiGoal.trim()) parts.push(`**Anti-goal:** ${nest(c.antiGoal, level)}`);
  if (c.moves.length > 0) {
    parts.push(`${h}# Moves`);
    for (const m of c.moves) {
      const lines = [`- ${box(m.done)} **${m.title}**${m.weekOf ? ` (week of ${m.weekOf})` : ""}`];
      if (m.description.trim()) lines.push(indent(nest(m.description, level + 1), 2));
      for (const l of m.links) lines.push(`  - Link: ${link(l)}`);
      for (const t of m.tasks) lines.push(...taskLines(t, 2, level + 1));
      parts.push(lines.join("\n"));
    }
  }
  return parts.join("\n\n");
}

/** The whole Context, ready to paste: an opening line, the picked sections, and what Ivan wants to talk about. */
export function renderContext(source: ContextSource, selection: ContextSelection): string {
  const state = (key: ContextCategory) => categoryState(source, selection, key);
  const picked = (key: ContextCategory) =>
    visibleItems(source, selection, key).filter((i) => isPicked(source, selection, key, i.id));
  const pickedIds = (key: ContextCategory) => new Set(picked(key).map((i) => i.id));

  const where = [
    source.season && `the Season "${source.season.title}"`,
    source.quarter.label,
    `the week of ${source.week.weekOf}`,
  ].filter(Boolean);
  const sections = [
    `# Context about me\n\nThis is context about me, Ivan, from my personal OS, Ivan OS. Today is ${longDate(source.today)}. I am in ${where.join(", ")}.`,
  ];

  if (state("os") !== "off") sections.push(`## How my OS works\n\n${OS_PRIMER}`);

  if (state("season") !== "off") {
    if (source.season) {
      const parts = [`## Season: ${source.season.title}`, `Started on ${source.season.startedOn}.`];
      if (source.season.body.trim()) parts.push(nest(source.season.body, 2));
      if (source.season.goals.length > 0)
        parts.push(`### Season Goals\n\n${source.season.goals.map((g) => `- ${g}`).join("\n")}`);
      sections.push(parts.join("\n\n"));
    } else sections.push("## Season\n\nNo Season is active.");
  }

  if (picked("principles").length > 0) {
    const ids = pickedIds("principles");
    const parts = ["## Principles"];
    source.principles.forEach((p, index) => {
      if (!ids.has(p.id)) return;
      parts.push(`### ${index + 1}. ${p.title}${p.expansion.trim() ? `\n\n${nest(p.expansion, 3)}` : ""}`);
    });
    sections.push(parts.join("\n\n"));
  }

  if (state("quarter") !== "off") {
    const ids = pickedIds("quarter");
    const q = source.quarter;
    const parts = [`## This Quarter: ${q.label}${q.title.trim() ? ` — ${q.title.trim()}` : ""}`];
    if (q.body.trim()) parts.push(nest(q.body, 2));
    const campaigns = source.campaigns.filter((c) => ids.has(c.id));
    parts.push(
      campaigns.length > 0
        ? `Active Campaigns, in my priority:\n\n${campaigns.map((c) => campaignBlock(c, 3)).join("\n\n")}`
        : "No active Campaign picked.",
    );
    sections.push(parts.join("\n\n"));
  }

  if (state("week") !== "off") {
    const w = source.week;
    const parts = [`## This week (week of ${w.weekOf})`];
    parts.push(
      w.moves.length > 0
        ? `### Moves chosen\n\n${w.moves.map((m) => `- ${box(m.done)} ${m.title} (${m.campaign})`).join("\n")}`
        : "### Moves chosen\n\nNone yet.",
    );
    if (w.highlights.length > 0) {
      const lines = w.highlights.map((h) => {
        const why = h.why.trim() ? `\n${indent(nest(h.why, 3), 2)}` : "";
        return `- ${h.date}: ${box(h.done)} ${h.title}${why}`;
      });
      parts.push(`### Highlights\n\n${lines.join("\n")}`);
    }
    sections.push(parts.join("\n\n"));
  }

  if (picked("backlog").length > 0) {
    const ids = pickedIds("backlog");
    const parts = ["## Backlog", "Ideas for a future Quarter and loose Tasks, not in play yet."];
    const candidates = source.campaigns.filter((c) => c.status === "candidate" && ids.has(c.id));
    if (candidates.length > 0)
      parts.push(`### Candidate Campaigns\n\n${candidates.map((c) => campaignBlock(c, 4)).join("\n\n")}`);
    const loose = source.looseTasks.filter((t) => ids.has(t.id));
    if (loose.length > 0) parts.push(`### Loose Tasks\n\n${loose.flatMap((t) => taskLines(t, 0, 3)).join("\n")}`);
    sections.push(parts.join("\n\n"));
  }

  if (picked("past").length > 0) {
    const ids = pickedIds("past");
    const past = source.campaigns.filter((c) => (c.status === "done" || c.status === "dropped") && ids.has(c.id));
    sections.push(["## Past Campaigns", ...past.map((c) => campaignBlock(c, 3))].join("\n\n"));
  }

  if (picked("journals").length > 0) {
    const ids = pickedIds("journals");
    const journals = source.journals.filter((j) => ids.has(j.date));
    sections.push(
      [
        "## Journals",
        "My nightly self-reflection, newest first.",
        ...journals.map((j) => `### ${longDate(j.date)}\n\n${nest(j.text, 3)}`),
      ].join("\n\n"),
    );
  }

  if (picked("learning").length > 0) {
    const ids = pickedIds("learning");
    const entries = source.learning.filter((l) => ids.has(l.id));
    sections.push(
      [
        "## Learning entries",
        "Ideas, reflections and things I learned, captured during the day, newest first.",
        ...entries.map((l) => `### ${l.title} (${l.date})${l.expansion.trim() ? `\n\n${nest(l.expansion, 3)}` : ""}`),
      ].join("\n\n"),
    );
  }

  if (picked("reviews").length > 0) {
    const ids = pickedIds("reviews");
    const reviews = source.reviews.filter((r) => ids.has(r.weekOf));
    sections.push(
      [
        "## Weekly Reviews",
        "How aligned each week felt (1–10), my notes, and the Moves I chose for the next week.",
        ...reviews.map((r) => {
          const parts = [`### Week of ${r.weekOf}: felt ${r.feltScore}/10`];
          if (r.notes.trim()) parts.push(nest(r.notes, 3));
          if (r.moves.length > 0) parts.push(`Moves chosen for the week of ${addDays(r.weekOf, 7)}: ${r.moves.join("; ")}`);
          return parts.join("\n\n");
        }),
      ].join("\n\n"),
    );
  }

  if (state("structure") !== "off") {
    const parts = ["## My Structure", "My weekly template of Blocks: a nudge, not a rule."];
    for (const day of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) {
      const blocks = source.structure.filter((b) => b.weekday === day);
      if (blocks.length === 0) continue;
      const lines = blocks.map(
        (b) => `- ${formatMinutes(b.startMin)}–${formatMinutes(b.endMin)} ${b.type} (${b.kind === "habit" ? "Habit" : "Container"})`,
      );
      parts.push(`### ${WEEKDAY_NAMES[day]}\n\n${lines.join("\n")}`);
    }
    if (parts.length === 2) parts.push("No Blocks yet.");
    sections.push(parts.join("\n\n"));
  }

  if (selection.topic.trim()) sections.push(`## What I want to talk about\n\n${nest(selection.topic, 2)}`);

  return `${sections.join("\n\n")}\n`;
}

/** How big a Context is: its words, and roughly its tokens (about 4 characters each). */
export function contextSize(markdown: string): { words: number; tokens: number } {
  return { words: markdown.split(/\s+/).filter(Boolean).length, tokens: Math.ceil(markdown.length / 4) };
}
