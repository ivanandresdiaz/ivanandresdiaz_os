import Link from "next/link";
import { firstName, ROUNDS, type Stage } from "@/domain/discovery";
import type { ThemeCard } from "@/server/stakeholder-views";
import { Markdown } from "../markdown";
import type { Copy } from "./copy";
import { IvanSays } from "./ivan-says";
import { OpeningPanel } from "./opening-panel";
import { SignOutButton } from "./sign-out-button";

/** The frame every Stakeholder screen shares: who invites, the Discovery's name, and what comes below. */
export function DiscoveryFrame({
  title,
  copy,
  children,
  aside,
}: {
  title: string;
  copy: Copy;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">{copy.invites}</p>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">{title}</h1>
        </div>
        {aside}
      </header>
      {children}
    </div>
  );
}

/** Who reads this, and what not to write (Q46, Q52): always on top. */
export function PromiseNote({ copy }: { copy: Copy }) {
  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-accent/10 p-5">
      <h2 className="text-sm font-semibold text-accent">{copy.promiseTitle}</h2>
      <ul className="flex flex-col gap-2 text-[15px] leading-relaxed">
        {copy.promise.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-5 shrink-0 text-center text-accent" aria-hidden>
              {["◎", "🔒", "⚠"][i] ?? "•"}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function status(copy: Copy, i: ThemeCard["interview"]) {
  if (!i) return { label: copy.notStarted, action: copy.start, tone: "text-muted" };
  if (i.phase === "done") return { label: copy.finished, action: copy.view, tone: "text-accent" };
  if (i.phase === "failed") return { label: copy.stuck, action: copy.continue, tone: "text-amber-700" };
  if (i.phase === "closing") return { label: copy.closing, action: copy.continue, tone: "text-accent" };
  return { label: copy.inProgress(i.round, ROUNDS[i.stage]), action: copy.continue, tone: "text-accent" };
}

export function StakeholderHome({
  slug,
  title,
  name,
  isTest,
  copy,
  opening,
  images,
  themes,
  stages,
}: {
  slug: string;
  title: string;
  name: string;
  isTest: boolean;
  copy: Copy;
  opening: string;
  images: { id: string; description: string; url: string }[];
  themes: ThemeCard[];
  stages: Stage[];
}) {
  const started = themes.some((t) => t.interview);
  const left = themes.filter((t) => t.interview?.phase !== "done").length;
  const allDone = themes.length > 0 && left === 0;
  return (
    <DiscoveryFrame
      title={title}
      copy={copy}
      aside={<SignOutButton slug={slug} look="link" label={copy.signOut} />}
    >
      {isTest && <p className="rounded-2xl bg-amber-100 px-4 py-2 text-sm text-amber-900">{copy.testBanner}</p>}
      <IvanSays>
        {allDone
          ? copy.ivanDone(firstName(name))
          : started
            ? copy.ivanProgress(firstName(name), left, themes.length)
            : copy.ivanStart(firstName(name))}
      </IvanSays>
      {allDone && <SignOutButton slug={slug} look="primary" label={isTest ? copy.finishTest : copy.finishAndSignOut} />}
      <PromiseNote copy={copy} />

      {(opening.trim() || images.length > 0) && (
        <OpeningPanel startOpen={!started} showLabel={copy.seeOpening} hideLabel={copy.hideOpening}>
          {opening.trim() && (
            <div className="rounded-3xl border border-line bg-surface p-5 [&_div]:text-[15px] [&_div]:text-foreground">
              <Markdown>{opening}</Markdown>
            </div>
          )}
          {images.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-3xl border border-line bg-surface">
              <a href={image.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.description} loading="lazy" className="w-full bg-white object-contain" />
              </a>
              {image.description && <figcaption className="px-4 py-3 text-sm text-muted">{image.description}</figcaption>}
            </figure>
          ))}
        </OpeningPanel>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold">{copy.themesTitle}</h2>
          <p className="text-sm text-muted">{copy.themesHint}</p>
        </div>
        {themes.map((theme) => {
          const st = status(copy, theme.interview);
          return (
            <Link
              key={theme.id}
              href={`/d/${slug}/t/${theme.id}`}
              className="card-in group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm transition active:scale-[0.99] hover:border-accent/50"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-semibold">{theme.title}</span>
                {theme.description && <span className="text-sm text-muted">{theme.description}</span>}
                <span className={`text-xs font-medium ${st.tone}`}>
                  {stages.length > 1 && theme.interview && theme.interview.phase !== "done"
                    ? `${theme.interview.stage === "needs" ? copy.needs : copy.vision} · `
                    : ""}
                  {st.label}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">{st.action}</span>
            </Link>
          );
        })}
      </section>
    </DiscoveryFrame>
  );
}

/** After signing out (Q6): a goodbye by name instead of the email form, with a way back in. */
export function Goodbye({ slug, name, copy }: { slug: string; name: string; copy: Copy }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="sr-only">{copy.ivanGoodbye(name)}</h1>
      <IvanSays>{copy.ivanGoodbye(name)}</IvanSays>
      <p className="text-center text-muted">{copy.goodbyeBody}</p>
      <Link href={`/d/${slug}?entrar=1`} className="min-h-11 self-center text-sm text-muted underline underline-offset-4">
        {copy.goodbyeBack}
      </Link>
    </div>
  );
}

/** A screen with nothing to do but read one message (closed, not open yet, unknown link). */
export function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}
