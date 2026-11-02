import Link from "next/link";
import { CampaignReader } from "@/components/campaign-drawer";
import { type CampaignCard, CampaignPriority } from "@/components/campaign-priority";
import { type MoveCard, MovePriority } from "@/components/move-priority";
import { QuarterReader, SeasonReader } from "@/components/plan-drawers";
import { MovePanel } from "@/components/plan-move";
import { GamesPicker, GameTags, Hidden } from "@/components/ui";
import { addDays, quarterLabel, quarterOf, quarterRange, startOfWeek, type QuarterRef } from "@/domain/dates";
import {
  byPriority,
  firstOpen,
  landingQuarter,
  parseQuarterKey,
  quarterKey,
  quarterToPlan,
  sameQuarter,
  seasonQuarters,
} from "@/domain/plan";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { createCampaign, createMove, createTask, deleteTask, startSeason, toggleWorkDoneForm } from "@/server/actions";
import {
  getBlockTypes,
  getCampaignDetail,
  getCampaigns,
  getLooseTasks,
  getQuarters,
  getSeasons,
} from "@/server/queries";

export const metadata = { title: "Plan" };

/** The three columns. On a phone only one shows at a time; `col` says which. */
type Column = "strategy" | "campaign" | "move";
/** The columns Ivan collapsed to the side; the Move's never collapses. */
type Foldable = "strategy" | "campaign";

