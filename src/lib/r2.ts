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

export function presignUpload(key: string) {
  return presign("PUT", key, UPLOAD_TTL_SECONDS);
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
