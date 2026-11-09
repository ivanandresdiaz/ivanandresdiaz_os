import { Feed } from "@/components/feed";
import { Practice } from "@/components/practice";
import { requireIvan } from "@/lib/session";
import { getLibrary } from "@/server/library";
import { getTodayFeed } from "@/server/queries";

export const metadata = { title: "Feed" };

/** Today's Feed of the Principles, and below it a Practice of the Library: two different things in one place. */
export default async function FeedPage() {
  await requireIvan();
  const [feed, library] = await Promise.all([getTodayFeed(), getLibrary()]);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Feed key={feed.date} feed={feed} />
      <Practice topics={library} />
    </div>
  );
}
