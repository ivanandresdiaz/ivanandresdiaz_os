import "server-only";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { ContextSource, ContextTask } from "@/domain/context";
import type { PassphraseRecord } from "@/domain/vault";
import {
  addDays,
  localMoment,
  quarterLabel,
  quarterOf,
  startOfWeek,
  type IsoDate,
  type QuarterNumber,
  type QuarterRef,
} from "@/domain/dates";
import { cyclePhase, focusSpanOn, isComplete, realFocusMin, startDelayMin } from "@/domain/cycles";
import { normalizeGames, type InfiniteGame } from "@/domain/infinite-games";
import { carriedOver, type CarriedOver, placedOn, unplaced, type WorkKind } from "@/domain/slots";
import {
  resolveDayBlocks,
  type BlockKind,
  type DayBlock,
  type StructureBlock,
  type StructureException,
} from "@/domain/structure";
import { FEED_SIZE, feedSeen, likeAverages, pickFeed, topReferences, type LikeAverages } from "@/domain/feed";
import { isDayWon } from "@/domain/highlights";
import { inPlay, inPriority } from "@/domain/plan";
import { referenceKindOf, type ReferenceKind } from "@/domain/references";
import { type FinishedReview, movesOfWeek, type ReviewMove, reviewHistory } from "@/domain/reviews";
import { type SecondaryTask, secondaryTaskDate, secondaryTasksForDate } from "@/domain/secondary-tasks";
import type { UpkeepRef } from "@/domain/upkeeps";
import { presignView } from "@/lib/r2";
import { APP_TIMEZONE, today } from "@/lib/today";
import { isConnected } from "./google-calendar";

export type BlockType = {
  id: string;
  name: string;
  kind: BlockKind;
  color: string;
  games: InfiniteGame[];
  archived: boolean;
};

function toBlockType(row: typeof s.blockTypes.$inferSelect): BlockType {
  return { ...row, games: normalizeGames(row.games) };
}

function toStructureBlock(row: typeof s.structureBlocks.$inferSelect): StructureBlock {
  return { ...row, weekday: row.weekday as StructureBlock["weekday"] };
}

export async function getPrinciples() {
  return db.select().from(s.principles).orderBy(asc(s.principles.position));
}

export type ReferenceView = { id: string; kind: ReferenceKind; contentType: string; title: string; url: string };
export type PrincipleView = { id: string; title: string; body: string; references: ReferenceView[] };

/** Principles with their References, each signed for viewing. */
export async function getPrincipleViews(): Promise<PrincipleView[]> {
  const [principles, references] = await Promise.all([
    getPrinciples(),
    db
      .select()
      .from(s.principleReferences)
      .orderBy(asc(s.principleReferences.position), asc(s.principleReferences.createdAt)),
  ]);
  const signed = await Promise.all(
    references.map(async (r) => ({
      principleId: r.principleId,
      view: {
        id: r.id,
        kind: referenceKindOf(r.contentType) ?? "image",
        contentType: r.contentType,
        title: r.title ?? "",
        url: await presignView(r.key),
      },
    })),
  );
  return principles.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    references: signed.filter((r) => r.principleId === p.id).map((r) => r.view),
  }));
}

// ─── Feed ────────────────────────────────────────────────────────────────────

export type FeedItem = ReferenceView & { principleTitle: string };
/** Per Reference: its Like Average (null before its first finished day), and the Likes given today. */
export type FeedLikes = Record<string, { average: number | null; today: number }>;
export type TopReference = FeedItem & { average: number };
export type FeedView = {
  date: IsoDate;
  items: FeedItem[];
  likes: FeedLikes;
  position: number;
  seen: number;
  top: TopReference[];
};

/** Every Like Average as of the start of `date`: today only counts once it is over. */
async function likeAveragesBefore(date: IsoDate) {
  const [feeds, likes] = await Promise.all([
    db
      .select({ date: s.feeds.date, referenceIds: s.feeds.referenceIds, seen: s.feeds.seen })
      .from(s.feeds)
      .where(lt(s.feeds.date, date)),
    db
      .select({ referenceId: s.referenceLikes.referenceId, date: s.referenceLikes.date, count: s.referenceLikes.count })
      .from(s.referenceLikes)
      .where(lt(s.referenceLikes.date, date)),
  ]);
  return likeAverages(feeds, likes);
}

/** References with their Principle's title, signed for viewing, in the order of `ids`. */
async function feedItems(ids: string[]): Promise<FeedItem[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ reference: s.principleReferences, principleTitle: s.principles.title })
    .from(s.principleReferences)
    .innerJoin(s.principles, eq(s.principles.id, s.principleReferences.principleId))
    .where(inArray(s.principleReferences.id, ids));
  const byId = new Map(rows.map((r) => [r.reference.id, r]));
  return Promise.all(
    ids.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      const r = row.reference;
      return [
        presignView(r.key).then((url) => ({
          id: r.id,
          kind: referenceKindOf(r.contentType) ?? "image",
          contentType: r.contentType,
          title: r.title ?? "",
          url,
          principleTitle: row.principleTitle,
        })),
      ];
    }),
  );
}

/** The Top 10, with the Like Average of each. */
async function getTopReferences(averages: LikeAverages): Promise<TopReference[]> {
  const items = await feedItems(topReferences(averages));
  return items.map((item) => ({ ...item, average: averages.get(item.id)?.average ?? 0 }));
}

/** Today's Feed, drawn the first time it is opened and fixed for the rest of the day. */
export async function getTodayFeed(): Promise<FeedView> {
  const date = today();
  const [averages, [drawn]] = await Promise.all([
    likeAveragesBefore(date),
    db.select().from(s.feeds).where(eq(s.feeds.date, date)),
  ]);
  let feed = drawn;
  if (!feed) {
    const references = await db.select({ id: s.principleReferences.id }).from(s.principleReferences);
    const ids = pickFeed(
      references.map((r) => r.id),
      averages,
      Math.random,
    );
    // An empty Feed is not saved, so the first upload of the day can still fill it.
    if (ids.length > 0) {
      await db.insert(s.feeds).values({ date, referenceIds: ids }).onConflictDoNothing();
      [feed] = await db.select().from(s.feeds).where(eq(s.feeds.date, date));
    }
  }
  const ids = feed?.referenceIds ?? [];
  const [items, todays, top] = await Promise.all([
    feedItems(ids),
    db
      .select({ id: s.referenceLikes.referenceId, count: s.referenceLikes.count })
      .from(s.referenceLikes)
      .where(eq(s.referenceLikes.date, date)),
    getTopReferences(averages),
  ]);
  const givenToday = new Map(todays.map((l) => [l.id, l.count]));
  // Every counted Reference, not only today's: the Top 10 plays with the same Likes.
  const counted = new Set([...ids, ...averages.keys()]);
  return {
    date,
    items,
    likes: Object.fromEntries(
      [...counted].map((id) => [id, { average: averages.get(id)?.average ?? null, today: givenToday.get(id) ?? 0 }]),
    ),
    position: Math.min(feed?.position ?? 0, items.length),
    seen: feedSeen(feed?.seen ?? 0, items.length),
    top,
  };
}

