import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireIvan } from "@/lib/session";
import { consentUrl } from "@/server/google-calendar";
import { CONSENT_COOKIE, safeBack } from "../consent";

/**
 * Starts the Google Calendar consent. `slot` is the Slot whose bell asked for
 * it (it turns on once connected); `back` is where Ivan returns.
 */
export async function GET(request: NextRequest) {
  await requireIvan();
  const params = request.nextUrl.searchParams;
  const slot = params.get("slot");
  const state = randomBytes(24).toString("base64url");
  const pending = {
    state,
    slot: slot && /^[0-9a-f-]{36}$/.test(slot) ? slot : null,
    back: safeBack(params.get("back")),
  };
  const response = NextResponse.redirect(consentUrl(request.nextUrl.origin, state));
  response.cookies.set(CONSENT_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/google-calendar",
    maxAge: 600,
  });
  return response;
}
