import Link from "next/link";
import { addDays, quarterLabel, startOfWeek } from "@/domain/dates";
import { nextReviewDay, type OpenReview, type ReviewMove, type ReviewStep } from "@/domain/reviews";
import { setMoveWeek } from "@/server/actions";
import { setChapterWeek } from "@/server/learning-path-actions";
import { getChapterChoices, getChaptersOfWeek, type WeekChapter } from "@/server/learning-paths";
import {
  getLookBack,
  getMoveChoices,
  getReview,
  getReviewHistory,
  type LearningEntry,
  type ReviewView,
} from "@/server/queries";
import { ReviewLearningEntries } from "./learning-log";
import { Hidden, WeekChip } from "./ui";
import { EditReview, FinishReview, ReviewFrame } from "./weekly-review-parts";

/** The Weekly Review in the Week: `week` is the week on the calendar. */
export async function ReviewPanel({
  step,
  week,
  pending,
  today,
}: {
  step: ReviewStep;
  week: string;
  pending: OpenReview | null;
  today: string;
}) {
  const close = (
    <Link href={`/os/week/${week}`} aria-label="Close" title="Close" className="text-lg leading-none text-muted hover:text-foreground">
      ×
    </Link>
  );
  const history = <AllReviews week={week} today={today} open={step === "read"} />;

  if (step === "look" && pending) {
    return (
      <ReviewFrame heading="Weekly Review" subheading={`Look back · Week of ${pending.week}`} close={close}>
        <LookBack week={pending.week} plans={pending.plans} />
        {history}
      </ReviewFrame>
    );
  }
  if (step === "choose" && pending) {
    return (
      <ReviewFrame heading="Weekly Review" subheading={`Choose Moves and Chapters · Week of ${pending.plans}`} close={close}>
        <ChooseMoves review={pending} today={today} />
        {history}
      </ReviewFrame>
    );
  }

  const review = await getReview(week);
  return (
    <ReviewFrame
      heading="Weekly Review"
      subheading={review ? `Week of ${week} · Finished ${review.finishedOn}` : `Week of ${week}`}
      close={close}
    >
      {review ? <FinishedReview review={review} /> : <NoReview pending={pending} today={today} />}
      {history}
    </ReviewFrame>
  );
}

async function LookBack({ week, plans }: { week: string; plans: string }) {
  const { entries, moves } = await getLookBack(week);
  return (
    <>
      <Entries entries={entries} />
      <div className="flex flex-col gap-1">
        <h3 className="label">Moves of this week</h3>
        {moves.length === 0 ? <Empty>No Moves were chosen for this week.</Empty> : <MoveList moves={moves} />}
      </div>
      <WeekChapters week={week} />
      <Link href={`/os/week/${plans}?review=choose`} className="btn-primary self-start">
        Next →
      </Link>
    </>
  );
}

