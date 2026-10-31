/**
 * The 8 Infinite Games from the manifesto. Fixed list, used as tags: an input
 * can belong to several (a Fork) and counts fully in each.
 */
export const INFINITE_GAMES = [
  "Craft",
  "Love",
  "Body",
  "Soul",
  "Wealth",
  "Tribe",
  "Play",
  "Mind",
] as const;

export type InfiniteGame = (typeof INFINITE_GAMES)[number];

export function isInfiniteGame(value: string): value is InfiniteGame {
  return (INFINITE_GAMES as readonly string[]).includes(value);
}

/** Keeps known games only, without duplicates, in canonical order. */
export function normalizeGames(values: readonly string[]): InfiniteGame[] {
  return INFINITE_GAMES.filter((game) => values.includes(game));
}

export function isFork(games: readonly InfiniteGame[]): boolean {
  return games.length > 1;
}
