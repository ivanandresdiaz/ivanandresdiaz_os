import { Feed } from "@/components/feed";
import { requireIvan } from "@/lib/session";
import { getTodayFeed } from "@/server/queries";

export const metadata = { title: "Feed" };

export default async function FeedPage() {
  await requireIvan();
  const feed = await getTodayFeed();
  return <Feed key={feed.date} feed={feed} />;
}
