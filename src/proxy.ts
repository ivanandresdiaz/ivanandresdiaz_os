import { NextResponse, type NextRequest } from "next/server";
import { startOfWeek, todayIn } from "@/domain/dates";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];
const TIMEZONE = process.env.APP_TIMEZONE ?? "America/Bogota";

/**
 * Optimistic check only: the real one is requireIvan() next to the data.
 * Also sends /os and /os/week straight to today's dated page.
 */
export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  const { pathname } = request.nextUrl;
  if (pathname === "/os" || pathname === "/os/week") {
    const today = todayIn(TIMEZONE);
    const target = pathname === "/os" ? `/os/day/${today}` : `/os/week/${startOfWeek(today)}`;
    return NextResponse.redirect(new URL(target, request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/os/:path*",
};
