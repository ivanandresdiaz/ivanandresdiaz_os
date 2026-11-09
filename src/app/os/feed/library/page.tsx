import Link from "next/link";
import { Library } from "@/components/library";
import { PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { getLibrary } from "@/server/library";

export const metadata = { title: "Library" };

/** The content Ivan chose, by Topic and Creator, to practice from the Feed. Apart from the Principles. */
export default async function LibraryPage() {
  await requireIvan();
  const topics = await getLibrary();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageTitle
        aside={
          <Link href="/os/feed" className="text-sm text-accent hover:underline">
            Practice in the Feed
          </Link>
        }
      >
        Library
      </PageTitle>
      <p className="-mt-2 text-sm text-muted">
        Good content you chose, instead of the algorithm: by Topic, then by Creator. No goals, no Likes.
      </p>
      <Library topics={topics} />
    </div>
  );
}
