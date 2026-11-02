import { notFound, redirect } from "next/navigation";
import { requireIvan } from "@/lib/session";

// The Campaign lives in the Plan, next to its Quarter; this address only takes old links there.
export const instant = false;

export default async function CampaignPage({ params }: PageProps<"/os/campaigns/[id]">) {
  await requireIvan();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  redirect(`/os/plan?campaign=${id}&col=campaign`);
}