/** How far the Feed of a date went, without drawing it; null when there is nothing to watch. */
export async function getFeedProgress(date: IsoDate) {
  const [feed] = await db.select().from(s.feeds).where(eq(s.feeds.date, date));
  if (feed) {
    const [{ live }] = feed.referenceIds.length
      ? await db
          .select({ live: count() })
          .from(s.principleReferences)
          .where(inArray(s.principleReferences.id, feed.referenceIds))
      : [{ live: 0 }];
    return live > 0 ? { seen: feedSeen(feed.seen, live), total: live } : null;
  }
  const [{ total }] = await db.select({ total: count() }).from(s.principleReferences);
  return total > 0 ? { seen: 0, total: Math.min(total, FEED_SIZE) } : null;
}

export async function getActiveSeason() {
  const [season] = await db.select().from(s.seasons).where(isNull(s.seasons.endedOn)).limit(1);
  if (!season) return null;
  const goals = await db
    .select()
    .from(s.seasonGoals)
    .where(eq(s.seasonGoals.seasonId, season.id))
    .orderBy(asc(s.seasonGoals.position));
  return { ...season, goals };
}

/** Every Season with its Goals, the newest first: the active one, then the closed ones. */
export async function getSeasons() {
  const [seasons, goals] = await Promise.all([
    db.select().from(s.seasons).orderBy(desc(s.seasons.startedOn), desc(s.seasons.createdAt)),
    db.select().from(s.seasonGoals).orderBy(asc(s.seasonGoals.position)),
  ]);
  return seasons.map((season) => ({ ...season, goals: goals.filter((g) => g.seasonId === season.id) }));
}

export type SeasonView = Awaited<ReturnType<typeof getSeasons>>[number];

/** The Quarters that exist: the ones Ivan wrote in or gave a Campaign. */
export async function getQuarters() {
  const rows = await db.select().from(s.quarters);
  return rows.map((row) => ({ ...row, ref: { year: row.year, quarter: row.quarter } as QuarterRef }));
}

export async function getQuarter(ref: QuarterRef) {
  const [quarter] = await db
    .select()
    .from(s.quarters)
    .where(and(eq(s.quarters.year, ref.year), eq(s.quarters.quarter, ref.quarter)));
  return quarter ?? null;
}

export async function getBlockTypes(): Promise<BlockType[]> {
  const rows = await db.select().from(s.blockTypes).orderBy(asc(s.blockTypes.createdAt));
  return rows.map(toBlockType);
}

export async function getCampaigns(filter: { quarterId: string } | { candidates: true }) {
  const where =
    "quarterId" in filter
      ? eq(s.campaigns.quarterId, filter.quarterId)
      : eq(s.campaigns.status, "candidate");
  return db
    .select()
    .from(s.campaigns)
    .where(where)
    .orderBy(asc(s.campaigns.position), asc(s.campaigns.createdAt));
}

/** A Link as shown: its address and its optional title. */
export type LinkView = { id: string; url: string; title: string };

/** The Links of some Tasks and Moves, in Ivan's order. */
async function getLinks(owner: { taskIds?: string[]; moveIds?: string[] }) {
  const { taskIds = [], moveIds = [] } = owner;
  if (taskIds.length === 0 && moveIds.length === 0) return [];
  return db
    .select()
    .from(s.links)
    .where(
      or(
        taskIds.length ? inArray(s.links.taskId, taskIds) : undefined,
        moveIds.length ? inArray(s.links.moveId, moveIds) : undefined,
      ),
    )
    .orderBy(asc(s.links.position), asc(s.links.createdAt));
}

function linkView(row: typeof s.links.$inferSelect): LinkView {
  return { id: row.id, url: row.url, title: row.title };
}

export async function getCampaignDetail(id: string) {
  const [campaign] = await db.select().from(s.campaigns).where(eq(s.campaigns.id, id));
  if (!campaign) return null;
  const moves = await db
    .select()
    .from(s.moves)
    .where(eq(s.moves.campaignId, id))
    .orderBy(asc(s.moves.position), asc(s.moves.createdAt));
  const tasks = moves.length
    ? await db
        .select()
        .from(s.tasks)
        .where(inArray(s.tasks.moveId, moves.map((m) => m.id)))
        .orderBy(asc(s.tasks.position), asc(s.tasks.createdAt))
    : [];
  const steps = tasks.length
    ? await db
        .select()
        .from(s.steps)
        .where(inArray(s.steps.taskId, tasks.map((t) => t.id)))
        .orderBy(asc(s.steps.position), asc(s.steps.createdAt))
    : [];
  const links = await getLinks({ taskIds: tasks.map((t) => t.id), moveIds: moves.map((m) => m.id) });
  return {
    campaign,
    moves: moves.map((move) => ({
      ...move,
      links: links.filter((l) => l.moveId === move.id).map(linkView),
      tasks: tasks
        .filter((t) => t.moveId === move.id)
        .map((task) => ({
          ...task,
          steps: steps.filter((st) => st.taskId === task.id),
          links: links.filter((l) => l.taskId === task.id).map(linkView),
        })),
    })),
  };
}

export async function getLooseTasks() {
  const tasks = await db
    .select()
    .from(s.tasks)
    .where(isNull(s.tasks.moveId))
    .orderBy(asc(s.tasks.position), asc(s.tasks.createdAt));
  const ids = tasks.map((t) => t.id);
  const [steps, links] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(s.steps)
          .where(inArray(s.steps.taskId, ids))
          .orderBy(asc(s.steps.position), asc(s.steps.createdAt))
      : [],
    getLinks({ taskIds: ids }),
  ]);
  return tasks.map((task) => ({
    ...task,
    steps: steps.filter((st) => st.taskId === task.id),
    links: links.filter((l) => l.taskId === task.id).map(linkView),
  }));
}

/** Structure rows in force on `date` (what the weekly template looks like that day). */
export async function getStructureOn(date: IsoDate): Promise<StructureBlock[]> {
  const rows = await db
    .select()
    .from(s.structureBlocks)
    .where(
      and(
        lte(s.structureBlocks.validFrom, date),
        or(isNull(s.structureBlocks.validTo), gte(s.structureBlocks.validTo, date)),
      ),
    )
    .orderBy(asc(s.structureBlocks.weekday), asc(s.structureBlocks.startMin));
  return rows.map(toStructureBlock);
}

