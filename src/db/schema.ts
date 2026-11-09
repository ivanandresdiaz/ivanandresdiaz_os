import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  real,
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

/** An image, video or audio stored in R2 under `key`, shown on its Principle in `position` order. */
export const principleReferences = pgTable("principle_references", {
  id: id(),
  principleId: uuid("principle_id")
    .notNull()
    .references(() => principles.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  contentType: text("content_type").notNull(),
  /** Shown only for audios, which have nothing to look at. */
  title: text("title"),
  /** The post it came from, when it came from a Clip. */
  sourceUrl: text("source_url"),
  sizeBytes: integer("size_bytes").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/**
 * The Feed of one date: the References drawn that morning, in order (ids, not a
 * foreign key, so a deleted Reference just drops out). `position` is where Ivan
 * left off; `seen` how many he has reached.
 */
export const feeds = pgTable("feeds", {
  date: isoDate("date").primaryKey(),
  referenceIds: uuid("reference_ids").array().notNull(),
  position: integer("position").notNull().default(0),
  seen: integer("seen").notNull().default(0),
  createdAt: createdAt(),
});

/** The Likes a Reference got on one date: 1 to 30, by how strongly Ivan reacted. */
export const referenceLikes = pgTable(
  "reference_likes",
  {
    id: id(),
    referenceId: uuid("reference_id")
      .notNull()
      .references(() => principleReferences.id, { onDelete: "cascade" }),
    date: isoDate("date").notNull(),
    count: smallint("count").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.referenceId, t.date), check("likes_per_day", sql`${t.count} between 1 and 30`)],
);

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
  /** Its Description: a Long text in Markdown; empty = none. */
  description: text("description").notNull().default(""),
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
  /** Its Description: a Long text in Markdown; empty = none. */
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull().default(60),
  games: games(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

/** A Link: a web address a Task or a Move keeps as a resource for doing it. */
export const links = pgTable(
  "links",
  {
    id: id(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    moveId: uuid("move_id").references(() => moves.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Optional; without one, the address itself is shown. */
    title: text("title").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("link_owner", sql`(${t.taskId} is null) <> (${t.moveId} is null)`),
    check("link_url", sql`${t.url} ~ '^https?://'`),
  ],
);

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

/** A recurring responsibility that is not strategy; each time it is due is a Secondary Task. */
export const upkeeps = pgTable(
  "upkeeps",
  {
    id: id(),
    title: text("title").notNull(),
    intervalDays: integer("interval_days").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("upkeep_interval", sql`${t.intervalDays} > 0`)],
);

export const secondaryTasks = pgTable("secondary_tasks", {
  id: id(),
  title: text("title").notNull(),
  /** Its day: it shows up in the Check-in from then on. The column keeps its first name. */
  day: isoDate("created_on").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  /** The Upkeep it is an occurrence of. Stopping the Upkeep keeps the done ones as plain history. */
  upkeepId: uuid("upkeep_id").references(() => upkeeps.id, { onDelete: "set null" }),
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
    /** Its Reminder: minutes before the start (0 = at the start). Null: no bell. */
    reminderLeadMin: integer("reminder_lead_min"),
    /** The Google Calendar event that carries the Reminder, while there is one. */
    reminderEventId: text("reminder_event_id"),
    /** The last change could not reach Google Calendar: what Google shows may be wrong. */
    reminderFailed: boolean("reminder_failed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "slot_work",
      sql`(${t.workKind} = 'task' and ${t.taskId} is not null and ${t.moveId} is null and ${t.secondaryTaskId} is null) or (${t.workKind} = 'move' and ${t.moveId} is not null and ${t.taskId} is null and ${t.secondaryTaskId} is null) or (${t.workKind} = 'secondary' and ${t.secondaryTaskId} is not null and ${t.taskId} is null and ${t.moveId} is null)`,
    ),
    check("slot_time", sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`),
    check("slot_reminder_lead", sql`${t.reminderLeadMin} is null or ${t.reminderLeadMin} in (0, 5, 10, 15, 30, 60)`),
  ],
);

/**
 * The one Google Calendar connection, for Reminders. Tokens are encrypted;
 * a null refresh token means Google took the access back and Ivan must reconnect.
 */
export const googleCalendar = pgTable(
  "google_calendar",
  {
    id: smallint("id").primaryKey().default(1),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    /** The "Ivan OS" calendar created in Ivan's account. */
    calendarId: text("calendar_id"),
    /** Where Ivan OS was opened when it connected: event descriptions link back there. */
    appOrigin: text("app_origin").notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("google_calendar_single", sql`${t.id} = 1`)],
);

/** Events whose Slot is gone (filled by a trigger on slots); deleted from Google when it answers. */
export const calendarCleanups = pgTable("calendar_cleanups", {
  eventId: text("event_id").primaryKey(),
  createdAt: createdAt(),
});

/** The Daily Note. Slice 1 covers the Check-in part. */
export const dailyNotes = pgTable("daily_notes", {
  date: isoDate("date").primaryKey(),
  checkInDoneAt: timestamp("check_in_done_at", { withTimezone: true }),
  /** The Journal of the day: a Long text in Markdown; empty = not written. */
  journal: text("journal").notNull().default(""),
  createdAt: createdAt(),
});

/** A Learning entry: an idea, a reflection or something learned, captured by its title. */
export const learningEntries = pgTable("learning_entries", {
  id: id(),
  date: isoDate("date").notNull(),
  /** The one line it is captured with (the column predates the Expansion). */
  title: text("body").notNull(),
  /** Its Expansion: a Long text in Markdown; empty = none. */
  expansion: text("expansion").notNull().default(""),
  createdAt: createdAt(),
});

/** A finished Weekly Review. It closes the week of `weekOf` (a Monday) and plans the next one. */
export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    weekOf: isoDate("week_of").primaryKey(),
    feltScore: smallint("felt_score").notNull(),
    /** A Long text; empty = none. */
    notes: text("notes").notNull().default(""),
    doneAt: timestamp("done_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("felt_score_range", sql`${t.feltScore} between 1 and 10`)],
);

/**
 * A Move as it was chosen when a Weekly Review finished. A Move holds only its latest
 * week, so this copy is the record. Deleting the Move keeps its title here.
 */
export const reviewMoves = pgTable("review_moves", {
  id: id(),
  reviewWeek: isoDate("review_week")
    .notNull()
    .references(() => weeklyReviews.weekOf, { onDelete: "cascade" }),
  moveId: uuid("move_id").references(() => moves.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  position: integer("position").notNull(),
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

// ─── Vaults ──────────────────────────────────────────────────────────────────
// Everything secret here arrives already encrypted by the browser; the server
// never sees the Passphrase nor a Secret's text. See docs/adr/0003.

/**
 * The single Passphrase that opens every Vault: its salt, its rounds, the check
 * that recognizes it, and the hash of the proof every change must bring.
 */
export const vaultPassphrase = pgTable(
  "vault_passphrase",
  {
    id: smallint("id").primaryKey().default(1),
    salt: text("salt").notNull(),
    iterations: integer("iterations").notNull(),
    checkIv: text("check_iv").notNull(),
    checkCiphertext: text("check_ciphertext").notNull(),
    proofHash: text("proof_hash").notNull(),
    createdAt: createdAt(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("vault_passphrase_single", sql`${t.id} = 1`)],
);

/** A scope of Secrets; its name is not encrypted. */
export const vaults = pgTable("vaults", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/** A title in the clear and its text, sealed with AES-GCM by the browser. */
export const vaultSecrets = pgTable("vault_secrets", {
  id: id(),
  vaultId: uuid("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  iv: text("iv").notNull(),
  ciphertext: text("ciphertext").notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A link saved to use later, with its file once downloaded (docs/adr/0004).
 * `run` names the current download; its file and result live under keys made
 * from it, so a Retry never reads an older run's result. `title` stays null
 * until the download names it or Ivan does.
 */
export const clips = pgTable(
  "clips",
  {
    id: id(),
    url: text("url").notNull().unique(),
    source: text("source").notNull(),
    title: text("title"),
    status: text("status").notNull(),
    run: uuid("run"),
    /** The try now running: 0, or 1 and 2 for Cloud Run's retries. */
    attempt: smallint("attempt").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    key: text("key"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    durationS: integer("duration_s"),
    error: text("error"),
    /** The account that posted it, as the downloader saw it; it picks the Creator a Clip moves to. */
    author: text("author"),
    /**
     * Where a link pasted where content lives is going: it is not in the Clips
     * bank, and it lands there by itself once its file is downloaded.
     */
    creatorId: uuid("creator_id").references((): AnyPgColumn => creators.id, { onDelete: "cascade" }),
    principleId: uuid("principle_id").references(() => principles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("clips_source", sql`${t.source} in ('instagram', 'youtube')`),
    check("clips_one_destination", sql`${t.creatorId} is null or ${t.principleId} is null`),
    check("clips_status", sql`${t.status} in ('link', 'waiting', 'downloading', 'ready', 'failed')`),
  ],
);

// ─── Library ─────────────────────────────────────────────────────────────────

/** An area Ivan practices by watching how others do it, in the order he drags. */
export const topics = pgTable("topics", {
  id: id(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/**
 * Someone whose content Ivan keeps, in exactly one Topic. `account` is the
 * Instagram or YouTube account it posts from, learnt from the first Clip moved
 * to it, so later Clips from that account find it by themselves.
 */
export const creators = pgTable("creators", {
  id: id(),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  account: text("account"),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/** A reel, video or image of a Creator, stored in R2 under `key`. New ones take the lowest position, so they show first. */
export const samples = pgTable("samples", {
  id: id(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creators.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  contentType: text("content_type").notNull(),
  title: text("title"),
  /** The post it came from, when it came from a Clip. */
  sourceUrl: text("source_url"),
  sizeBytes: integer("size_bytes").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/**
 * A Trim on its way: Cloud Run cuts the file of a Sample or a Reference
 * (`fromKey`) and uploads the cut one to `key`; once it is in, the Sample or
 * Reference takes the new file and the old one is thrown away. `startS` and
 * `endS` are what is kept (null: from the beginning, to the end). A deleted
 * Sample or Reference leaves its Trim with neither, until its files are cleaned.
 */
export const trims = pgTable(
  "trims",
  {
    id: id(),
    sampleId: uuid("sample_id")
      .unique()
      .references(() => samples.id, { onDelete: "set null" }),
    referenceId: uuid("reference_id")
      .unique()
      .references(() => principleReferences.id, { onDelete: "set null" }),
    fromKey: text("from_key").notNull(),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    startS: real("start_s"),
    endS: real("end_s"),
    status: text("status").notNull(),
    run: uuid("run").notNull(),
    /** The try now running: 0, or 1 and 2 for Cloud Run's retries. */
    attempt: smallint("attempt").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    check("trims_one_item", sql`${t.sampleId} is null or ${t.referenceId} is null`),
    check("trims_status", sql`${t.status} in ('trimming', 'failed')`),
  ],
);

export const learningPathStatus = pgEnum("learning_path_status", ["candidate", "active", "done", "dropped"]);

/**
 * Something Ivan chose to learn, with a reason (a course, a book). Its lessons
 * live in Obsidian; `link` opens them. A Candidate needs only its title; an
 * Active one has its why now and its Infinite Games.
 */
export const learningPaths = pgTable("learning_paths", {
  id: id(),
  title: text("title").notNull(),
  whyNow: text("why_now").notNull().default(""),
  games: games(),
  status: learningPathStatus("status").notNull().default("candidate"),
  /** The Container Block type it is played in. */
  blockTypeId: uuid("block_type_id").references(() => blockTypes.id, { onDelete: "set null" }),
  /** An obsidian:// or web link to its notes; empty = none. */
  link: text("link").notNull().default(""),
  /** Ivan's priority among the Candidates. */
  position: integer("position").notNull().default(0),
  /** When it last became Done or Dropped. */
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** The Campaigns a Learning Path serves: any number, or none. */
export const learningPathCampaigns = pgTable(
  "learning_path_campaigns",
  {
    pathId: uuid("path_id")
      .notNull()
      .references(() => learningPaths.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.pathId, t.campaignId)],
);

/** The part of a Learning Path planned for one week. */
export const chapters = pgTable("chapters", {
  id: id(),
  pathId: uuid("path_id")
    .notNull()
    .references(() => learningPaths.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  /** An obsidian:// or web link to its lessons; empty = none. */
  link: text("link").notNull().default(""),
  /** Monday of the week it was chosen for; null = not chosen. */
  weekOf: isoDate("week_of"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

/** Free curiosity with an end date. Open while it has no verdict; only one is open at a time. */
export const explorations = pgTable(
  "explorations",
  {
    id: id(),
    title: text("title").notNull(),
    startedOn: isoDate("started_on").notNull(),
    endsOn: isoDate("ends_on").notNull(),
    /** "path": it became a Candidate; "drop": let go. */
    verdict: text("verdict"),
    endedOn: isoDate("ended_on"),
    createdAt: createdAt(),
  },
  (t) => [
    check("explorations_verdict", sql`${t.verdict} is null or ${t.verdict} in ('path', 'drop')`),
    check("explorations_ended", sql`(${t.verdict} is null) = (${t.endedOn} is null)`),
  ],
);