const UUID = /^[0-9a-f-]{36}$/;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function PlanPage({ searchParams }: PageProps<"/os/plan">) {
  await requireIvan();
  const params = await searchParams;
  const now = today();
  const current = quarterOf(now);
  const thisWeek = startOfWeek(now);
  const nextWeek = addDays(thisWeek, 7);
  const requestedId = one(params.campaign);

  const [seasons, quarters, blockTypes, requested, candidates, looseTasks] = await Promise.all([
    getSeasons(),
    getQuarters(),
    getBlockTypes(),
    requestedId && UUID.test(requestedId) ? getCampaignDetail(requestedId) : null,
    getCampaigns({ candidates: true }),
    getLooseTasks(),
  ]);

  // ── What is chosen: the Season, its Quarter, a Campaign and one of its Moves ──
  const active = seasons.find((x) => x.endedOn === null) ?? null;
  const season = seasons.find((x) => x.id === one(params.season)) ?? active ?? seasons[0] ?? null;
  // Without a Season yet, the Plan still opens on the current Quarter.
  const span = season ?? { startedOn: now, endedOn: null };
  // A Campaign opened from elsewhere (the Check-in) brings its Quarter along.
  const requestedQuarter = quarters.find((q) => q.id === requested?.campaign.quarterId)?.ref ?? null;
  const picked = parseQuarterKey(one(params.q)) ?? requestedQuarter;
  const listed = seasonQuarters(span, quarters.map((q) => q.ref), now, picked);
  const selected = picked ?? landingQuarter(span, listed, now);
  const selectedRow = selected ? quarters.find((q) => sameQuarter(q.ref, selected)) : undefined;
  // The tree of All Seasons: each Season with the Quarters it spans, and the ones split between two.
  const tree = seasons.map((x) => {
    const spanned = x.id === season?.id ? listed : seasonQuarters(x, quarters.map((q) => q.ref), now);
    return { season: x, quarters: spanned, toPlan: quarterToPlan(x, spanned, now) };
  });
  const seen = tree.flatMap((t) => t.quarters.map(quarterKey));
  const split = new Set(seen.filter((key, i) => seen.indexOf(key) !== i));

  const campaigns = selectedRow ? await getCampaigns({ quarterId: selectedRow.id }) : [];
  const quarterCampaigns = byPriority(campaigns);
  const backlog = byPriority(candidates);
  const landing = firstOpen(quarterCampaigns.open, (c) => c.status === "active");
  const detail = requested ?? (landing ? await getCampaignDetail(landing.id) : null);
  const campaign = detail?.campaign ?? null;
  const moves = detail?.moves ?? [];
  const move = moves.find((m) => m.id === one(params.move)) ?? firstOpen(moves, (m) => m.doneAt === null);

  // ── Links keep everything chosen, and what Ivan folded ──
  const fold = new Set((one(params.fold) ?? "").split(",").filter((f): f is Foldable => f === "strategy" || f === "campaign"));
  const column: Column = params.col === "campaign" || params.col === "move" ? params.col : "strategy";
  const href = (to: { season?: string; q?: string; campaign?: string; move?: string; col?: Column; fold?: Set<Foldable> }) => {
    const search = new URLSearchParams();
    if (to.season && to.season !== active?.id) search.set("season", to.season);
    if (to.q) search.set("q", to.q);
    if (to.campaign) search.set("campaign", to.campaign);
    if (to.move) search.set("move", to.move);
    if (to.col && to.col !== "strategy") search.set("col", to.col);
    const folded = [...(to.fold ?? fold)];
    if (folded.length) search.set("fold", folded.join(","));
    const query = search.toString();
    return query ? `/os/plan?${query}` : "/os/plan";
  };
  const here = {
    season: season?.id,
    q: selected ? quarterKey(selected) : undefined,
    campaign: campaign?.id,
    move: move?.id,
    col: column,
  };
  const toggleFold = (f: Foldable) => {
    const next = new Set(fold);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    return href({ ...here, fold: next });
  };

  // ── Cards ──
  const goals = seasons.flatMap((x) => x.goals);
  const toCard = (c: (typeof campaigns)[number]): CampaignCard => ({
    id: c.id,
    title: c.title,
    status: c.status,
    goal: c.goal,
    block: ((t) => (t ? { name: t.name, color: t.color } : null))(blockTypes.find((t) => t.id === c.blockTypeId)),
    href: href({ ...here, campaign: c.id, move: undefined, col: "campaign" }),
  });
  const weekLabel = (weekOf: string | null) =>
    weekOf === thisWeek ? "This week" : weekOf === nextWeek ? "Next week" : weekOf ? `Week of ${weekOf}` : null;
  const moveCards: MoveCard[] = moves.map((m) => ({
    id: m.id,
    title: m.title,
    done: m.doneAt !== null,
    week: weekLabel(m.weekOf),
    tasksDone: m.tasks.filter((t) => t.doneAt !== null).length,
    tasksTotal: m.tasks.length,
    href: href({ ...here, move: m.id, col: "move" }),
  }));

  // The Campaign's place in its list: "#2", or its status once closed.
  const openList = campaign?.status === "candidate" ? backlog.open : quarterCampaigns.open;
  const rank = campaign ? openList.findIndex((c) => c.id === campaign.id) : -1;
  const campaignQuarter = quarters.find((q) => q.id === campaign?.quarterId)?.ref ?? null;
  const serves = goals.find((g) => g.id === campaign?.seasonGoalId);
  const playedIn = blockTypes.find((t) => t.id === campaign?.blockTypeId);
  const backFromCampaign = campaign?.status === "candidate" ? "Backlog" : selected ? quarterLabel(selected) : "Strategy";
  // The Season Goals it can serve: the active Season's, plus the one it already serves.
  const goalOptions = [
    ...(active?.goals ?? []),
    ...goals.filter((g) => g.id === campaign?.seasonGoalId && g.seasonId !== active?.id),
  ].map((g) => ({ id: g.id, title: g.title }));
  const containerOptions = blockTypes
    .filter((t) => t.kind === "container" && (!t.archived || t.id === campaign?.blockTypeId))
    .map((t) => ({ id: t.id, name: t.name }));

  const width = (f: Foldable, open: string) => (fold.has(f) ? "2.5rem" : open);
  const columns = `${width("strategy", "minmax(0,1fr)")} ${width("campaign", "minmax(0,1.2fr)")} minmax(0,1.2fr)`;

  return (
    <>
      <h1 className="sr-only">Plan</h1>
      <div
        className="flex flex-col lg:grid lg:h-[calc(100dvh-6rem)] lg:grid-cols-(--plan-columns) lg:gap-3"
        style={{ "--plan-columns": columns } as React.CSSProperties}
      >
        {/* ── Strategy: Season, Quarter, Campaigns, Backlog ── */}
        <Fold shown={fold.has("strategy")} label="Strategy" href={toggleFold("strategy")} />
        <ColumnFrame
          visible={column === "strategy"}
          folded={fold.has("strategy")}
          title="Strategy"
          collapse={toggleFold("strategy")}
        >
          {/* The chain as Ivan reads it: the Season, inside it the Quarter, inside that its Campaigns. */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="label">Season</div>
              {season ? (
                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{season.title}</div>
                    <div className="text-xs text-muted">
                      {season.endedOn ? `${season.startedOn} → ${season.endedOn}` : `Since ${season.startedOn}`}
                    </div>
                    {season.goals.length > 0 && (
                      <ol className="mt-1 list-decimal pl-5 text-sm text-muted">
                        {season.goals.map((g) => (
                          <li key={g.id}>{g.title}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <SeasonReader
                    season={{
                      id: season.id,
                      title: season.title,
                      body: season.body,
                      startedOn: season.startedOn,
                      endedOn: season.endedOn,
                      goals: season.goals.map((g) => ({ id: g.id, title: g.title })),
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted">No Season yet.</p>
              )}
            </div>

            <div className="ml-1 flex flex-col gap-3 border-l-2 border-line pl-3">
              <div>
                <div className="label">Quarter</div>
                {selected ? (
                  <div className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{quarterLabel(selected)}</span>
                        {sameQuarter(selected, current) && <span className="text-xs text-accent">now</span>}
                        <span className="text-xs text-muted">
                          {quarterRange(selected).start} → {quarterRange(selected).end}
                        </span>
                      </div>
                      <div className={`text-sm ${selectedRow?.title ? "" : "text-muted"}`}>
                        {selectedRow?.title || "No title yet"}
                      </div>
                    </div>
                    <QuarterReader quarter={quarterText(selected, selectedRow)} />
                  </div>
                ) : (
                  <p className="text-sm text-muted">No Quarters in this Season.</p>
                )}
              </div>

              <details open className="ml-1 flex flex-col border-l-2 border-line pl-3">
                <summary className="label cursor-pointer py-1">Campaigns</summary>
                {selected ? (
                  <div className="flex flex-col gap-2">
                    {campaigns.length === 0 && <p className="text-sm text-muted">No Campaigns in this Quarter yet.</p>}
                    <CampaignPriority
                      open={quarterCampaigns.open.map(toCard)}
                      closed={quarterCampaigns.closed.map(toCard)}
                      selectedId={campaign?.id}
                    />
                    <NewCampaign
                      quarter={quarterKey(selected)}
                      placeholder={`New Campaign in ${quarterLabel(selected)}`}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted">Pick a Quarter in All Seasons.</p>
                )}
              </details>
            </div>
          </div>

          {/* Every Season with the Quarters it spans: one split by two Seasons shows under both. */}
          <details className="border-t border-line pt-2 text-sm">
            <summary className="label cursor-pointer py-1">All Seasons ({seasons.length})</summary>
            <ul className="flex flex-col gap-2">
              {tree.map(({ season: x, quarters: spanned, toPlan: next }) => (
                <li key={x.id}>
                  <details open={x.id === season?.id}>
                    <summary className="cursor-pointer">
                      <Link
                        href={href({ season: x.id, col: "strategy" })}
                        className={`font-medium hover:text-accent ${x.id === season?.id ? "text-accent" : ""}`}
                      >
                        {x.title}
                      </Link>{" "}
                      <span className="text-xs text-muted">
                        {x.endedOn ? `${x.startedOn} → ${x.endedOn}` : `since ${x.startedOn}`}
                      </span>
                    </summary>
                    <ul className="mt-1 ml-1 flex flex-col gap-0.5 border-l-2 border-line pl-3">
                      {next && (
                        <li>
                          <Link href={href({ season: x.id, q: quarterKey(next), col: "strategy" })} className="btn my-0.5">
                            + Plan {quarterLabel(next)}
                          </Link>
                        </li>
                      )}
                      {spanned.length === 0 && <li className="text-xs text-muted">No Quarters.</li>}
                      {spanned.map((ref) => {
                        const isSelected = x.id === season?.id && selected !== null && sameQuarter(ref, selected);
                        return (
                          <li key={quarterKey(ref)}>
                            <Link
                              href={href({ season: x.id, q: quarterKey(ref), col: "strategy" })}
                              className={`block rounded-md border px-2 py-0.5 ${
                                isSelected ? "border-accent" : "border-transparent hover:bg-background"
                              }`}
                            >
                              <span className="font-medium">{quarterLabel(ref)}</span>{" "}
                              {sameQuarter(ref, current) && <span className="text-xs text-accent">now </span>}
                              <span className="text-xs text-muted">
                                {quarters.find((q) => sameQuarter(q.ref, ref))?.title || "No title yet"}
                                {split.has(quarterKey(ref)) && " · split"}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
            <form action={startSeason} className="mt-3 flex flex-col gap-1">
              <p className="text-xs text-muted">Starting a new Season closes the current one.</p>
              <div className="flex gap-2">
                <input name="title" required placeholder="New Season" aria-label="New Season" className="input" />
                <button className="btn">Start</button>
              </div>
            </form>
          </details>

          <details open={campaign?.status === "candidate"} className="flex flex-col border-t border-line pt-2">
            <summary className="label cursor-pointer py-1">Backlog</summary>
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted">Candidate Campaigns</div>
              {backlog.open.length === 0 && <p className="text-sm text-muted">No candidates yet.</p>}
              <CampaignPriority open={backlog.open.map(toCard)} selectedId={campaign?.id} />
              <NewCampaign placeholder="New candidate Campaign" />
              <div className="mt-2 text-xs text-muted">Loose Tasks</div>
              <ul className="flex flex-col gap-1 text-sm">
                {looseTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <form action={toggleWorkDoneForm}>
                      <Hidden kind="task" id={t.id} />
                      <button>{t.doneAt ? "☑" : "☐"}</button>
                    </form>
                    <span className={t.doneAt ? "line-through opacity-60" : ""}>{t.title}</span>
                    <span className="text-xs text-muted">{t.durationMin} min</span>
                    <GameTags games={t.games} />
                    <form action={deleteTask} className="ml-auto">
                      <Hidden id={t.id} />
                      <button className="text-muted hover:text-red-600" aria-label={`Delete ${t.title}`}>
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={createTask} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input name="title" required placeholder="Loose Task (e.g. renew passport)" className="input" />
                  <input name="durationMin" type="number" min={15} step={15} defaultValue={30} className="input w-20" />
                  <button className="btn">Add</button>
                </div>
                <GamesPicker />
              </form>
            </div>
          </details>
        </ColumnFrame>

        {/* ── The Campaign: its GPS and its Moves ── */}
        <Fold shown={fold.has("campaign")} label="Campaign" href={toggleFold("campaign")} />
        <ColumnFrame
          visible={column === "campaign"}
          folded={fold.has("campaign")}
          title="Campaign"
          back={{ href: href({ ...here, col: "strategy" }), label: backFromCampaign }}
          collapse={toggleFold("campaign")}
        >
          {campaign ? (
            <>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-lg font-semibold text-muted">
                  {rank >= 0 ? `#${rank + 1}` : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg leading-tight font-semibold">{campaign.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {campaign.status !== "active" && <span className="text-foreground">{campaign.status}</span>}
                    {campaignQuarter && <span>{quarterLabel(campaignQuarter)}</span>}
                    <span>{serves ? `Serves: ${serves.title}` : "No Season Goal"}</span>
                    {playedIn && (
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: playedIn.color }} />
                        {playedIn.name}
                      </span>
                    )}
                    <GameTags games={campaign.games} />
                  </div>
                </div>
                <CampaignReader
                  campaign={{
                    id: campaign.id,
                    title: campaign.title,
                    status: campaign.status,
                    goal: campaign.goal,
                    why: campaign.why,
                    antiGoal: campaign.antiGoal,
                    seasonGoalId: campaign.seasonGoalId,
                    blockTypeId: campaign.blockTypeId,
                    games: campaign.games,
                  }}
                  goals={goalOptions}
                  containers={containerOptions}
                  currentQuarter={quarterKey(current)}
                />
              </div>
              <dl className="flex flex-col gap-1.5 text-sm">
                {(
                  [
                    ["Goal", campaign.goal],
                    ["Why", campaign.why],
                    ["Anti-goal", campaign.antiGoal],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="label">{label}</dt>
                    <dd className={`line-clamp-2 whitespace-pre-line ${value ? "" : "text-muted"}`}>
                      {value || "Not written yet. Read → Edit to write it."}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="label mt-2">Moves</div>
              {moves.length === 0 && (
                <p className="text-sm text-muted">No Moves yet. A Move is a step that fits in a week.</p>
              )}
              <MovePriority moves={moveCards} selectedId={move?.id} next={href({ ...here, move: undefined })} />
              <form action={createMove} className="flex flex-wrap gap-2">
                <Hidden campaignId={campaign.id} />
                <input name="title" required placeholder="New Move (e.g. SSO login)" className="input min-w-40 flex-1" />
                <select name="weekOf" className="input w-auto" defaultValue={thisWeek} aria-label="Week">
                  <option value={thisWeek}>This week</option>
                  <option value={nextWeek}>Next week</option>
                  <option value="">Not chosen yet</option>
                </select>
                <button className="btn">Add</button>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted">No Campaign open. Pick one in Strategy, or add one.</p>
          )}
        </ColumnFrame>

        {/* ── The Move: its Tasks and Steps ── */}
        <ColumnFrame
          visible={column === "move"}
          folded={false}
          title="Move"
          back={campaign ? { href: href({ ...here, col: "campaign" }), label: campaign.title } : undefined}
          aside={
            <Link
              href={href({ ...here, fold: fold.size === 2 ? new Set() : new Set<Foldable>(["strategy", "campaign"]) })}
              className="hidden text-xs text-muted hover:text-foreground lg:inline"
            >
              {fold.size === 2 ? "Expand all" : "Collapse all"}
            </Link>
          }
        >
          {move ? (
            // Keyed: its forms start over with each Move instead of keeping the last one's text.
            <MovePanel
              key={move.id}
              move={move}
              thisWeek={thisWeek}
              nextWeek={nextWeek}
              weekLabel={weekLabel(move.weekOf)}
            />
          ) : (
            <p className="text-sm text-muted">
              {campaign
                ? moves.length === 0
                  ? "Add a Move to the Campaign to see its Tasks here."
                  : "Every Move is done. Pick one to see its Tasks."
                : "Open a Campaign to see its Moves."}
            </p>
          )}
        </ColumnFrame>
      </div>
    </>
  );
}

function quarterText(ref: QuarterRef, row: { title: string; body: string } | undefined) {
  const range = quarterRange(ref);
  return {
    year: ref.year,
    quarter: ref.quarter,
    label: quarterLabel(ref),
    start: range.start,
    end: range.end,
    title: row?.title ?? "",
    body: row?.body ?? "",
  };
}

/** A column with its own scroll. On a phone, its header is the way back to the previous column. */
function ColumnFrame({
  visible,
  folded,
  title,
  back,
  collapse,
  aside,
  children,
}: {
  visible: boolean;
  folded: boolean;
  title: string;
  back?: { href: string; label: string };
  collapse?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${visible ? "flex" : "hidden"} ${folded ? "lg:hidden" : "lg:flex"} min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface`}
    >
      <header className="flex min-h-11 items-center gap-2 border-b border-line px-3">
        {back && (
          <Link href={back.href} className="flex min-h-11 min-w-0 items-center gap-1 font-semibold lg:hidden">
            <span className="text-lg text-muted">‹</span>
            <span className="truncate">{back.label}</span>
          </Link>
        )}
        <h2 className={`flex-1 text-sm font-semibold ${back ? "hidden lg:block" : ""}`}>{title}</h2>
        {back && <span className="flex-1 lg:hidden" />}
        {aside}
        {collapse && (
          <Link
            href={collapse}
            title={`Collapse ${title}`}
            aria-label={`Collapse ${title}`}
            className="hidden rounded px-1 text-muted hover:bg-line hover:text-foreground lg:inline"
          >
            «
          </Link>
        )}
      </header>
      <div className="flex flex-col gap-3 p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{children}</div>
    </section>
  );
}

/** A collapsed column on the computer: a thin strip with its name; a click opens it again. */
function Fold({ shown, label, href }: { shown: boolean; label: string; href: string }) {
  if (!shown) return null;
  return (
    <Link
      href={href}
      title={`Expand ${label}`}
      aria-label={`Expand ${label}`}
      className="hidden flex-col items-center gap-2 rounded-lg border border-line bg-surface py-3 text-sm text-muted hover:text-foreground lg:flex"
    >
      <span>»</span>
      <span className="[writing-mode:vertical-rl]">{label}</span>
    </Link>
  );
}

/** Only the title: the Campaign opens next, to write its GPS in its drawer. */
function NewCampaign({ quarter, placeholder }: { quarter?: string; placeholder: string }) {
  return (
    <form action={createCampaign} className="flex gap-2">
      {quarter && <Hidden quarter={quarter} />}
      <input name="title" required placeholder={placeholder} aria-label={placeholder} className="input" />
      <button className="btn">Add</button>
    </form>
  );
}
