import { LearningBoard } from "@/components/learning-paths";
import { PageTitle } from "@/components/ui";
import { defaultLearningBlock } from "@/domain/learning-paths";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getExplorations, getLearningPaths, getOpenCampaigns } from "@/server/learning-paths";
import { getBlockTypes } from "@/server/queries";

export const metadata = { title: "Learning" };

/** What Ivan is learning and why now. The lessons themselves live in Obsidian. */
export default async function LearningPage() {
  await requireIvan();
  const [paths, explorations, blockTypes, campaigns] = await Promise.all([
    getLearningPaths(),
    getExplorations(),
    getBlockTypes(),
    getOpenCampaigns(),
  ]);
  const containers = blockTypes.filter((b) => b.kind === "container" && !b.archived);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageTitle>Learning</PageTitle>
      <p className="-mt-2 text-sm text-muted">
        Obsidian knows; here I choose what to learn and when. At most 2 Active Paths and 1 Exploration.
      </p>
      <LearningBoard
        paths={paths}
        explorations={explorations}
        blocks={containers.map((b) => ({ id: b.id, name: b.name }))}
        campaigns={campaigns}
        defaultBlockId={defaultLearningBlock(blockTypes)}
        today={today()}
      />
    </div>
  );
}