/** Everything that can sit on the calendar or in the stack, keyed "task:id" / "move:id". */
export type WorkItem = {
  kind: WorkKind;
  id: string;
  title: string;
  done: boolean;
  durationMin: number;
  /** For a Task: its Move. */
  moveId: string | null;
  parentTitle: string | null;
  /** For a Move: whether it is worked through Tasks (then the Tasks are scheduled, not the Move). */
  hasTasks: boolean;
  campaignId: string | null;
  campaignTitle: string | null;
  color: string;
  weekOf: IsoDate | null;
  stepsDone: number;
  stepsTotal: number;
  /** It has a Description or Links, to read where it is worked on. */
  hasDetails: boolean;
};

export type CalendarWorkItem =
  | WorkItem
  | (Omit<WorkItem, "kind"> & { kind: "secondary"; upkeep: UpkeepRef | null });

const LOOSE_COLOR = "#71717a";

export const workKey = (kind: WorkKind | "secondary", id: string) => `${kind}:${id}`;

function slotWorkId(slot: typeof s.slots.$inferSelect): string {
  return (slot.workKind === "task"
    ? slot.taskId
    : slot.workKind === "move"
      ? slot.moveId
      : slot.secondaryTaskId)!;
}

async function getWorkIndex(): Promise<Map<string, CalendarWorkItem>> {
  const [campaigns, types, moves, tasks, secondary, steps, links] = await Promise.all([
    db.select().from(s.campaigns),
    db.select().from(s.blockTypes),
    db.select().from(s.moves),
    // In Ivan's priority, done ones last: the Stack keeps this order inside a Move and among the Loose Tasks.
    db.select().from(s.tasks).orderBy(sql`${s.tasks.doneAt} is not null`, asc(s.tasks.position), asc(s.tasks.createdAt)),
    getSecondaryTasks(),
    db.select({ taskId: s.steps.taskId, done: s.steps.done }).from(s.steps),
    db.select({ taskId: s.links.taskId, moveId: s.links.moveId }).from(s.links),
  ]);
  const linked = new Set(links.flatMap((l) => [l.taskId, l.moveId]).filter(Boolean));
  const color = (campaignId: string | null) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    return types.find((t) => t.id === campaign?.blockTypeId)?.color ?? LOOSE_COLOR;
  };
  const index = new Map<string, CalendarWorkItem>();

  for (const move of moves) {
    const campaign = campaigns.find((c) => c.id === move.campaignId)!;
    index.set(workKey("move", move.id), {
      kind: "move",
      id: move.id,
      title: move.title,
      done: move.doneAt !== null,
      durationMin: 60,
      moveId: null,
      parentTitle: null,
      hasTasks: tasks.some((t) => t.moveId === move.id),
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      color: color(campaign.id),
      weekOf: move.weekOf,
      stepsDone: 0,
      stepsTotal: 0,
      hasDetails: move.description !== "" || linked.has(move.id),
    });
  }
  for (const task of tasks) {
    const move = moves.find((m) => m.id === task.moveId);
    const campaign = campaigns.find((c) => c.id === move?.campaignId);
    const own = steps.filter((st) => st.taskId === task.id);
    index.set(workKey("task", task.id), {
      kind: "task",
      id: task.id,
      title: task.title,
      done: task.doneAt !== null,
      durationMin: task.durationMin,
      moveId: task.moveId,
      parentTitle: move?.title ?? null,
      hasTasks: false,
      campaignId: campaign?.id ?? null,
      campaignTitle: campaign?.title ?? null,
      color: color(campaign?.id ?? null),
      weekOf: move?.weekOf ?? null,
      stepsDone: own.filter((st) => st.done).length,
      stepsTotal: own.length,
      hasDetails: task.description !== "" || linked.has(task.id),
    });
  }
  for (const task of secondary) {
    index.set(workKey("secondary", task.id), {
      kind: "secondary",
      id: task.id,
      title: task.title,
      done: task.doneOn !== null,
      upkeep: task.upkeep,
      durationMin: 30,
      moveId: null,
      parentTitle: null,
      hasTasks: false,
      campaignId: null,
      campaignTitle: null,
      color: LOOSE_COLOR,
      weekOf: null,
      stepsDone: 0,
      stepsTotal: 0,
      hasDetails: false,
    });
  }
  return index;
}

/** Moves with Tasks are worked through their Tasks; Secondary Tasks live in their own Check-in list. */
function schedulableWork(index: Map<string, CalendarWorkItem>): WorkItem[] {
  return [...index.values()].filter(
    (item): item is WorkItem => item.kind === "task" || (item.kind === "move" && !item.hasTasks),
  );
}

/** A Slot's bell: its lead (null when off) and whether its last change failed to reach Google. */
export type SlotReminder = { leadMin: number | null; failed: boolean };

export type CalendarSlot = {
  id: string;
  date: IsoDate;
  startMin: number;
  endMin: number;
  work: CalendarWorkItem;
  reminder: SlotReminder;
  /** The Highlight its work is on this Slot's day; null when it is none. */
  highlight: { id: string; why: string } | null;
};

function reminderOf(slot: typeof s.slots.$inferSelect): SlotReminder {
  return { leadMin: slot.reminderLeadMin, failed: slot.reminderFailed };
}

export type CalendarBlock = DayBlock & { type: BlockType };

/** Real focus drawn next to the plan; never mixed with it. */
export type CalendarFocus = {
  id: string;
  startMin: number;
  endMin: number;
  running: boolean;
  complete: boolean;
  title: string;
};

export type CalendarDay = {
  date: IsoDate;
  blocks: CalendarBlock[];
  slots: CalendarSlot[];
  habitsDone: string[];
  focus: CalendarFocus[];
  /** How many Highlights the date has (at most 3). */
  highlightCount: number;
  /** Whether the date has Exceptions, including Blocks removed from it. */
  changed: boolean;
};

