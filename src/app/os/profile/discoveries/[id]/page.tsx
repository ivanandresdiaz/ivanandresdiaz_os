import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DiscoveryEditor } from "@/components/discovery/editor";
import { PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { getDiscoveryView } from "@/server/discoveries";

export const metadata = { title: "Discovery" };

// Drafting the Opening and rewriting Insights wait for the AI.
export const maxDuration = 300;

export default async function DiscoveryPage({ params }: PageProps<"/os/profile/discoveries/[id]">) {
  await requireIvan();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const view = await getDiscoveryView(id);
  if (!view) notFound();
  return (
    <>
      <Link href="/os/profile/discoveries" className="-mb-2 text-xs text-muted hover:underline">
        ← Discoveries
      </Link>
      <PageTitle>{view.discovery.title}</PageTitle>
      <DiscoveryEditor view={view} />
    </>
  );
}
