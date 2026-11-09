import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { sampleKindOf, type SampleKind } from "@/domain/library";
import { presignView } from "@/lib/r2";
import { getIncoming, settleDownloads, type ClipView } from "./clips";

export type SampleView = {
  id: string;
  kind: SampleKind;
  contentType: string;
  title: string;
  url: string;
  /** The post it came from, for Samples that were Clips. */
  sourceUrl: string | null;
};
export type CreatorView = {
  id: string;
  topicId: string;
  name: string;
  account: string | null;
  samples: SampleView[];
  /** Links pasted here, still on their way. */
  incoming: ClipView[];
};
export type TopicView = { id: string; title: string; creators: CreatorView[] };

/** The whole Library in Ivan's order: Topics, their Creators, their Samples (newest first unless he dragged them). */
export async function getLibrary(): Promise<TopicView[]> {
  // Links pasted here whose file is in become Samples before anything is read.
  await settleDownloads();
  const [topics, creators, samples, incoming] = await Promise.all([
    db.select().from(s.topics).orderBy(asc(s.topics.position), asc(s.topics.createdAt)),
    db.select().from(s.creators).orderBy(asc(s.creators.position), asc(s.creators.createdAt)),
    db.select().from(s.samples).orderBy(asc(s.samples.position), asc(s.samples.createdAt)),
    getIncoming(),
  ]);
  const views = await Promise.all(
    samples.map(async (row) => {
      const kind = sampleKindOf(row.contentType);
      if (!kind) return null;
      const view: SampleView = {
        id: row.id,
        kind,
        contentType: row.contentType,
        title: row.title ?? "",
        url: await presignView(row.key),
        sourceUrl: row.sourceUrl,
      };
      return { creatorId: row.creatorId, view };
    }),
  );
  const byCreator = new Map<string, SampleView[]>();
  for (const entry of views) {
    if (!entry) continue;
    byCreator.set(entry.creatorId, [...(byCreator.get(entry.creatorId) ?? []), entry.view]);
  }
  const creatorViews = creators.map((c): CreatorView => ({
    id: c.id,
    topicId: c.topicId,
    name: c.name,
    account: c.account,
    samples: byCreator.get(c.id) ?? [],
    incoming: incoming.filter((clip) => clip.creatorId === c.id),
  }));
  return topics.map((t) => ({ id: t.id, title: t.title, creators: creatorViews.filter((c) => c.topicId === t.id) }));
}

export type CreatorChoice = { id: string; name: string; account: string | null; topicId: string; topicTitle: string };

/** Every Creator with its Topic, for a Clip choosing where to go. No files are signed. */
export async function getCreatorChoices(): Promise<{
  topics: { id: string; title: string }[];
  creators: CreatorChoice[];
}> {
  const [topics, creators] = await Promise.all([
    db.select({ id: s.topics.id, title: s.topics.title }).from(s.topics).orderBy(asc(s.topics.position)),
    db.select().from(s.creators).orderBy(asc(s.creators.position)),
  ]);
  const titles = new Map(topics.map((t) => [t.id, t.title]));
  const order = new Map(topics.map((t, i) => [t.id, i]));
  return {
    topics,
    creators: creators
      .filter((c) => titles.has(c.topicId))
      .sort((a, b) => (order.get(a.topicId) ?? 0) - (order.get(b.topicId) ?? 0))
      .map((c) => ({
        id: c.id,
        name: c.name,
        account: c.account,
        topicId: c.topicId,
        topicTitle: titles.get(c.topicId) ?? "",
      })),
  };
}
