import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { addDays, localMoment, quarterOf, startOfWeek, type IsoDate, type QuarterRef } from "@/domain/dates";
import { cyclePhase, focusSpanOn, isComplete, realFocusMin, startDelayMin } from "@/domain/cycles";
import { normalizeGames, type InfiniteGame } from "@/domain/infinite-games";
import { carriedOver, type CarriedOver, type WorkKind } from "@/domain/slots";
import {
  resolveDayBlocks,
  type BlockKind,
  type DayBlock,
  type StructureBlock,
  type StructureException,
} from "@/domain/structure";
import { isDayWon } from "@/domain/highlights";
import { secondaryTasksForDate } from "@/domain/secondary-tasks";
import { APP_TIMEZONE, today } from "@/lib/today";

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
  return {
    campaign,
    moves: moves.map((move) => ({
      ...move,
      tasks: tasks
        .filter((t) => t.moveId === move.id)
        .map((task) => ({ ...task, steps: steps.filter((st) => st.taskId === task.id) })),
    })),
  };
}

export async function getLooseTasks() {
  return db
    .select()
    .from(s.tasks)
    .where(isNull(s.tasks.moveId))
    .orderBy(asc(s.tasks.doneAt), asc(s.tasks.createdAt));
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
};

export type CalendarWorkItem = WorkItem | (Omit<WorkItem, "kind"> & { kind: "secondary" });

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
  const [campaigns, types, moves, tasks, secondary, steps] = await Promise.all([
    db.select().from(s.campaigns),
    db.select().from(s.blockTypes),
    db.select().from(s.moves),
    db.select().from(s.tasks),
    db.select().from(s.secondaryTasks),
    db.select({ taskId: s.steps.taskId, done: s.steps.done }).from(s.steps),
  ]);
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
    });
  }
  for (const task of secondary) {
    index.set(workKey("secondary", task.id), {
      kind: "secondary",
      id: task.id,
      title: task.title,
      done: task.doneAt !== null,
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

export type CalendarSlot = {
  id: string;
  date: IsoDate;
  startMin: number;
  endMin: number;
  work: CalendarWorkItem;
};

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
};

export async function getCalendar(dates: IsoDate[]): Promise<CalendarDay[]> {
  const start = dates[0];
  const end = dates[dates.length - 1];
  const [types, structureRows, exceptionRows, slotRows, checks, index, cycleRows] = await Promise.all([
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
  ]);
  const now = new Date();
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
          ? [{ id: slot.id, date, startMin: slot.startMin, endMin: slot.endMin, work }]
          : [];
      }),
    habitsDone: checks.filter((c) => c.date === date).map((c) => c.blockTypeId),
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
 * over, and loose Tasks from the Backlog.
 */
export async function getStack(date: IsoDate) {
  const now = today();
  const week = startOfWeek(date);
  const [index, slotRows] = await Promise.all([
    getWorkIndex(),
    db.select().from(s.slots).orderBy(asc(s.slots.date), asc(s.slots.startMin)),
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
  const work = schedulableWork(index);
  const carried = carriedOver(work, slots, now);

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

  return {
    week,
    thisWeek: work
      .filter((item) => item.weekOf === week && item.campaignId !== null)
      .map(toStackItem),
    carriedOver: carried.flatMap((c) => {
      const item = work.find((w) => w.kind === c.kind && w.id === c.id);
      return item && item.weekOf !== week ? [toStackItem(item)] : [];
    }),
    loose: work.filter((item) => item.campaignId === null && !item.done).map(toStackItem),
  };
}

export async function getDailyNote(date: IsoDate) {
  const [[note], highlights, secondary, noiseItems] = await Promise.all([
    db.select().from(s.dailyNotes).where(eq(s.dailyNotes.date, date)),
    db
      .select()
      .from(s.highlights)
      .where(eq(s.highlights.date, date))
      .orderBy(asc(s.highlights.position)),
    db.select().from(s.secondaryTasks).orderBy(asc(s.secondaryTasks.createdAt)),
    db
      .select({ id: s.noiseItems.id, title: s.noiseItems.title })
      .from(s.noiseItems)
      .where(eq(s.noiseItems.date, date))
      .orderBy(asc(s.noiseItems.createdAt)),
  ]);
  return {
    date,
    noiseItems,
    checkInDoneAt: note?.checkInDoneAt ?? null,
    highlights,
    secondaryTasks: secondaryTasksForDate(
      secondary.map((task) => ({
        id: task.id,
        title: task.title,
        createdOn: task.createdOn,
        doneOn: task.doneAt ? localMoment(task.doneAt, APP_TIMEZONE).date : null,
      })),
      date,
    ),
    dayWon: isDayWon(highlights),
  };
}

/** The strategic context shown at the top of the Check-in. */
export async function getCheckInContext(date: IsoDate) {
  const ref = quarterOf(date);
  const [principles, season, quarter] = await Promise.all([
    getPrinciples(),
    getActiveSeason(),
    getQuarter(ref),
  ]);
  const campaigns = quarter
    ? (await getCampaigns({ quarterId: quarter.id })).filter((c) => c.status === "active")
    : [];
  return { principles, season, quarter, quarterRef: ref, campaigns };
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
  const [slotRows, stepRows] = await Promise.all([
    slotIds.length ? db.select().from(s.slots).where(inArray(s.slots.id, slotIds)) : [],
    taskIds.length
      ? db
          .select()
          .from(s.steps)
          .where(inArray(s.steps.taskId, taskIds))
          .orderBy(asc(s.steps.position), asc(s.steps.createdAt))
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