export async function getCalendar(dates: IsoDate[]): Promise<CalendarDay[]> {
  const start = dates[0];
  const end = dates[dates.length - 1];
  const [types, structureRows, exceptionRows, slotRows, checks, index, cycleRows, highlightRows] = await Promise.all([
    getBlockTypes(),
    db
      .select()
      .from(s.structureBlocks)
      .where(
        and(
          lte(s.structureBlocks.validFrom, end),
          or(isNull(s.structureBlocks.validTo), gte(s.structureBlocks.validTo, start)),
        ),
      ),
    db
      .select()
      .from(s.structureExceptions)
      .where(and(gte(s.structureExceptions.date, start), lte(s.structureExceptions.date, end))),
    db
      .select()
      .from(s.slots)
      .where(and(gte(s.slots.date, start), lte(s.slots.date, end)))
      .orderBy(asc(s.slots.startMin)),
    db
      .select()
      .from(s.habitChecks)
      .where(and(gte(s.habitChecks.date, start), lte(s.habitChecks.date, end))),
    getWorkIndex(),
    cyclesAround(start, end),
    db
      .select()
      .from(s.highlights)
      .where(and(gte(s.highlights.date, start), lte(s.highlights.date, end))),
  ]);
  const now = new Date();
  const highlightOf = (slot: typeof s.slots.$inferSelect) => {
    const row = highlightRows.find(
      (h) =>
        h.date === slot.date &&
        ((slot.taskId !== null && h.taskId === slot.taskId) || (slot.moveId !== null && h.moveId === slot.moveId)),
    );
    return row ? { id: row.id, why: row.why } : null;
  };
  const structure = structureRows.map(toStructureBlock);
  const exceptions: StructureException[] = exceptionRows;

  return dates.map((date) => ({
    date,
    blocks: resolveDayBlocks(structure, exceptions, date).flatMap((block) => {
      const type = types.find((t) => t.id === block.blockTypeId);
      return type ? [{ ...block, type }] : [];
    }),
    slots: slotRows
      .filter((slot) => slot.date === date)
      .flatMap((slot) => {
        const work = index.get(workKey(slot.workKind, slotWorkId(slot)));
        return work
          ? [
              {
                id: slot.id,
                date,
                startMin: slot.startMin,
                endMin: slot.endMin,
                work,
                reminder: reminderOf(slot),
                highlight: highlightOf(slot),
              },
            ]
          : [];
      }),
    highlightCount: highlightRows.filter((h) => h.date === date).length,
    habitsDone: checks.filter((c) => c.date === date).map((c) => c.blockTypeId),
    changed: exceptions.some((e) => e.date === date),
    focus: cycleRows.flatMap((cycle) => {
      const span = focusSpanOn(cycle, date, now, APP_TIMEZONE);
      if (!span) return [];
      const work = workOf(index, cycle);
      return [
        {
          id: cycle.id,
          ...span,
          running: cyclePhase(cycle, now).phase === "focus",
          complete: isComplete(cycle, now),
          title: work?.title ?? (cycle.label || "Cycle"),
        },
      ];
    }),
  }));
}

/** What a day shows in the Month: only what is scheduled on it. */
export type MonthItem = {
  key: string;
  title: string;
  done: boolean;
  color: string;
  /** Null for a Secondary Task of that day without a Slot on it. */
  startMin: number | null;
  /** The Upkeep it is an occurrence of. */
  upkeepId: string | null;
  /** Its Slot's bell, shown but not changed here. */
  reminder: SlotReminder | null;
  /** Set when it can be dragged to another day: only pending Secondary Tasks, never strategy. */
  movable: { secondaryTaskId: string; slot: { id: string; date: IsoDate } | null } | null;
};

export type MonthDay = { date: IsoDate; items: MonthItem[] };

/**
 * The Slots of each date, plus the Secondary Tasks that sit on it without a
 * Slot there. No Blocks, Exceptions, Habits, Highlights or Cycles: seen a month
 * at a time, the Structure is noise.
 */
export async function getMonth(dates: IsoDate[]): Promise<MonthDay[]> {
  const start = dates[0];
  const end = dates[dates.length - 1];
  const [slotRows, index, secondary] = await Promise.all([
    db
      .select()
      .from(s.slots)
      .where(and(gte(s.slots.date, start), lte(s.slots.date, end)))
      .orderBy(asc(s.slots.startMin)),
    getWorkIndex(),
    getSecondaryTasks(),
  ]);

  return dates.map((date) => {
    const slots = slotRows.filter((slot) => slot.date === date);
    const unscheduled = secondary.filter(
      (task) => secondaryTaskDate(task) === date && !slots.some((slot) => slot.secondaryTaskId === task.id),
    );
    return {
      date,
      items: [
        ...unscheduled.map((task): MonthItem => ({
          key: `secondary:${task.id}`,
          title: task.title,
          done: task.doneOn !== null,
          color: LOOSE_COLOR,
          startMin: null,
          upkeepId: task.upkeep?.id ?? null,
          reminder: null,
          movable: task.doneOn === null ? { secondaryTaskId: task.id, slot: null } : null,
        })),
        ...slots.flatMap((slot): MonthItem[] => {
          const work = index.get(workKey(slot.workKind, slotWorkId(slot)));
          if (!work) return [];
          const secondary = work.kind === "secondary";
          return [{
            key: slot.id,
            title: work.title,
            done: work.done,
            color: work.color,
            startMin: slot.startMin,
            upkeepId: secondary ? (work.upkeep?.id ?? null) : null,
            reminder: reminderOf(slot),
            movable: secondary && !work.done
              ? { secondaryTaskId: work.id, slot: { id: slot.id, date: slot.date } }
              : null,
          }];
        }),
      ],
    };
  });
}

/** Cycles that may touch [start, end] in Ivan's timezone (a day of margin each side). */
async function cyclesAround(start: IsoDate, end: IsoDate) {
  return db
    .select()
    .from(s.cycles)
    .where(
      and(
        gte(s.cycles.startedAt, new Date(`${addDays(start, -1)}T00:00:00Z`)),
        lt(s.cycles.startedAt, new Date(`${addDays(end, 2)}T00:00:00Z`)),
      ),
    )
    .orderBy(asc(s.cycles.startedAt));
}

function workOf(index: Map<string, CalendarWorkItem>, cycle: typeof s.cycles.$inferSelect): WorkItem | null {
  const work = cycle.workKind === "task" && cycle.taskId
    ? index.get(workKey("task", cycle.taskId))
    : cycle.workKind === "move" && cycle.moveId
      ? index.get(workKey("move", cycle.moveId))
      : null;
  return work && work.kind !== "secondary" ? work : null;
}

export type StackItem = WorkItem & {
  /** Next time it is on the calendar, from today on. */
  scheduled: { date: IsoDate; startMin: number } | null;
  carried: CarriedOver | null;
};

/**
 * The morning stack: this week's Moves (or their Tasks), what was carried
 * over, and the loose Tasks from the Backlog still waiting for a place.
 * `date` is the day (or the week's Monday) being looked at.
 */
