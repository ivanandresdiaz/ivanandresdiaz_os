import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { quarterOf, startOfWeek, type IsoDate, type QuarterRef } from "@/domain/dates";
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
import { today } from "@/lib/today";

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

const LOOSE_COLOR = "#71717a";

export const workKey = (kind: WorkKind, id: string) => `${kind}:${id}`;

async function getWorkIndex(): Promise<Map<string, WorkItem>> {
  const [campaigns, types, moves, tasks, steps] = await Promise.all([
    db.select().from(s.campaigns),
    db.select().from(s.blockTypes),
    db.select().from(s.moves),
    db.select().from(s.tasks),
    db.select({ taskId: s.steps.taskId, done: s.steps.done }).from(s.steps),
  ]);
  const color = (campaignId: string | null) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    return types.find((t) => t.id === campaign?.blockTypeId)?.color ?? LOOSE_COLOR;
  };
  const index = new Map<string, WorkItem>();

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
  return index;
}

/** Moves with Tasks are worked through their Tasks; only Moves without Tasks go on the calendar. */
function schedulableWork(index: Map<string, WorkItem>): WorkItem[] {
  return [...index.values()].filter((item) => item.kind === "task" || !item.hasTasks);
}

export type CalendarSlot = {
  id: string;
  date: IsoDate;
  startMin: number;
  endMin: number;
  work: WorkItem;
};

export type CalendarBlock = DayBlock & { type: BlockType };

export type CalendarDay = {
  date: IsoDate;
  blocks: CalendarBlock[];
  slots: CalendarSlot[];
  habitsDone: string[];
};

export async function getCalendar(dates: IsoDate[]): Promise<CalendarDay[]> {
  const start = dates[0];
  const end = dates[dates.length - 1];
  const [types, structureRows, exceptionRows, slotRows, checks, index] = await Promise.all([
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
  ]);
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
        const work = index.get(
          workKey(slot.workKind, (slot.workKind === "task" ? slot.taskId : slot.moveId)!),
        );
        return work
          ? [{ id: slot.id, date, startMin: slot.startMin, endMin: slot.endMin, work }]
          : [];
      }),
    habitsDone: checks.filter((c) => c.date === date).map((c) => c.blockTypeId),
  }));
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
  const slots = slotRows.map((row) => ({
    id: row.id,
    date: row.date,
    startMin: row.startMin,
    endMin: row.endMin,
    work: { kind: row.workKind, id: (row.workKind === "task" ? row.taskId : row.moveId)! },
  }));
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
      const item = index.get(workKey(c.kind, c.id));
      return item && item.weekOf !== week ? [toStackItem(item)] : [];
    }),
    loose: work.filter((item) => item.campaignId === null && !item.done).map(toStackItem),
  };
}

export async function getDailyNote(date: IsoDate) {
  const [[note], highlights] = await Promise.all([
    db.select().from(s.dailyNotes).where(eq(s.dailyNotes.date, date)),
    db
      .select()
      .from(s.highlights)
      .where(eq(s.highlights.date, date))
      .orderBy(asc(s.highlights.position)),
  ]);
  return {
    date,
    eliminate: note?.eliminate ?? "",
    checkInDoneAt: note?.checkInDoneAt ?? null,
    highlights,
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