async function ChooseMoves({ review, today }: { review: OpenReview; today: string }) {
  const { campaigns, quarterRef } = await getMoveChoices(review.plans);
  const thisWeek = startOfWeek(today);
  return (
    <>
      <Link href={`/os/week/${review.week}?review=look`} className="self-start text-xs text-muted hover:underline">
        ← Back
      </Link>
      {campaigns.length === 0 ? (
        <Empty>
          No active Campaigns in {quarterLabel(quarterRef)}.{" "}
          <Link href="/os/plan" className="underline">
            Plan the Quarter
          </Link>
          .
        </Empty>
      ) : (
        campaigns.map((campaign) => (
          <div key={campaign.id} className="flex flex-col gap-1.5">
            <div>
              <h3 className="text-sm font-medium">{campaign.title}</h3>
              {campaign.goal && <p className="text-xs text-muted">{campaign.goal}</p>}
            </div>
            {campaign.moves.length === 0 ? (
              <Empty>No open Moves.</Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {campaign.moves.map((move) => {
                  const chosen = move.weekOf === review.plans;
                  return (
                    <li key={move.id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-sm">
                      <span className="min-w-0 flex-1 break-words">{move.title}</span>
                      {move.weekOf && !chosen && (
                        <WeekChip label={move.weekOf === thisWeek ? "This week" : `Week of ${move.weekOf}`} now={false} />
                      )}
                      <form action={setMoveWeek}>
                        <Hidden id={move.id} weekOf={chosen ? "" : review.plans} />
                        <button
                          className={`shrink-0 text-xs hover:underline ${chosen ? "font-medium" : "text-muted"}`}
                          title={chosen ? `Unchoose ${move.title}` : `Choose ${move.title}`}
                          aria-pressed={chosen}
                        >
                          {chosen ? "✓ Chosen" : "Choose"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))
      )}
      <ChooseChapters plans={review.plans} today={today} />
      <FinishReview week={review.week} plans={review.plans} />
    </>
  );
}

/** The Chapters chosen for a week, as the Look back shows them. */
async function WeekChapters({ week }: { week: string }) {
  const chapters = await getChaptersOfWeek(week);
  if (chapters.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="label">Chapters of this week</h3>
      <ChapterResults chapters={chapters} />
    </div>
  );
}

function ChapterResults({ chapters }: { chapters: WeekChapter[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {chapters.map((c) => (
        <li key={c.id} className="flex gap-2">
          <span className={`w-4 shrink-0 ${c.done ? "" : "text-muted"}`} aria-label={c.done ? "Done" : "Not done"}>
            {c.done ? "✓" : "○"}
          </span>
          <span className={`min-w-0 flex-1 break-words ${c.done ? "" : "text-muted"}`}>
            {c.title} <span className="text-xs text-muted">· {c.pathTitle}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** After the Moves: the Chapter each Active Learning Path works on next week. */
async function ChooseChapters({ plans, today }: { plans: string; today: string }) {
  const paths = await getChapterChoices();
  const thisWeek = startOfWeek(today);
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div>
        <h3 className="text-sm font-medium">Learning Paths</h3>
        <p className="text-xs text-muted">Choose the Chapter each Active Path covers next week.</p>
      </div>
      {paths.length === 0 ? (
        <Empty>
          No Active Learning Path.{" "}
          <Link href="/os/learning" className="underline">
            Activate one
          </Link>
          .
        </Empty>
      ) : (
        paths.map((path) => (
          <div key={path.id} className="flex flex-col gap-1.5">
            <div>
              <h4 className="text-sm">{path.title}</h4>
              {path.block && <p className="text-xs text-muted">Played in {path.block.name}</p>}
            </div>
            {path.chapters.length === 0 ? (
              <Empty>
                No open Chapters.{" "}
                <Link href="/os/learning" className="underline">
                  Add one
                </Link>
                .
              </Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {path.chapters.map((chapter, index) => {
                  const chosen = chapter.weekOf === plans;
                  return (
                    <li key={chapter.id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-sm">
                      <span className="min-w-0 flex-1 break-words">
                        {chapter.title}
                        {index === 0 && <span className="ml-2 text-[11px] text-accent">next</span>}
                      </span>
                      {chapter.weekOf && !chosen && (
                        <WeekChip label={chapter.weekOf === thisWeek ? "This week" : `Week of ${chapter.weekOf}`} now={false} />
                      )}
                      <form action={setChapterWeek}>
                        <Hidden id={chapter.id} weekOf={chosen ? "" : plans} />
                        <button
                          className={`shrink-0 text-xs hover:underline ${chosen ? "font-medium" : "text-muted"}`}
                          title={chosen ? `Unchoose ${chapter.title}` : `Choose ${chapter.title}`}
                          aria-pressed={chosen}
                        >
                          {chosen ? "✓ Chosen" : "Choose"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function FinishedReview({ review }: { review: ReviewView }) {
  return (
    <>
      <EditReview key={review.week} week={review.week} score={review.score} notes={review.notes} />
      <div className="flex flex-col gap-1">
        <h3 className="label">Moves chosen for the week of {addDays(review.week, 7)}</h3>
        {review.moves.length === 0 ? <Empty>No Moves were chosen.</Empty> : <MoveList moves={review.moves} />}
      </div>
      <Entries entries={review.entries} />
    </>
  );
}

function NoReview({ pending, today }: { pending: OpenReview | null; today: string }) {
  if (pending) {
    return (
      <Link href={`/os/week/${pending.week}?review=look`} className="btn-primary self-start">
        Start the Review
      </Link>
    );
  }
  return <Empty>No Review for this week. The next one opens on Sunday {nextReviewDay(today)}.</Empty>;
}

function Entries({ entries }: { entries: LearningEntry[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="label">Learning Log</h3>
      {entries.length === 0 ? (
        <Empty>Nothing in the Learning Log this week.</Empty>
      ) : (
        <ReviewLearningEntries entries={entries} />
      )}
    </div>
  );
}

function MoveList({ moves }: { moves: ReviewMove[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {moves.map((move, index) => (
        <li key={move.moveId ?? `deleted-${index}`} className="flex gap-2">
          <span className={`w-4 shrink-0 ${move.done ? "" : "text-muted"}`} aria-label={move.done ? "Done" : "Not done"}>
            {move.done ? "✓" : "○"}
          </span>
          <span className={`min-w-0 flex-1 break-words ${move.done ? "" : "text-muted"}`}>{move.title}</span>
        </li>
      ))}
    </ul>
  );
}

async function AllReviews({ week, today, open }: { week: string; today: string; open: boolean }) {
  const rows = await getReviewHistory(today);
  if (rows.length === 0) return null;
  return (
    <details open={open} className="border-t border-line pt-3">
      <summary className="label cursor-pointer">All Reviews</summary>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {rows.map((row) => (
          <li key={row.week}>
            <Link
              href={`/os/week/${row.week}?review=read`}
              className={`hover:underline ${row.status === "skipped" ? "text-muted" : ""} ${row.week === week ? "font-medium" : ""}`}
            >
              Week of {row.week}
              {row.status === "done"
                ? ` · ${row.score} · ${row.movesDone}/${row.movesTotal}`
                : " · Skipped"}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
