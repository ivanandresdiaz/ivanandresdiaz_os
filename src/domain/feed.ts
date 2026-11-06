/**
 * The Feed: a daily round of up to 10 References from any Principle. The first
 * nine are random; the last one comes from the Top 10. None repeats within the
 * day. Optional: it never gives or takes XP.
 */
export const FEED_SIZE = 10;

/** How many References the Top 10 holds. */
export const TOP_SIZE = 10;

/** How many Likes one Reference can get in a day. The reaction grows fast: 5 is good, 10 a "hell yeah", 15 rare on purpose. */
export const MAX_DAILY_LIKES = 15;

/** How long to hold the heart to take back one of today's Likes. */
export const UNLIKE_HOLD_MS = 500;

/** Today's Likes of a Reference after one more (+1) or one fewer (-1), kept within 0 and the daily max. */
export function stepLikes(today: number, delta: 1 | -1) {
  return Math.max(0, Math.min(today + delta, MAX_DAILY_LIKES));
}

/** How long a tap waits for a second tap before it counts as a pause. */
export const DOUBLE_TAP_MS = 250;

export type Random = () => number;

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How much a Reference moves me each time it reaches me, and over how many days. */
export type LikeAverage = { average: number; days: number };
export type LikeAverages = ReadonlyMap<string, LikeAverage>;

/**
 * The Like Average of every Reference, from finished days only. A day counts if the Feed
 * reached the Reference, even with no Likes (it adds 0), or if the Reference got Likes.
 */
export function likeAverages(
  feeds: readonly { date: string; referenceIds: readonly string[]; seen: number }[],
  likes: readonly { referenceId: string; date: string; count: number }[],
): Map<string, LikeAverage> {
  const days = new Map<string, Set<string>>();
  const sums = new Map<string, number>();
  const countDay = (id: string, date: string) => days.set(id, (days.get(id) ?? new Set()).add(date));
  for (const feed of feeds) for (const id of feed.referenceIds.slice(0, feed.seen)) countDay(id, feed.date);
  for (const like of likes) {
    countDay(like.referenceId, like.date);
    sums.set(like.referenceId, (sums.get(like.referenceId) ?? 0) + like.count);
  }
  return new Map(
    [...days].map(([id, dates]) => [id, { average: (sums.get(id) ?? 0) / dates.size, days: dates.size }]),
  );
}

/** Highest Like Average first, then the one counted on more days. */
function byLikeAverage(likes: LikeAverages) {
  return (a: string, b: string) => {
    const [first, second] = [likes.get(a), likes.get(b)];
    return (second?.average ?? 0) - (first?.average ?? 0) || (second?.days ?? 0) - (first?.days ?? 0);
  };
}

/** Best Like Average first; full ties fall in random order. */
export function rankByLikes(ids: readonly string[], likes: LikeAverages, random: Random): string[] {
  return shuffle(ids, random).sort(byLikeAverage(likes));
}

/** The Top 10: only References above 0, and full ties by id so the list reads the same all day. */
export function topReferences(likes: LikeAverages): string[] {
  return [...likes.keys()]
    .filter((id) => (likes.get(id)?.average ?? 0) > 0)
    .sort()
    .sort(byLikeAverage(likes))
    .slice(0, TOP_SIZE);
}

/** Picks today's Feed: nine at random, then one of the 10 best ranked, never twice the same Reference. */
export function pickFeed(ids: readonly string[], likes: LikeAverages, random: Random): string[] {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const top = rankByLikes(unique, likes, random).slice(0, TOP_SIZE);
  const last = top[Math.floor(random() * top.length)];
  const rest = shuffle(
    unique.filter((id) => id !== last),
    random,
  ).slice(0, FEED_SIZE - 1);
  return [...rest, last];
}

/** How many of today's References were seen, clamped to what still exists. */
export function feedSeen(seen: number, length: number) {
  return Math.max(0, Math.min(seen, length));
}

/** Reaching the last Reference finishes the Feed for the day, whatever is rewatched later. */
export function feedDone(seen: number, length: number) {
  return length > 0 && seen >= length;
}