export async function getStack(date: IsoDate) {
  const now = today();
  const week = startOfWeek(date);
  const [index, slotRows, campaignRows, moveRows] = await Promise.all([
    getWorkIndex(),
    db.select().from(s.slots).orderBy(asc(s.slots.date), asc(s.slots.startMin)),
    // Priority is per Quarter; in a week that straddles two Quarters, ties fall back to creation order.
    db
      .select({ id: s.campaigns.id, status: s.campaigns.status })
      .from(s.campaigns)
      .orderBy(asc(s.campaigns.position), asc(s.campaigns.createdAt)),
    db.select({ id: s.moves.id }).from(s.moves).orderBy(asc(s.moves.position), asc(s.moves.createdAt)),
  ]);
  const slots = slotRows.flatMap((row) =>
    row.workKind === "secondary"
      ? []
      : [{
          id: row.id,
          date: row.date,
          startMin: row.startMin,
          endMin: row.endMin,
          work: { kind: row.workKind, id: slotWorkId(row) },
        }],
  );
  // Only loose work and the work of active Campaigns: a candidate's Moves wait until it is activated.
  const work = inPlay(schedulableWork(index), new Map(campaignRows.map((c) => [c.id, c.status])));
  const carried = carriedOver(work, slots, now);
  const priority = { campaigns: campaignRows.map((c) => c.id), moves: moveRows.map((m) => m.id) };

  const toStackItem = (item: WorkItem): StackItem => {
    const next = slots.find(
      (slot) => slot.work.kind === item.kind && slot.work.id === item.id && slot.date >= now,
    );
    return {
      ...item,
      scheduled: next ? { date: next.date, startMin: next.startMin } : null,
      carried: carried.find((c) => c.kind === item.kind && c.id === item.id) ?? null,
    };
  };

  const isCarried = (item: WorkItem) => carried.some((c) => c.kind === item.kind && c.id === item.id);
  const loose = work.filter((item) => item.campaignId === null);

  const thisWeekItems = inPriority(
    work.filter((item) => item.weekOf === week && item.campaignId !== null),
    (item) => ({ campaignId: item.campaignId, moveId: item.kind === "move" ? item.id : item.moveId }),
    priority,
  ).map(toStackItem);
  const carriedItems = carried.flatMap((c) => {
    const item = work.find((w) => w.kind === c.kind && w.id === c.id);
    return item && item.weekOf !== week ? [toStackItem(item)] : [];
  });
  // A loose Task waits in the Stack until it is placed; then it lives on the calendar.
  // Placed and left unfinished, it comes back under Carried over, not twice.
  const looseItems = unplaced(loose, slots).map(toStackItem);
  // Loose work placed on this day is out of the Stack, but a Highlight or a Cycle can still pick it.
  const placedHere = placedOn(loose, slots, date)
    .filter((item) => !item.done && !isCarried(item))
    .map(toStackItem);

  return {
    week,
    thisWeek: thisWeekItems,
    carriedOver: carriedItems,
    loose: looseItems,
    /** What a Highlight or a Cycle can pick on this day: the open work of the Stack and the loose work placed on it. */
    pickable: [...carriedItems, ...thisWeekItems, ...looseItems, ...placedHere].filter((item) => !item.done),
  };
}

/** Every Secondary Task with the interval of its Upkeep, oldest first. */
async function getSecondaryTasks(): Promise<SecondaryTask[]> {
  const rows = await db
    .select({ task: s.secondaryTasks, intervalDays: s.upkeeps.intervalDays })
    .from(s.secondaryTasks)
    .leftJoin(s.upkeeps, eq(s.upkeeps.id, s.secondaryTasks.upkeepId))
    .orderBy(asc(s.secondaryTasks.createdAt));
  return rows.map(({ task, intervalDays }) => ({
    id: task.id,
    title: task.title,
    day: task.day,
    doneOn: task.doneAt ? localMoment(task.doneAt, APP_TIMEZONE).date : null,
    upkeep: task.upkeepId && intervalDays !== null ? { id: task.upkeepId, intervalDays } : null,
  }));
}

export type UpkeepView = {
  id: string;
  title: string;
  intervalDays: number;
  /** Its one pending occurrence. */
  next: { id: string; day: IsoDate } | null;
  lastDone: IsoDate | null;
};

/** The Upkeeps, the one due soonest first. */
export async function getUpkeeps(): Promise<UpkeepView[]> {
  const [upkeeps, tasks] = await Promise.all([
    db.select().from(s.upkeeps).orderBy(asc(s.upkeeps.createdAt)),
    getSecondaryTasks(),
  ]);
  return upkeeps
    .map((upkeep) => {
      const own = tasks.filter((task) => task.upkeep?.id === upkeep.id);
      const next = own.find((task) => task.doneOn === null);
      const lastDone = own.flatMap((task) => (task.doneOn ? [task.doneOn] : [])).sort().at(-1) ?? null;
      return {
        id: upkeep.id,
        title: upkeep.title,
        intervalDays: upkeep.intervalDays,
        next: next ? { id: next.id, day: next.day } : null,
        lastDone,
      };
    })
    .sort((a, b) => (a.next?.day ?? "9999").localeCompare(b.next?.day ?? "9999"));
}

