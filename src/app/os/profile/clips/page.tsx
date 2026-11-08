import { Clips } from "@/components/clips";
import { PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { getClipsView } from "@/server/clips";
import { getPrinciples } from "@/server/queries";

export const metadata = { title: "Clips" };

/** The bank of links to pass through: paste and forget, then move each one where it belongs. */
export default async function ClipsPage() {
  await requireIvan();
  const [clips, principles] = await Promise.all([getClipsView(), getPrinciples()]);

  return (
    <>
      <PageTitle>Clips</PageTitle>
      <p className="-mt-2 text-sm text-muted">
        Links saved to use later. A bank to pass through: each Clip moves on to where it belongs.
      </p>
      <Clips clips={clips} principles={principles.map((p) => ({ id: p.id, title: p.title }))} />
    </>
  );
}
