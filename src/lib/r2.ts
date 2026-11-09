import "server-only";
import { AwsClient } from "aws4fetch";

/**
 * View links are signed as of the start of the hour, so every render within an
 * hour produces the same URL and the browser cache keeps working. They stay
 * valid for at least 11 hours after any render.
 */
const VIEW_TTL_SECONDS = 12 * 60 * 60;
const UPLOAD_TTL_SECONDS = 15 * 60;

function startOfHourStamp(now = new Date()) {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  return hour.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

let client: AwsClient | null = null;

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
  }
  client ??= new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  return { client, base: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}` };
}

function objectUrl(base: string, key: string) {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function presign(method: "GET" | "PUT", key: string, ttlSeconds: number, datetime?: string) {
  const { client, base } = config();
  const url = new URL(objectUrl(base, key));
  url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
  const signed = await client.sign(new Request(url, { method }), { aws: { signQuery: true, datetime } });
  return signed.url;
}

/** A one-off upload link; a Clip download keeps its links for hours, across Cloud Run's retries. */
export function presignUpload(key: string, ttlSeconds = UPLOAD_TTL_SECONDS) {
  return presign("PUT", key, ttlSeconds);
}

/** A read link that lasts as long as asked, for a Cloud Run run that reads the file hours later. */
export function presignDownload(key: string, ttlSeconds: number) {
  return presign("GET", key, ttlSeconds);
}

export function presignView(key: string) {
  return presign("GET", key, VIEW_TTL_SECONDS, startOfHourStamp());
}

/** Size of a stored object, or null when it does not exist. */
export async function objectSize(key: string): Promise<number | null> {
  const { client, base } = config();
  const res = await client.fetch(objectUrl(base, key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD failed: ${res.status}`);
  return Number(res.headers.get("content-length") ?? 0);
}

export async function deleteObject(key: string) {
  const { client, base } = config();
  const res = await client.fetch(objectUrl(base, key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE failed: ${res.status}`);
}

/** The bytes of a stored object, or null when it does not exist. */
export async function getObject(key: string): Promise<ArrayBuffer | null> {
  const { client, base } = config();
  const res = await client.fetch(objectUrl(base, key));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 GET failed: ${res.status}`);
  return res.arrayBuffer();
}

/** Copies an object inside the bucket (a Clip's file becoming a Reference's). */
export async function copyObject(from: string, to: string) {
  const { client, base } = config();
  const bucket = process.env.R2_BUCKET as string;
  const res = await client.fetch(objectUrl(base, to), {
    method: "PUT",
    headers: { "x-amz-copy-source": `/${bucket}/${from.split("/").map(encodeURIComponent).join("/")}` },
  });
  if (!res.ok) throw new Error(`R2 COPY failed: ${res.status}`);
}

/** The text of a stored object, or null when it does not exist. */
export async function getText(key: string): Promise<string | null> {
  const bytes = await getObject(key);
  return bytes && new TextDecoder().decode(bytes);
}

/** Stores a small text object, such as a marker. */
export async function putText(key: string, text: string, contentType = "text/plain") {
  const { client, base } = config();
  const res = await client.fetch(objectUrl(base, key), {
    method: "PUT",
    body: text,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
}
