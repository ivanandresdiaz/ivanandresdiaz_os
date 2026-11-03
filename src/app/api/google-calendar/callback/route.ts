import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/auth";
import { requireIvan } from "@/lib/session";
import { connect } from "@/server/google-calendar";
import { retryFailedReminders, turnOnPendingReminder } from "@/server/reminders";
import { CONSENT_COOKIE, type PendingConsent, safeBack } from "../consent";

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A plain page that says why it did not connect, with the way back. */
function failure(message: string, back: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Google Calendar</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5;background:#0c0a09;color:#e7e5e4">
<h1 style="font-size:1.1rem">Google Calendar is not connected</h1><p>${escape(message)}</p>
<p><a style="color:#f59e0b" href="${escape(back)}">Back to Ivan OS</a></p></body></html>`;
  const response = new NextResponse(html, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  response.cookies.delete({ name: CONSENT_COOKIE, path: "/api/google-calendar" });
  return response;
}

export async function GET(request: NextRequest) {
  await requireIvan();
  const params = request.nextUrl.searchParams;
  let pending: PendingConsent | null = null;
  try {
    pending = JSON.parse(request.cookies.get(CONSENT_COOKIE)?.value ?? "null") as PendingConsent | null;
  } catch {
    pending = null;
  }
  const back = safeBack(pending?.back ?? null);
  if (!pending || !pending.state || pending.state !== params.get("state")) {
    return failure("The request expired or did not start here. Tap the bell again.", back);
  }
  if (params.get("error")) {
    return failure("Google did not give access. Tap the bell again to retry.", back);
  }
  const code = params.get("code");
  if (!code) return failure("Google answered without a code. Tap the bell again.", back);

  let result: Awaited<ReturnType<typeof connect>>;
  try {
    result = await connect({ code, origin: request.nextUrl.origin, isAllowed: isAllowedEmail });
  } catch (error) {
    console.error("Google Calendar connect failed", error);
    return failure("Google Calendar did not answer as expected. Try again in a moment.", back);
  }
  if (!result.ok) return failure(result.error, back);

  // Whatever could not reach Google before goes now; then the bell that asked turns on.
  await retryFailedReminders();
  if (pending.slot) await turnOnPendingReminder(pending.slot);

  const response = NextResponse.redirect(new URL(back, request.nextUrl.origin));
  response.cookies.delete({ name: CONSENT_COOKIE, path: "/api/google-calendar" });
  return response;
}
