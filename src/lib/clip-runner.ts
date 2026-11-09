import "server-only";
import { createSign } from "node:crypto";

/**
 * Starts one download of a Clip on the Cloud Run Job (docs/adr/0004). The job
 * gets only the link and two signed upload URLs, and it is not awaited: its
 * result lands in R2 and is read back later.
 *
 * Needs CLIPS_JOB (projects/P/locations/R/jobs/J) and GCP_CLIPS_LAUNCHER_KEY,
 * the base64 JSON key of a service account that may only run that job.
 */
export type ClipRun = { url: string; fileUploadUrl: string; resultUploadUrl: string; maxSeconds: number };

type Key = { client_email: string; private_key: string };

let token: { value: string; expires: number } | null = null;

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function accessToken(key: Key): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google refused the launcher key: ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return token.value;
}

export function clipDownloadsConfigured(): boolean {
  return !!process.env.CLIPS_JOB && !!process.env.GCP_CLIPS_LAUNCHER_KEY;
}

export async function startClipRun(run: ClipRun): Promise<void> {
  await runJob([
    { name: "CLIP_URL", value: run.url },
    { name: "FILE_UPLOAD_URL", value: run.fileUploadUrl },
    { name: "RESULT_UPLOAD_URL", value: run.resultUploadUrl },
    { name: "MAX_SECONDS", value: String(run.maxSeconds) },
  ]);
}

/** A Trim runs on the same job (TASK=trim): it reads the file and uploads the cut one. See worker/clips/trim.py. */
export type TrimRun = {
  sourceUrl: string;
  fileUploadUrl: string;
  resultUploadUrl: string;
  kind: "video" | "audio";
  startS: number | null;
  endS: number | null;
};

export async function startTrimRun(run: TrimRun): Promise<void> {
  await runJob([
    { name: "TASK", value: "trim" },
    { name: "SOURCE_URL", value: run.sourceUrl },
    { name: "FILE_UPLOAD_URL", value: run.fileUploadUrl },
    { name: "RESULT_UPLOAD_URL", value: run.resultUploadUrl },
    { name: "TRIM_KIND", value: run.kind },
    { name: "TRIM_START", value: run.startS === null ? "" : String(run.startS) },
    { name: "TRIM_END", value: run.endS === null ? "" : String(run.endS) },
  ]);
}

async function runJob(env: { name: string; value: string }[]): Promise<void> {
  const { CLIPS_JOB, GCP_CLIPS_LAUNCHER_KEY } = process.env;
  if (!CLIPS_JOB || !GCP_CLIPS_LAUNCHER_KEY) {
    throw new Error("Clip downloads are not set up: set CLIPS_JOB and GCP_CLIPS_LAUNCHER_KEY");
  }
  const key = JSON.parse(Buffer.from(GCP_CLIPS_LAUNCHER_KEY, "base64").toString("utf8")) as Key;
  const res = await fetch(`https://run.googleapis.com/v2/${CLIPS_JOB}:run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(key)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ overrides: { containerOverrides: [{ env }] } }),
  });
  if (!res.ok) throw new Error(`Cloud Run did not start the run: ${res.status}`);
}
