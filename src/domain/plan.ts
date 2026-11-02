import { type IsoDate, quarterOf, quarterRange, type QuarterNumber, type QuarterRef } from "./dates";

/** "2026-Q4": how a Quarter travels in a link. */
export function quarterKey({ year, quarter }: QuarterRef): string {
  return `${year}-Q${quarter}`;
}

export function parseQuarterKey(value: unknown): QuarterRef | null {
  const match = typeof value === "string" ? /^(\d{4})-Q([1-4])$/.exec(value) : null;
  return match ? { year: Number(match[1]), quarter: Number(match[2]) as QuarterNumber } : null;
}

export function addQuarters(ref: QuarterRef, by: number): QuarterRef {
  const index = ref.year * 4 + (ref.quarter - 1) + by;
  return { year: Math.floor(index / 4), quarter: ((index % 4) + 1) as QuarterNumber };
}

export function sameQuarter(a: QuarterRef, b: QuarterRef): boolean {
  return a.year === b.year && a.quarter === b.quarter;
}

type SeasonSpan = { startedOn: IsoDate; endedOn: IsoDate | null };

/**
 * The Quarters to list under a Season, newest first: the ones that exist and fall within it,
 * plus the current one while the Season is active (it exists as soon as Ivan writes in it) and
 * the one he picked, even before it exists. A Quarter split by two Seasons shows under both.
 */
export function seasonQuarters(
  season: SeasonSpan,
  existing: QuarterRef[],
  today: IsoDate,
  picked: QuarterRef | null = null,
): QuarterRef[] {
  const listed = existing.filter((ref) => {
    const { start, end } = quarterRange(ref);
    return end >= season.startedOn && (season.endedOn === null || start <= season.endedOn);
  });
  if (season.endedOn === null) listed.push(quarterOf(today));
  if (picked) listed.push(picked);
  const unique = listed.filter((ref, i) => listed.findIndex((other) => sameQuarter(ref, other)) === i);
  return unique.sort((a, b) => b.year * 4 + b.quarter - (a.year * 4 + a.quarter));
}

/** Where the Plan opens: the current Quarter under the active Season, else the Season's newest. */
export function landingQuarter(season: SeasonSpan, listed: QuarterRef[], today: IsoDate): QuarterRef | null {
  return season.endedOn === null ? quarterOf(today) : (listed[0] ?? null);
}

/** The next Quarter, offered to plan ahead while the active Season does not list it yet. */
export function quarterToPlan(season: SeasonSpan, listed: QuarterRef[], today: IsoDate): QuarterRef | null {
  if (season.endedOn !== null) return null;
  const next = addQuarters(quarterOf(today), 1);
  return listed.some((ref) => sameQuarter(ref, next)) ? null : next;
}

export type CampaignStatus = "candidate" | "active" | "done" | "dropped";

/** Open Campaigns keep the priority Ivan gave them; done and dropped ones go below, out of it. */
export function byPriority<T extends { status: CampaignStatus }>(campaigns: T[]): { open: T[]; closed: T[] } {
  const isOpen = (c: T) => c.status === "active" || c.status === "candidate";
  return { open: campaigns.filter(isOpen), closed: campaigns.filter((c) => !isOpen(c)) };
}

/** The first one not done, in priority order: what the Plan opens on. */
export function firstOpen<T>(items: T[], isOpen: (item: T) => boolean): T | null {
  return items.find(isOpen) ?? null;
}

/**
 * The work that reaches the week: loose work, and the work of the Campaigns being played. A candidate
 * is only an idea, and a done or dropped Campaign is over, so their Moves stay out of the week.
 */
export function inPlay<T extends { campaignId: string | null }>(
  items: T[],
  statusOf: ReadonlyMap<string, CampaignStatus>,
): T[] {
  return items.filter((item) => item.campaignId === null || statusOf.get(item.campaignId) === "active");
}

/**
 * Work in the order of its Campaign's priority, then of its Move's (`campaigns` and `moves` list
 * ids, highest first). Tasks of one Move keep their own order; work outside any listed Campaign goes last.
 */
export function inPriority<T>(
  items: T[],
  keyOf: (item: T) => { campaignId: string | null; moveId: string | null },
  priority: { campaigns: string[]; moves: string[] },
): T[] {
  const rank = (list: string[], id: string | null) => {
    const index = id === null ? -1 : list.indexOf(id);
    return index === -1 ? list.length : index;
  };
  return items
    .map((item, i) => {
      const key = keyOf(item);
      return { item, i, campaign: rank(priority.campaigns, key.campaignId), move: rank(priority.moves, key.moveId) };
    })
    .sort((a, b) => a.campaign - b.campaign || a.move - b.move || a.i - b.i)
    .map(({ item }) => item);
}
