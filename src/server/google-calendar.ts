import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { APP_TIMEZONE } from "@/lib/today";

/**
 * Google Calendar for Reminders: Ivan OS writes events in its own "Ivan OS"
 * calendar and Google sends the alert. One way only; nothing is read back.
 */

/** Only the calendars this app creates, and their events: never Ivan's other calendars. */
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_NAME = "Ivan OS";

export const CALLBACK_PATH = "/api/google-calendar/callback";

/** Google said no, or the access is gone: Ivan must reconnect. */
export class CalendarDisconnected extends Error {}

// ─── Tokens at rest ──────────────────────────────────────────────────────────

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`${secret}:google-calendar`).digest();
}

function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

function open(sealed: string): string {
  const [iv, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

function client() {
  const id = process.env.AUTH_GOOGLE_ID;
  const secret = process.env.AUTH_GOOGLE_SECRET;
  if (!id || !secret) throw new Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are not set");
  return { id, secret };
}

export function consentUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: client().id,
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    response_type: "code",
    // The email proves it is Ivan's account; the calendar scope is the one that matters.
    scope: `openid email ${CALENDAR_SCOPE}`,
    // A refresh token, so Reminders keep working without Ivan in the app.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = client();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) {
    if (json.error === "invalid_grant") throw new CalendarDisconnected("Google took the access back");
    throw new Error(`Google token request failed (${response.status}${json.error ? `: ${json.error}` : ""})`);
  }
  return json;
}

/** The email inside an id_token received straight from Google's token endpoint over TLS. */
function emailOf(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      email_verified?: boolean;
    };
    return claims.email_verified ? (claims.email ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Finishes the consent: keeps the tokens and makes sure the "Ivan OS" calendar
 * exists. Returns why it could not, in words Ivan can act on.
 */
export async function connect(input: {
  code: string;
  origin: string;
  isAllowed: (email: string | null) => boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokens = await tokenRequest({
    code: input.code,
    redirect_uri: `${input.origin}${CALLBACK_PATH}`,
    grant_type: "authorization_code",
  });
  if (!input.isAllowed(emailOf(tokens.id_token))) {
    return { ok: false, error: "That Google account is not Ivan's." };
  }
  if (!tokens.scope?.split(" ").includes(CALENDAR_SCOPE)) {
    return { ok: false, error: "The calendar permission was not granted. Connect again and leave it checked." };
  }
  if (!tokens.refresh_token) {
    return { ok: false, error: "Google did not hand over lasting access. Connect again." };
  }
  const values = {
    refreshToken: seal(tokens.refresh_token),
    accessToken: seal(tokens.access_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    appOrigin: input.origin,
    connectedAt: new Date(),
  };
  await db.insert(s.googleCalendar).values(values).onConflictDoUpdate({ target: s.googleCalendar.id, set: values });
  await ensureCalendar();
  return { ok: true };
}

export async function getConnection() {
  const [row] = await db.select().from(s.googleCalendar).where(eq(s.googleCalendar.id, 1));
  return row ?? null;
}

export async function isConnected(): Promise<boolean> {
  const row = await getConnection();
  return !!row?.refreshToken;
}

/** A valid access token, renewed a minute before it expires. */
async function accessToken(): Promise<string> {
  const row = await getConnection();
  if (!row?.refreshToken) throw new CalendarDisconnected("Google Calendar is not connected");
  if (row.accessToken && row.accessTokenExpiresAt && row.accessTokenExpiresAt.getTime() - Date.now() > 60_000) {
    return open(row.accessToken);
  }
  try {
    const tokens = await tokenRequest({ refresh_token: open(row.refreshToken), grant_type: "refresh_token" });
    await db
      .update(s.googleCalendar)
      .set({
        accessToken: seal(tokens.access_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      })
      .where(eq(s.googleCalendar.id, 1));
    return tokens.access_token;
  } catch (error) {
    if (error instanceof CalendarDisconnected) {
      // Revoked, or expired (an OAuth app left in Testing): only a new consent brings it back.
      await db
        .update(s.googleCalendar)
        .set({ refreshToken: null, accessToken: null, accessTokenExpiresAt: null })
        .where(eq(s.googleCalendar.id, 1));
    }
    throw error;
  }
}

// ─── Calendar API ────────────────────────────────────────────────────────────

class NotFound extends Error {}
class Conflict extends Error {}

async function api<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404 || response.status === 410) throw new NotFound(path);
  if (response.status === 409) throw new Conflict(path);
  if (response.status === 401) throw new CalendarDisconnected("Google rejected the access");
  if (!response.ok) throw new Error(`Google Calendar ${method} failed (${response.status})`);
  return response.status === 204 ? null : ((await response.json()) as T);
}

/** The "Ivan OS" calendar; made again if it was deleted in Google. */
async function ensureCalendar(): Promise<string> {
  const row = await getConnection();
  if (row?.calendarId) {
    try {
      await api("GET", `/calendars/${encodeURIComponent(row.calendarId)}`);
      return row.calendarId;
    } catch (error) {
      if (!(error instanceof NotFound)) throw error;
    }
  }
  const created = await api<{ id: string }>("POST", "/calendars", {
    summary: CALENDAR_NAME,
    description: "Reminders from Ivan OS. Changes made here are overwritten.",
    timeZone: APP_TIMEZONE,
  });
  await db.update(s.googleCalendar).set({ calendarId: created!.id }).where(eq(s.googleCalendar.id, 1));
  return created!.id;
}

async function calendarId(): Promise<string> {
  const row = await getConnection();
  return row?.calendarId ?? ensureCalendar();
}

const eventPath = (calendar: string, eventId?: string) =>
  `/calendars/${encodeURIComponent(calendar)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ""}`;

/** A Slot's event id, fixed by the Slot: writing twice never makes two events. Google takes 0-9 and a-v. */
export function slotEventId(slotId: string): string {
  return slotId.replace(/-/g, "").toLowerCase();
}

/**
 * Writes the event over whatever Google holds and returns its id. It is made
 * again if it, or the whole calendar, was deleted in Google.
 */
export async function writeEvent(slotId: string, event: object): Promise<string> {
  const id = slotEventId(slotId);
  let calendar = await calendarId();
  const put = () => api("PUT", eventPath(calendar, id), event);
  try {
    await put();
    return id;
  } catch (error) {
    if (!(error instanceof NotFound)) throw error;
  }
  try {
    await api("POST", eventPath(calendar), { ...event, id });
    return id;
  } catch (error) {
    if (error instanceof Conflict) {
      // Written meanwhile (a second tap), or deleted in Google: it keeps its id.
      try {
        await put();
        return id;
      } catch (again) {
        if (!(again instanceof NotFound)) throw again;
        const created = await api<{ id: string }>("POST", eventPath(calendar), event);
        return created!.id;
      }
    }
    if (!(error instanceof NotFound)) throw error;
    calendar = await ensureCalendar();
    await api("POST", eventPath(calendar), { ...event, id });
    return id;
  }
}

/** Removes an event; one already gone counts as removed. */
export async function removeEvent(eventId: string): Promise<void> {
  const calendar = await calendarId();
  try {
    await api("DELETE", eventPath(calendar, eventId));
  } catch (error) {
    if (!(error instanceof NotFound)) throw error;
  }
}

export async function appOrigin(): Promise<string | null> {
  return (await getConnection())?.appOrigin ?? null;
}
