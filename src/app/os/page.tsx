import { redirect } from "next/navigation";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";

// Only redirects to a dated page; there is nothing to show instantly.
export const instant = false;

export default async function OsHome() {
  await requireIvan();
  redirect(`/os/day/${today()}`);
}
