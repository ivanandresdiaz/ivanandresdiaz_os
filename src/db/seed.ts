/**
 * Seeds an empty database with the starting point agreed in the design:
 * Season, Q4 2026, Campaign "Build Ivan OS" and Monday's Structure.
 * Run with `pnpm db:seed`. Does nothing if a Season already exists.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseMinutes, quarterOf, startOfWeek, todayIn } from "../domain/dates";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  const existing = await db.select({ id: schema.seasons.id }).from(schema.seasons).limit(1);
  if (existing.length > 0) {
    console.log("Database already has a Season; skipping seed.");
    return;
  }

  const today = todayIn(process.env.APP_TIMEZONE ?? "America/Bogota");

  await db.insert(schema.principles).values(
    [
      ["From the inside out / Own yourself", "I perceive the world as a creator: life comes from me, not at me. External things are feedback and iteration."],
      ["Flow", "Design for flow, zero friction."],
      ["Play for position", ""],
      ["Decide and commit to be happy", "As an act of authorship of my life."],
      ["Play for inputs, not outputs", "Inputs live in the present and bring flow. Playing for outputs brings anxiety and disconnection."],
    ].map(([title, body], position) => ({ title, body, position })),
  );

  const [season] = await db
    .insert(schema.seasons)
    .values({ title: "Working in microfinance at El Alcaraván", startedOn: "2026-10-01" })
    .returning();

  const [goal] = await db
    .insert(schema.seasonGoals)
    .values({ seasonId: season.id, title: "Make 30,000", position: 0 })
    .returning();

  const { year, quarter } = quarterOf("2026-10-01");
  const [q4] = await db
    .insert(schema.quarters)
    .values({ year, quarter, title: "Build the system" })
    .returning();

  const types = await db
    .insert(schema.blockTypes)
    .values([
      { name: "Gym", kind: "habit", color: "#e76f51", games: ["Body", "Mind"] },
      { name: "Reading", kind: "habit", color: "#8e7dbe", games: ["Mind"] },
      { name: "Deep work for the company", kind: "container", color: "#2a6f97", games: ["Craft", "Wealth"] },
      { name: "Nap", kind: "habit", color: "#90a955", games: ["Body"] },
      { name: "Side hustle", kind: "container", color: "#e9a23b", games: ["Craft", "Wealth"] },
      { name: "Learning", kind: "container", color: "#4d908e", games: ["Mind"] },
    ])
    .returning();
  const type = (name: string) => types.find((t) => t.name === name)!.id;

  const monday: [string, string, string][] = [
    ["5:00", "6:00", "Gym"],
    ["7:30", "8:00", "Reading"],
    ["8:00", "12:00", "Deep work for the company"],
    ["12:20", "13:00", "Nap"],
    ["13:00", "14:00", "Side hustle"],
    ["14:00", "16:00", "Deep work for the company"],
    ["16:00", "18:00", "Learning"],
  ];
  await db.insert(schema.structureBlocks).values(
    monday.map(([start, end, name]) => ({
      weekday: 1,
      startMin: parseMinutes(start),
      endMin: parseMinutes(end),
      blockTypeId: type(name),
      validFrom: "2026-10-01",
    })),
  );

  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      quarterId: q4.id,
      seasonGoalId: goal.id,
      blockTypeId: type("Side hustle"),
      title: "Build Ivan OS",
      goal: "Ship the morning loop and use it every day.",
      why: "Strategic management of my life, tactics and execution without friction.",
      antiGoal: "No dates pressure; no feature creep beyond the current slice.",
      games: ["Craft"],
    })
    .returning();

  const [move] = await db
    .insert(schema.moves)
    .values({ campaignId: campaign.id, title: "Google login", weekOf: startOfWeek(today) })
    .returning();

  const [task] = await db
    .insert(schema.tasks)
    .values({ moveId: move.id, title: "Configure Google provider", durationMin: 60, games: ["Craft"] })
    .returning();

  await db.insert(schema.steps).values([
    { taskId: task.id, title: "Create OAuth client in Google Cloud", position: 0 },
    { taskId: task.id, title: "Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET", position: 1 },
  ]);

  console.log("Seeded Ivan OS.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
