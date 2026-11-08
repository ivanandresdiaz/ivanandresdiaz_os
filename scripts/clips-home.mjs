// Downloads the YouTube Clips waiting for this computer (docs/adr/0004).
//
// YouTube refuses Cloud Run but not a home connection, so this runs here, every
// minute while the computer is on (scripts/install-clips-home.sh sets up the
// timer). Each run leaves its check in R2, so Clips can say whether the computer
// is around, and looks for the markers Download leaves in R2. Only when there is
// one does it open the database, so Neon can sleep while nothing waits. It
// claims each waiting Clip, runs the same worker/clips/download.py the cloud
// runs, and lets it upload through one-off R2 links. Ivan OS reads the result
// back from R2 exactly as it does for Cloud Run.
//
// Reads from the repo's .env: DATABASE_URL_PROD_MIGRATE (or CLIPS_HOME_DATABASE_URL)
// and the R2_* keys. Run it by hand with `pnpm clips:home`.

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const { AwsClient } = require("aws4fetch");
const postgresModule = require("postgres");
const postgres = postgresModule.default ?? postgresModule;

/** Same as CLIP_ATTEMPTS and MAX_CLIP_SECONDS in src/domain/clips.ts. */
const ATTEMPTS = 3;
const MAX_SECONDS = 30 * 60;
const LINK_TTL_SECONDS = 5 * 60 * 60;
const YT_DLP = "yt-dlp[default]==2026.10.21";

function readEnv() {
  const env = {};
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = readEnv();
const databaseUrl = process.env.CLIPS_HOME_DATABASE_URL || env.CLIPS_HOME_DATABASE_URL || env.DATABASE_URL_PROD_MIGRATE;
if (!databaseUrl) throw new Error("Set DATABASE_URL_PROD_MIGRATE (or CLIPS_HOME_DATABASE_URL) in .env");

const r2 = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

/** Same as CLIP_WAITING_PREFIX and COMPUTER_CHECK_KEY in src/domain/clips.ts. */
const WAITING_PREFIX = "clips/waiting/";
const CHECK_KEY = "clips/computer.json";

const bucketUrl = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;

async function r2Call(method, key, body) {
  const res = await r2.fetch(`${bucketUrl}/${key}`, { method, body });
  if (!res.ok && !(method === "DELETE" && res.status === 404)) throw new Error(`R2 ${method} ${key}: ${res.status}`);
}

/** The ids of the Clips whose Download left a marker. */
async function waitingMarkers() {
  const url = new URL(bucketUrl);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", WAITING_PREFIX);
  const res = await r2.fetch(url);
  if (!res.ok) throw new Error(`R2 list: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1].slice(WAITING_PREFIX.length));
}

async function presignUpload(key) {
  const url = new URL(`${bucketUrl}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(LINK_TTL_SECONDS));
  return (await r2.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } })).url;
}

const log = (...parts) => console.log(new Date().toISOString(), ...parts);

await r2Call("PUT", CHECK_KEY, JSON.stringify({ checkedAt: new Date().toISOString() }));
const markers = await waitingMarkers();
if (markers.length === 0) process.exit(0);

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

/** Takes the oldest waiting Clip, so two runs never download the same one. */
async function claim() {
  const run = randomUUID();
  const [clip] = await sql`
    update clips set status = 'downloading', run = ${run}, started_at = now(), error = null, key = null
    where id = (
      select id from clips where status = 'waiting' order by created_at limit 1 for update skip locked
    )
    returning id, url, run`;
  return clip ?? null;
}

async function download(clip) {
  const fileUploadUrl = await presignUpload(`clips/${clip.id}/${clip.run}.mp4`);
  const resultUploadUrl = await presignUpload(`clips/${clip.id}/${clip.run}.json`);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const result = spawnSync(
      "uv",
      ["run", "--quiet", "--no-project", "--python", "3.13", "--with", YT_DLP, join(root, "worker/clips/download.py")],
      {
        stdio: ["ignore", "inherit", "inherit"],
        env: {
          ...process.env,
          CLIP_URL: clip.url,
          FILE_UPLOAD_URL: fileUploadUrl,
          RESULT_UPLOAD_URL: resultUploadUrl,
          MAX_SECONDS: String(MAX_SECONDS),
          // download.py reads the attempt like Cloud Run's retries, to know when to give up.
          CLOUD_RUN_TASK_ATTEMPT: String(attempt),
        },
      },
    );
    if (result.error) throw result.error;
    if (result.status === 0) return log("done", clip.url);
    log(`attempt ${attempt + 1} of ${ATTEMPTS} failed`, clip.url);
  }
}

try {
  let clip;
  while ((clip = await claim())) {
    log("downloading", clip.url);
    try {
      await download(clip);
    } catch (error) {
      // This computer couldn't even start it (uv missing, no network): it waits for the next run.
      await sql`update clips set status = 'waiting', run = null, started_at = null where id = ${clip.id} and run = ${clip.run}`;
      throw error;
    }
  }
  // Markers whose Clip no longer waits (taken, deleted, or in another database) go.
  const still = new Set((await sql`select id from clips where status = 'waiting'`).map((row) => row.id));
  await Promise.all(markers.filter((id) => !still.has(id)).map((id) => r2Call("DELETE", `${WAITING_PREFIX}${id}`)));
} finally {
  await sql.end();
}
