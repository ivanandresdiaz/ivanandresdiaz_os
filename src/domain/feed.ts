/**
 * The Feed: a daily round of up to 10 References from any Principle. The first
 * nine are random; the last one comes from the 10 with the most Likes. None
 * repeats within the day. Optional: it never gives or takes XP.
 */
export const FEED_SIZE = 10;

/** How many References the "most Likes" pool and the Top list hold. */
export const TOP_SIZE = 10;

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

/** Most Likes first; ties fall in random order. */
export function rankByLikes(ids: readonly string[], likes: ReadonlyMap<string, number>, random: Random): string[] {
  return shuffle(ids, random).sort((a, b) => (likes.get(b) ?? 0) - (likes.get(a) ?? 0));
}

/** Picks today's Feed: nine at random, then one from the Top 10, never twice the same Reference. */
export function pickFeed(ids: readonly string[], likes: ReadonlyMap<string, number>, random: Random): string[] {
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