export async function getDailyNote(date: IsoDate) {
  const [[note], highlightRows, daySlots, secondary, noiseItems, learningEntries, belled] = await Promise.all([
    db.select().from(s.dailyNotes).where(eq(s.dailyNotes.date, date)),
    db
      .select()
      .from(s.highlights)
      .where(eq(s.highlights.date, date))
      .orderBy(asc(s.highlights.position)),
    db
      .select({ taskId: s.slots.taskId, moveId: s.slots.moveId, startMin: s.slots.startMin })
      .from(s.slots)
      .where(eq(s.slots.date, date)),
    getSecondaryTasks(),
    db
      .select({ id: s.noiseItems.id, title: s.noiseItems.title })
      .from(s.noiseItems)
      .where(eq(s.noiseItems.date, date))
      .orderBy(asc(s.noiseItems.createdAt)),
    getLearningEntries(date, date),
    // Secondary Tasks with a bell on a Slot from this day on (a past one has nothing left to remind).
    db
      .select({ id: s.slots.secondaryTaskId, failed: s.slots.reminderFailed })
      .from(s.slots)
      .where(
        and(
          isNotNull(s.slots.secondaryTaskId),
          gte(s.slots.date, date),
          or(isNotNull(s.slots.reminderLeadMin), eq(s.slots.reminderFailed, true)),
        ),
      ),
  ]);
  // In the order of their first Slot that day; one without a Slot (an old one) after them.
  const firstSlot = (h: (typeof highlightRows)[number]) =>
    Math.min(
      ...daySlots
        .filter((slot) => (h.taskId && slot.taskId === h.taskId) || (h.moveId && slot.moveId === h.moveId))
        .map((slot) => slot.startMin),
    );
  // A starred one shows its work's title as it is now; an old one keeps what was written.
  const taskIds = highlightRows.flatMap((h) => (h.taskId ? [h.taskId] : []));
  const moveIds = highlightRows.flatMap((h) => (h.moveId ? [h.moveId] : []));
  const [taskTitles, moveTitles] = await Promise.all([
    taskIds.length ? db.select({ id: s.tasks.id, title: s.tasks.title }).from(s.tasks).where(inArray(s.tasks.id, taskIds)) : [],
    moveIds.length ? db.select({ id: s.moves.id, title: s.moves.title }).from(s.moves).where(inArray(s.moves.id, moveIds)) : [],
  ]);
  const titles = new Map([...taskTitles, ...moveTitles].map((row) => [row.id, row.title]));
  const highlights = [...highlightRows]
    .sort((a, b) => firstSlot(a) - firstSlot(b) || a.position - b.position)
    .map((h) => ({ ...h, title: titles.get(h.taskId ?? h.moveId ?? "") ?? h.title }));
  const reminderFor = (id: string): { failed: boolean } | null => {
    const own = belled.filter((row) => row.id === id);
    return own.length ? { failed: own.some((row) => row.failed) } : null;
  };
  return {
    date,
    noiseItems,
    learningEntries,
    journal: note?.journal ?? "",
    checkInDoneAt: note?.checkInDoneAt ?? null,
    highlights,
    secondaryTasks: secondaryTasksForDate(secondary, date).map((task) => ({ ...task, reminder: reminderFor(task.id) })),
    dayWon: isDayWon(highlights),
  };
}

export type LearningEntry = { id: string; date: IsoDate; title: string; expansion: string; minute: number };

/** The Learning Log of some days, oldest first. */
export async function getLearningEntries(start: IsoDate, end: IsoDate): Promise<LearningEntry[]> {
  const rows = await db
    .select()
    .from(s.learningEntries)
    .where(and(gte(s.learningEntries.date, start), lte(s.learningEntries.date, end)))
    .orderBy(asc(s.learningEntries.date), asc(s.learningEntries.createdAt));
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    expansion: row.expansion,
    minute: localMoment(row.createdAt, APP_TIMEZONE).minute,
  }));
}

/** The closest days around this one that have a Journal written. */
export async function getJournalNeighbors(date: IsoDate) {
  const written = ne(s.dailyNotes.journal, "");
  const [[previous], [next]] = await Promise.all([
    db
      .select({ date: s.dailyNotes.date })
      .from(s.dailyNotes)
      .where(and(written, lt(s.dailyNotes.date, date)))
      .orderBy(desc(s.dailyNotes.date))
      .limit(1),
    db
      .select({ date: s.dailyNotes.date })
      .from(s.dailyNotes)
      .where(and(written, gt(s.dailyNotes.date, date)))
      .orderBy(asc(s.dailyNotes.date))
      .limit(1),
  ]);
  return { previous: previous?.date ?? null, next: next?.date ?? null };
}

/** The strategic context shown at the top of the Check-in. */
export async function getCheckInContext(date: IsoDate) {
  const ref = quarterOf(date);
  const [principles, season, quarter] = await Promise.all([
    getPrincipleViews(),
    getActiveSeason(),
    getQuarter(ref),
  ]);
  const campaigns = quarter
    ? (await getCampaigns({ quarterId: quarter.id })).filter((c) => c.status === "active")
    : [];
  return { principles, season, quarter, quarterRef: ref, campaigns };
}

// ─── Weekly Review ───────────────────────────────────────────────────────────

export async function isReviewDone(week: IsoDate): Promise<boolean> {
  const [row] = await db
    .select({ week: s.weeklyReviews.weekOf })
    .from(s.weeklyReviews)
    .where(eq(s.weeklyReviews.weekOf, week));
  return row !== undefined;
}

/** The Moves saved by some Reviews, in the order they were chosen. A deleted Move counts as not done. */
async function getSavedMoves(weeks: IsoDate[]) {
  if (weeks.length === 0) return [];
  const rows = await db
    .select({ row: s.reviewMoves, doneAt: s.moves.doneAt })
    .from(s.reviewMoves)
    .leftJoin(s.moves, eq(s.moves.id, s.reviewMoves.moveId))
    .where(inArray(s.reviewMoves.reviewWeek, weeks))
    .orderBy(asc(s.reviewMoves.position));
  return rows.map(({ row, doneAt }) => ({
    week: row.reviewWeek,
    moveId: row.moveId,
    title: row.title,
    done: doneAt !== null && doneAt !== undefined,
  }));
}

/** The Moves chosen for a week right now, in priority order. */
export async function getMovesChosenFor(week: IsoDate) {
  const rows = await db
    .select({ move: s.moves, status: s.campaigns.status })
    .from(s.moves)
    .innerJoin(s.campaigns, eq(s.campaigns.id, s.moves.campaignId))
    .where(eq(s.moves.weekOf, week))
    .orderBy(asc(s.campaigns.position), asc(s.moves.position), asc(s.moves.createdAt));
  return rows.map(({ move, status }) => ({
    moveId: move.id,
    title: move.title,
    done: move.doneAt !== null,
    active: status === "active",
  }));
}

/** What the first step looks back on: the week's Learning Log and its Moves. */
export async function getLookBack(week: IsoDate) {
  const [entries, saved, chosen] = await Promise.all([
    getLearningEntries(week, addDays(week, 6)),
    // The Review before this one planned this week.
    getSavedMoves([addDays(week, -7)]),
    getMovesChosenFor(week),
  ]);
  return { entries, moves: movesOfWeek(saved, chosen) };
}

/** What the second step chooses from: the active Campaigns of the planned week's Quarter and their open Moves. */
export async function getMoveChoices(plans: IsoDate) {
  const ref = quarterOf(plans);
  const quarter = await getQuarter(ref);
  const campaigns = quarter
    ? (await getCampaigns({ quarterId: quarter.id })).filter((c) => c.status === "active")
    : [];
  const moves = campaigns.length
    ? await db
        .select()
        .from(s.moves)
        .where(
          and(
            inArray(s.moves.campaignId, campaigns.map((c) => c.id)),
            isNull(s.moves.doneAt),
          ),
        )
        .orderBy(asc(s.moves.position), asc(s.moves.createdAt))
    : [];
  return {
    quarterRef: ref,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      goal: c.goal,
      moves: moves
        .filter((m) => m.campaignId === c.id)
        .map((m) => ({ id: m.id, title: m.title, weekOf: m.weekOf })),
    })),
  };
}

