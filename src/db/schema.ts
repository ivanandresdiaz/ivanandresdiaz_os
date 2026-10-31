import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const isoDate = (name: string) => date(name, { mode: "string" });
const games = () => text("games").array().notNull().default(sql`'{}'::text[]`);

export const principles = pgTable("principles", {
  id: id(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/** An image or video stored in R2 under `key`, shown on its Principle in `position` order. */
export const principleReferences = pgTable("principle_references", {
  id: id(),
  principleId: uuid("principle_id")
    .notNull()
    .references(() => principles.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/** Exactly one Season is active: the one with ended_on null. */
export const seasons = pgTable("seasons", {
  id: id(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  startedOn: isoDate("started_on").notNull(),
  endedOn: isoDate("ended_on"),
  createdAt: createdAt(),
});

export const seasonGoals = pgTable("season_goals", {
  id: id(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

export const quarters = pgTable(
  "quarters",
  {
    id: id(),
    year: integer("year").notNull(),
    quarter: smallint("quarter").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.year, t.quarter),
    check("quarter_range", sql`${t.quarter} between 1 and 4`),
  ],
);

export const blockKind = pgEnum("block_kind", ["habit", "container"]);

/** A kind of Block: a Habit (Gym, Reading) or a Container (Deep work for the company). */
export const blockTypes = pgTable("block_types", {
  id: id(),
  name: text("name").notNull(),
  kind: blockKind("kind").notNull(),
  color: text("color").notNull(),
  games: games(),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

export const campaignStatus = pgEnum("campaign_status", ["candidate", "active", "done", "dropped"]);

export const campaigns = pgTable("campaigns", {
  id: id(),
  /** Null while it is a candidate in the Backlog, not yet in a Quarter. */
  quarterId: uuid("quarter_id").references(() => quarters.id, { onDelete: "set null" }),
  seasonGoalId: uuid("season_goal_id").references(() => seasonGoals.id, { onDelete: "set null" }),
  /** The Container Block type it is played in. */
  blockTypeId: uuid("block_type_id").references(() => blockTypes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  goal: text("goal").notNull().default(""),
  why: text("why").notNull().default(""),
  antiGoal: text("anti_goal").notNull().default(""),
  games: games(),
  status: campaignStatus("status").notNull().default("active"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const moves = pgTable("moves", {
  id: id(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  /** Monday of the week it was chosen for; null = not chosen yet. */
  weekOf: isoDate("week_of"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const tasks = pgTable("tasks", {
  id: id(),
  /** Null = loose Task, lives in the Backlog of its Infinite Games. */
  moveId: uuid("move_id").references(() => moves.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  durationMin: integer("duration_min").notNull().default(60),
  games: games(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const steps = pgTable("steps", {
  id: id(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const structureBlocks = pgTable(
  "structure_blocks",
  {
    id: id(),
    weekday: smallint("weekday").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    blockTypeId: uuid("block_type_id")
      .notNull()
      .references(() => blockTypes.id),
    validFrom: isoDate("valid_from").notNull(),
    validTo: isoDate("valid_to"),
    createdAt: createdAt(),
  },
  (t) => [
    check("weekday_range", sql`${t.weekday} between 1 and 7`),
    check("block_time", sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`),
  ],
);

export const structureExceptions = pgTable(
  "structure_exceptions",
  {
    id: id(),
    date: isoDate("date").notNull(),
    structureBlockId: uuid("structure_block_id").references(() => structureBlocks.id, {
      onDelete: "cascade",
    }),
    removed: boolean("removed").notNull().default(false),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    blockTypeId: uuid("block_type_id")
      .notNull()
      .references(() => blockTypes.id),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.date, t.structureBlockId)],
);

export const secondaryTasks = pgTable("secondary_tasks", {
  id: id(),
  title: text("title").notNull(),
  createdOn: isoDate("created_on").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const workKind = pgEnum("work_kind", ["task", "move", "secondary"]);

/** A Task, Move or Secondary Task placed on the calendar on one date. */
export const slots = pgTable(
  "slots",
  {
    id: id(),
    date: isoDate("date").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    workKind: workKind("work_kind").notNull(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    moveId: uuid("move_id").references(() => moves.id, { onDelete: "cascade" }),
    secondaryTaskId: uuid("secondary_task_id").references(() => secondaryTasks.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "slot_work",
      sql`(${t.workKind} = 'task' and ${t.taskId} is not null and ${t.moveId} is null and ${t.secondaryTaskId} is null) or (${t.workKind} = 'move' and ${t.moveId} is not null and ${t.taskId} is null and ${t.secondaryTaskId} is null) or (${t.workKind} = 'secondary' and ${t.secondaryTaskId} is not null and ${t.taskId} is null and ${t.moveId} is null)`,
    ),
    check("slot_time", sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`),
  ],
);

/** The Daily Note. Slice 1 covers the Check-in part. */
export const dailyNotes = pgTable("daily_notes", {
  date: isoDate("date").primaryKey(),
  checkInDoneAt: timestamp("check_in_done_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Something I decide to ignore on one date. It never carries over. */
export const noiseItems = pgTable("noise_items", {
  id: id(),
  date: isoDate("date").notNull(),
  title: text("title").notNull(),
  createdAt: createdAt(),
});

export const highlights = pgTable("highlights", {
  id: id(),
  date: isoDate("date").notNull(),
  title: text("title").notNull(),
  why: text("why").notNull(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  moveId: uuid("move_id").references(() => moves.id, { onDelete: "set null" }),
  done: boolean("done").notNull().default(false),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/** A Habit Block marked done (or not) on a date. Habits are never timed. */
export const habitChecks = pgTable(
  "habit_checks",
  {
    id: id(),
    date: isoDate("date").notNull(),
    blockTypeId: uuid("block_type_id")
      .notNull()
      .references(() => blockTypes.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.date, t.blockTypeId)],
);

/** A rhythm for Cycles, e.g. 90 min of focus + 15 of break. The first one is the default. */
export const cyclePresets = pgTable(
  "cycle_presets",
  {
    id: id(),
    name: text("name").notNull(),
    focusMin: integer("focus_min").notNull(),
    breakMin: integer("break_min").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("preset_times", sql`${t.focusMin} > 0 and ${t.breakMin} >= 0`)],
);

/**
 * A Cycle of focus as it really happened. `endedAt` is when the focus stopped
 * (null while running). It may point to the Task/Move worked on and the Slot
 * it was planned in; without them it carries a free label.
 */
export const cycles = pgTable(
  "cycles",
  {
    id: id(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    focusMin: integer("focus_min").notNull(),
    breakMin: integer("break_min").notNull(),
    workKind: workKind("work_kind"),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    moveId: uuid("move_id").references(() => moves.id, { onDelete: "set null" }),
    slotId: uuid("slot_id").references(() => slots.id, { onDelete: "set null" }),
    label: text("label").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [check("cycle_times", sql`${t.focusMin} > 0 and ${t.breakMin} >= 0`)],
);
