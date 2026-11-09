"use client";

import Link from "next/link";
import { useState } from "react";
import { practiceLap, type PracticeOrder } from "@/domain/library";
import type { SampleView, TopicView } from "@/server/library";
import { FeedPlayer, type PlayerItem, unlockPlayer } from "./feed";

type Chosen = SampleView & { creator: string };
type Session = { pool: Chosen[]; order: PracticeOrder; items: PlayerItem[]; laps: number };

const ORDERS: { value: PracticeOrder; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "in-order", label: "In order" },
];

const toItem = (sample: Chosen, lap: number): PlayerItem => ({
  id: sample.id,
  key: `${lap}:${sample.id}`,
  kind: sample.kind,
  url: sample.url,
  title: sample.title,
  sourceUrl: sample.sourceUrl,
  caption: sample.creator,
});

/** Lap after lap; a new one joins before the last one ends, so it goes on until Ivan leaves. */
function withLap(session: Session): Session {
  const last = session.items.at(-1)?.id ?? null;
  const lap = practiceLap(session.pool, session.order, Math.random, last).map((s) => toItem(s, session.laps));
  return { ...session, items: [...session.items, ...lap], laps: session.laps + 1 };
}

const withSamples = (topic: TopicView) => topic.creators.filter((c) => c.samples.length > 0);

/**
 * A Practice: one Topic, the Creators ticked (all, at first), at random or in
 * the Library's order. It records nothing, and every Practice starts fresh.
 */
export function Practice({ topics }: { topics: TopicView[] }) {
  const playable = topics.filter((t) => withSamples(t).length > 0);
  const [topicId, setTopicId] = useState<string | null>(playable[0]?.id ?? null);
  const topic = playable.find((t) => t.id === topicId) ?? playable[0] ?? null;
  const creators = topic ? withSamples(topic) : [];
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<PracticeOrder>("random");
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<HTMLVideoElement | null>(null);

  const chosen: Chosen[] = creators
    .filter((c) => !unticked.has(c.id))
    .flatMap((c) => c.samples.map((sample) => ({ ...sample, creator: c.name })));

  function pickTopic(id: string) {
    setTopicId(id);
    setUnticked(new Set());
  }

  function toggle(id: string) {
    setUnticked((all) => {
      const next = new Set(all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Runs inside the tap, so the player may play with sound on the iPhone. */
  function start() {
    if (chosen.length === 0) return;
    const first = withLap({ pool: chosen, order, items: [], laps: 0 });
    setPlayer(unlockPlayer(player, first.items, 0));
    setSession(first);
  }

  if (session && player) {
    const lapSize = session.pool.length;
    return (
      <FeedPlayer
        items={session.items}
        player={player}
        startAt={0}
        noun="Sample"
        counter={(active) => `${(active % lapSize) + 1} / ${lapSize}`}
        onReach={(index) => setSession((s) => (s && index >= s.items.length - 2 ? withLap(s) : s))}
        onClose={() => {
          player.pause();
          setSession(null);
        }}
      />
    );
  }

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Practice</h2>
        <Link href="/os/feed/library" className="text-sm text-accent hover:underline">
          Library
        </Link>
      </div>

      {!topic ? (
        <p className="text-sm text-muted">
          Practice a Topic from your Library: the content you chose, by Creator. Add Topics, Creators and their reels in
          the{" "}
          <Link href="/os/feed/library" className="text-accent hover:underline">
            Library
          </Link>
          .
        </p>
      ) : (
        <>
          <div role="group" aria-label="Topic" className="flex flex-wrap gap-1.5">
            {playable.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === topic.id}
                onClick={() => pickTopic(t.id)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  t.id === topic.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line text-muted hover:text-foreground"
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="label mb-1">Creators</legend>
            {creators.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!unticked.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted tabular-nums">{c.samples.length}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Order" className="flex rounded-md border border-line p-0.5 text-sm">
              {ORDERS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={order === o.value}
                  onClick={() => setOrder(o.value)}
                  className={`rounded px-2.5 py-1 ${order === o.value ? "bg-line font-medium" : "text-muted"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary disabled:opacity-50"
              disabled={chosen.length === 0}
              onClick={start}
            >
              Start
            </button>
            <span className="text-xs text-muted">
              {chosen.length} Sample{chosen.length === 1 ? "" : "s"}, until you leave
            </span>
          </div>
        </>
      )}
    </section>
  );
}
