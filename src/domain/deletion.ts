/**
 * What a delete takes with it, counted before Ivan confirms it. Only the kinds
 * the deleted thing can hold appear; a zero count is left out of the message.
 */
export type DeletionImpact = {
  moves?: number;
  tasks?: number;
  steps?: number;
  links?: number;
  references?: number;
  slots?: number;
  /** Campaigns that stay but lose the Season Goal being deleted. */
  campaigns?: number;
};

const GOES_WITH = [
  ["moves", "Move", "Moves"],
  ["tasks", "Task", "Tasks"],
  ["steps", "Step", "Steps"],
  ["links", "Link", "Links"],
  ["references", "Reference", "References"],
  ["slots", "Slot on the calendar", "Slots on the calendar"],
] as const;

function list(parts: string[]): string {
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * The sentence under the question, e.g. "Its 4 Tasks and 3 Slots on the
 * calendar go too."; null when nothing goes with it.
 */
export function describeDeletion(impact: DeletionImpact): string | null {
  const counts = GOES_WITH.flatMap(([key, one, many]) => {
    const n = impact[key] ?? 0;
    return n > 0 ? [{ n, text: `${n} ${n === 1 ? one : many}` }] : [];
  });
  const sentences: string[] = [];
  if (counts.length > 0) {
    const single = counts.length === 1 && counts[0].n === 1;
    sentences.push(`Its ${list(counts.map((c) => c.text))} ${single ? "goes" : "go"} too.`);
  }
  const campaigns = impact.campaigns ?? 0;
  if (campaigns > 0) {
    sentences.push(`${campaigns} Campaign${campaigns === 1 ? "" : "s"} ${campaigns === 1 ? "stays" : "stay"}, without this Season Goal.`);
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}