export type ReviewView = {
  week: IsoDate;
  score: number;
  notes: string;
  finishedOn: IsoDate;
  moves: ReviewMove[];
  entries: LearningEntry[];
};

/** A finished Review with the Moves it saved and the Learning Log of its week. */
export async function getReview(week: IsoDate): Promise<ReviewView | null> {
  const [[row], moves, entries] = await Promise.all([
    db.select().from(s.weeklyReviews).where(eq(s.weeklyReviews.weekOf, week)),
    getSavedMoves([week]),
    getLearningEntries(week, addDays(week, 6)),
  ]);
  if (!row) return null;
  return {
    week,
    score: row.feltScore,
    notes: row.notes,
    finishedOn: localMoment(row.doneAt, APP_TIMEZONE).date,
    moves,
    entries,
  };
}

/** Every Review, newest first, with the weeks skipped since the first one. */
export async function getReviewHistory(date: IsoDate) {
  const rows = await db.select().from(s.weeklyReviews);
  const saved = await getSavedMoves(rows.map((row) => row.weekOf));
  const finished: FinishedReview[] = rows.map((row) => {
    const moves = saved.filter((move) => move.week === row.weekOf);
    return {
      week: row.weekOf,
      score: row.feltScore,
      movesDone: moves.filter((move) => move.done).length,
      movesTotal: moves.length,
    };
  });
  return reviewHistory(finished, date);
}

// ─── Cycles ──────────────────────────────────────────────────────────────────

export async function getCyclePresets() {
  return db
    .select()
    .from(s.cyclePresets)
    .orderBy(asc(s.cyclePresets.position), asc(s.cyclePresets.createdAt));
}

export type CycleView = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  focusMin: number;
  breakMin: number;
  label: string;
  work: WorkItem | null;
  steps: { id: string; title: string; done: boolean }[];
  /** The Description and Links of the Task or Move it works on. */
  description: string;
  links: LinkView[];
  /** Minutes late against the Slot it was planned in (negative = early). */
  startDelayMin: number | null;
  realFocusMin: number;
  complete: boolean;
};

async function toCycleViews(rows: (typeof s.cycles.$inferSelect)[]): Promise<CycleView[]> {
  if (rows.length === 0) return [];
  const index = await getWorkIndex();
  const slotIds = rows.flatMap((r) => (r.slotId ? [r.slotId] : []));
  const taskIds = rows.flatMap((r) => (r.workKind === "task" && r.taskId ? [r.taskId] : []));
  const moveIds = rows.flatMap((r) => (r.workKind === "move" && r.moveId ? [r.moveId] : []));
  const [slotRows, stepRows, linkRows, taskRows, moveRows] = await Promise.all([
    slotIds.length ? db.select().from(s.slots).where(inArray(s.slots.id, slotIds)) : [],
    taskIds.length
      ? db
          .select()
          .from(s.steps)
          .where(inArray(s.steps.taskId, taskIds))
          .orderBy(asc(s.steps.position), asc(s.steps.createdAt))
      : [],
    getLinks({ taskIds, moveIds }),
    taskIds.length
      ? db.select({ id: s.tasks.id, description: s.tasks.description }).from(s.tasks).where(inArray(s.tasks.id, taskIds))
      : [],
    moveIds.length
      ? db.select({ id: s.moves.id, description: s.moves.description }).from(s.moves).where(inArray(s.moves.id, moveIds))
      : [],
  ]);
  const now = new Date();
  return rows.map((row) => {
    const slot = slotRows.find((sl) => sl.id === row.slotId);
    return {
      id: row.id,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      focusMin: row.focusMin,
      breakMin: row.breakMin,
      label: row.label,
      work: workOf(index, row),
      steps: stepRows
        .filter((st) => row.workKind === "task" && st.taskId === row.taskId)
        .map((st) => ({ id: st.id, title: st.title, done: st.done })),
      description:
        (row.workKind === "task"
          ? taskRows.find((r) => r.id === row.taskId)
          : row.workKind === "move"
            ? moveRows.find((r) => r.id === row.moveId)
            : undefined
        )?.description ?? "",
      links: linkRows
        .filter((l) =>
          row.workKind === "task" ? l.taskId === row.taskId : row.workKind === "move" ? l.moveId === row.moveId : false,
        )
        .map(linkView),
      startDelayMin: slot ? startDelayMin(slot, row.startedAt, APP_TIMEZONE) : null,
      realFocusMin: realFocusMin(row, now),
      complete: isComplete(row, now),
    };
  });
}

/** The Cycle in focus or in its break right now, if any. */
export async function getActiveCycle(): Promise<CycleView | null> {
  const [latest] = await db.select().from(s.cycles).orderBy(desc(s.cycles.startedAt)).limit(1);
  if (!latest || cyclePhase(latest, new Date()).phase === "over") return null;
  const [view] = await toCycleViews([latest]);
  return view;
}

/** Cycles started on the given days (Ivan's timezone), newest first. */
export async function getCycleHistory(start: IsoDate, end: IsoDate) {
  const rows = (await cyclesAround(start, end)).reverse();
  const views = await toCycleViews(rows);
  return views.filter((c) => {
    const day = localMoment(c.startedAt, APP_TIMEZONE).date;
    return start <= day && day <= end;
  });
}

/** Whether Google Calendar is connected, so a bell can turn on (Reminders). */
export async function getCalendarConnected(): Promise<boolean> {
  return isConnected();
}

/**
 * Everything a Context can be made of, for the Profile. One user, so the whole
 * history comes at once: Ivan picks and searches it in the browser.
 */
