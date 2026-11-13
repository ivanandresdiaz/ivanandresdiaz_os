import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import * as s from "@/db/schema";

/**
 * A Stakeholder's own lock (ADR 0005): a code by email, or a Handoff code from
 * Ivan, opens a session whose cookie only travels under /d/<slug> and only
 * opens that person's Interviews.
 * Nothing here ever reads or grants Ivan's session, and nothing in /os accepts this one.
 */

const COOKIE = "discovery_session";
export const SESSION_DAYS = 30;
export const CODE_MINUTES = 10;
export const CODE_ATTEMPTS = 5;
export const CODES_PER_HOUR = 5;
/** A Handoff code waits in a chat for hours, so it lasts days, not minutes (Q77). */
export const HANDOFF_DAYS = 7;
/** Wrong Handoff codes allowed per Discovery per hour; there is no email to narrow a guess (Q76). */
export const HANDOFF_MISSES_PER_HOUR = 10;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

const hmac = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(discoveryId: string, email: string, code: string) {
  return hmac(`code:${discoveryId}:${email}:${code}`);
}

/** Keyed by the Discovery alone: the person types only the code. */
export function hashHandoffCode(discoveryId: string, code: string) {
  return hmac(`handoff:${discoveryId}:${code}`);
}

export function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const cookiePath = (slug: string) => `/d/${slug}`;

/** Signs a Stakeholder in on this device. Only a Server Action may call it (it sets a cookie). */
export async function startSession(stakeholderId: string, slug: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(s.stakeholderSessions).values({ stakeholderId, tokenHash: hmac(`session:${token}`), expiresAt });
  await db.update(s.stakeholders).set({ lastSeenAt: new Date() }).where(eq(s.stakeholders.id, stakeholderId));
  (await cookies()).set(COOKIE, token, {
    path: cookiePath(slug),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

export async function endSession(slug: string) {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(s.stakeholderSessions).where(eq(s.stakeholderSessions.tokenHash, hmac(`session:${token}`)));
  store.delete({ name: COOKIE, path: cookiePath(slug) });
}

const GOODBYE = "discovery_goodbye";

/**
 * After signing out, the link's home says goodbye by name for a few minutes
 * instead of asking for an email again. Only a Server Action may call it.
 */
export async function setGoodbye(slug: string, firstName: string) {
  (await cookies()).set(GOODBYE, firstName, {
    path: cookiePath(slug),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
  });
}

/** The first name to say goodbye to on this device, if they just signed out. */
export async function goodbyeName(): Promise<string | null> {
  return (await cookies()).get(GOODBYE)?.value ?? null;
}

export type Discovery = typeof s.discoveries.$inferSelect;
export type Stakeholder = typeof s.stakeholders.$inferSelect;

export type Access =
  | { kind: "in"; discovery: Discovery; stakeholder: Stakeholder }
  | { kind: "out"; discovery: Discovery }
  | { kind: "closed"; discovery: Discovery }
  | { kind: "draft"; discovery: Discovery }
  | { kind: "missing" };

/** Who is at /d/<slug> on this device, and whether they may be there now. */
export async function access(slug: string): Promise<Access> {
  const [discovery] = await db.select().from(s.discoveries).where(eq(s.discoveries.slug, slug));
  if (!discovery) return { kind: "missing" };
  const token = (await cookies()).get(COOKIE)?.value;
  let stakeholder: Stakeholder | undefined;
  if (token) {
    [stakeholder] = await db
      .select({ stakeholder: s.stakeholders })
      .from(s.stakeholderSessions)
      .innerJoin(s.stakeholders, eq(s.stakeholders.id, s.stakeholderSessions.stakeholderId))
      .where(
        and(
          eq(s.stakeholderSessions.tokenHash, hmac(`session:${token}`)),
          gt(s.stakeholderSessions.expiresAt, new Date()),
          eq(s.stakeholders.discoveryId, discovery.id),
          isNull(s.stakeholders.removedAt),
        ),
      )
      .then((rows) => rows.map((r) => r.stakeholder));
  }
  // Ivan's test Stakeholder lives only while the Discovery is a Draft (Q43).
  if (stakeholder?.isTest) return discovery.status === "draft" ? { kind: "in", discovery, stakeholder } : { kind: "out", discovery };
  if (discovery.status === "closed") return { kind: "closed", discovery };
  if (discovery.status === "draft") return { kind: "draft", discovery };
  if (!stakeholder) return { kind: "out", discovery };
  return { kind: "in", discovery, stakeholder };
}

/** For Server Actions of the Stakeholder side: the signed-in Stakeholder of this Discovery, or an error. */
export async function requireStakeholder(slug: string) {
  const found = await access(slug);
  if (found.kind !== "in") throw new Error("Not signed in to this Discovery");
  await db.update(s.stakeholders).set({ lastSeenAt: new Date() }).where(eq(s.stakeholders.id, found.stakeholder.id));
  return found;
}

/** Signs everyone of a Discovery out, everywhere (closing it, Q40). */
export async function endSessionsOf(discoveryId: string) {
  const people = db.select({ id: s.stakeholders.id }).from(s.stakeholders).where(eq(s.stakeholders.discoveryId, discoveryId));
  await db.delete(s.stakeholderSessions).where(inArray(s.stakeholderSessions.stakeholderId, people));
}

export async function endSessionsOfStakeholder(stakeholderId: string) {
  await db.delete(s.stakeholderSessions).where(eq(s.stakeholderSessions.stakeholderId, stakeholderId));
}
