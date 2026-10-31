import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth, isAllowedEmail } from "@/auth";

/** Every page and Server Action of the OS calls this before touching data. */
export async function requireIvan() {
  // Auth.js touches crypto before it reads cookies; mark the render as request-time first.
  await connection();
  const session = await auth();
  if (!session?.user || !isAllowedEmail(session.user.email)) {
    redirect("/login");
  }
  return session.user;
}
