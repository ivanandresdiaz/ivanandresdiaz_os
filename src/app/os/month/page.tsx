import { redirect } from "next/navigation";
import { monthOf } from "@/domain/dates";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";

// Only redirects to a dated page; there is nothing to show instantly.
export const instant = false;

export default async function ThisMonth() {
  await requireIvan();
  redirect(`/os/month/${monthOf(today())}`);
}