export async function getContextSource(): Promise<ContextSource> {
  const date = today();
  const ref = quarterOf(date);
  const weekOf = startOfWeek(date);
  const [
    season,
    quarter,
    principles,
    campaignRows,
    goalRows,
    quarterRows,
    typeRows,
    moveRows,
    taskRows,
    stepRows,
    linkRows,
    chosen,
    highlightRows,
    noteRows,
    learningRows,
    reviewRows,
    reviewMoveRows,
    structure,
  ] = await Promise.all([
    getActiveSeason(),
    getQuarter(ref),
    getPrinciples(),
    db.select().from(s.campaigns).orderBy(asc(s.campaigns.position), asc(s.campaigns.createdAt)),
    db.select({ id: s.seasonGoals.id, title: s.seasonGoals.title }).from(s.seasonGoals),
    db.select().from(s.quarters),
    db.select({ id: s.blockTypes.id, name: s.blockTypes.name, kind: s.blockTypes.kind }).from(s.blockTypes),
    db.select().from(s.moves).orderBy(asc(s.moves.position), asc(s.moves.createdAt)),
    db.select().from(s.tasks).orderBy(asc(s.tasks.position), asc(s.tasks.createdAt)),
    db.select().from(s.steps).orderBy(asc(s.steps.position), asc(s.steps.createdAt)),
    db.select().from(s.links).orderBy(asc(s.links.position), asc(s.links.createdAt)),
    db
      .select({ title: s.moves.title, doneAt: s.moves.doneAt, campaign: s.campaigns.title })
      .from(s.moves)
      .innerJoin(s.campaigns, eq(s.campaigns.id, s.moves.campaignId))
      .where(eq(s.moves.weekOf, weekOf))
      .orderBy(asc(s.campaigns.position), asc(s.moves.position), asc(s.moves.createdAt)),
    db
      .select()
      .from(s.highlights)
      .where(and(gte(s.highlights.date, weekOf), lte(s.highlights.date, addDays(weekOf, 6))))
      .orderBy(asc(s.highlights.date), asc(s.highlights.position)),
    db
      .select({ date: s.dailyNotes.date, journal: s.dailyNotes.journal })
      .from(s.dailyNotes)
      .where(ne(sql`trim(${s.dailyNotes.journal})`, ""))
      .orderBy(desc(s.dailyNotes.date)),
    db.select().from(s.learningEntries).orderBy(desc(s.learningEntries.date), desc(s.learningEntries.createdAt)),
    db.select().from(s.weeklyReviews).orderBy(desc(s.weeklyReviews.weekOf)),
    db.select().from(s.reviewMoves).orderBy(asc(s.reviewMoves.position)),
    getStructureOn(date),
  ]);

  const goalTitle = new Map(goalRows.map((g) => [g.id, g.title]));
  const quarterName = new Map(quarterRows.map((q) => [q.id, quarterLabel({ year: q.year, quarter: q.quarter as QuarterNumber })]));
  const types = new Map(typeRows.map((t) => [t.id, t]));
  const linksOf = (owner: { taskId?: string; moveId?: string }) =>
    linkRows
      .filter((l) => (owner.taskId ? l.taskId === owner.taskId : l.moveId === owner.moveId))
      .map((l) => ({ title: l.title, url: l.url }));
  const contextTask = (task: typeof s.tasks.$inferSelect): ContextTask => ({
    id: task.id,
    title: task.title,
    done: task.doneAt !== null,
    description: task.description,
    steps: stepRows.filter((st) => st.taskId === task.id).map((st) => ({ title: st.title, done: st.done })),
    links: linksOf({ taskId: task.id }),
    games: normalizeGames(task.games ?? []),
  });

  return {
    today: date,
    quarter: { label: quarterLabel(ref), title: quarter?.title ?? "", body: quarter?.body ?? "" },
    season: season
      ? { title: season.title, body: season.body, startedOn: season.startedOn, goals: season.goals.map((g) => g.title) }
      : null,
    principles: principles.map((p) => ({ id: p.id, title: p.title, expansion: p.body })),
    campaigns: campaignRows.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      quarter: c.quarterId ? (quarterName.get(c.quarterId) ?? null) : null,
      seasonGoal: c.seasonGoalId ? (goalTitle.get(c.seasonGoalId) ?? null) : null,
      blockType: c.blockTypeId ? (types.get(c.blockTypeId)?.name ?? null) : null,
      games: normalizeGames(c.games ?? []),
      goal: c.goal,
      why: c.why,
      antiGoal: c.antiGoal,
      moves: moveRows
        .filter((m) => m.campaignId === c.id)
        .map((m) => ({
          title: m.title,
          done: m.doneAt !== null,
          weekOf: m.weekOf,
          description: m.description,
          links: linksOf({ moveId: m.id }),
          tasks: taskRows.filter((t) => t.moveId === m.id).map(contextTask),
        })),
    })),
    looseTasks: taskRows.filter((t) => t.moveId === null && t.doneAt === null).map(contextTask),
    week: {
      weekOf,
      moves: chosen.map((m) => ({ title: m.title, done: m.doneAt !== null, campaign: m.campaign })),
      highlights: highlightRows.map((h) => ({ date: h.date, title: h.title, why: h.why, done: h.done })),
    },
    journals: noteRows.map((n) => ({ date: n.date, text: n.journal })),
    learning: learningRows.map((l) => ({ id: l.id, date: l.date, title: l.title, expansion: l.expansion })),
    reviews: reviewRows.map((r) => ({
      weekOf: r.weekOf,
      feltScore: r.feltScore,
      notes: r.notes,
      moves: reviewMoveRows.filter((m) => m.reviewWeek === r.weekOf).map((m) => m.title),
    })),
    structure: structure.flatMap((b) => {
      const type = types.get(b.blockTypeId);
      return type ? [{ weekday: b.weekday, startMin: b.startMin, endMin: b.endMin, type: type.name, kind: type.kind }] : [];
    }),
  };
}

// ─── Vaults ──────────────────────────────────────────────────────────────────

export type VaultSecretView = { id: string; title: string; iv: string; ciphertext: string };
export type VaultView = { id: string; name: string; secrets: VaultSecretView[] };
export type VaultsView = { passphrase: PassphraseRecord | null; vaults: VaultView[] };

/**
 * Everything the Vaults page needs, still sealed: the browser opens it with the
 * Passphrase. Vaults go alphabetically; their Secrets, newest first.
 */
export async function getVaultsView(): Promise<VaultsView> {
  const [record] = await db.select().from(s.vaultPassphrase).limit(1);
  const vaults = await db
    .select({ id: s.vaults.id, name: s.vaults.name })
    .from(s.vaults)
    .orderBy(sql`lower(${s.vaults.name})`, asc(s.vaults.createdAt));
  const secrets = await db
    .select({
      id: s.vaultSecrets.id,
      vaultId: s.vaultSecrets.vaultId,
      title: s.vaultSecrets.title,
      iv: s.vaultSecrets.iv,
      ciphertext: s.vaultSecrets.ciphertext,
    })
    .from(s.vaultSecrets)
    .orderBy(desc(s.vaultSecrets.createdAt));
  return {
    passphrase: record
      ? {
          salt: record.salt,
          iterations: record.iterations,
          check: { iv: record.checkIv, ciphertext: record.checkCiphertext },
        }
      : null,
    vaults: vaults.map((vault) => ({
      ...vault,
      secrets: secrets
        .filter((secret) => secret.vaultId === vault.id)
        .map(({ id, title, iv, ciphertext }) => ({ id, title, iv, ciphertext })),
    })),
  };
}
