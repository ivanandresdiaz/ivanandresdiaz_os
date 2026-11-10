"use client";

import { useEffect, useState } from "react";
import type { Copy } from "./copy";
import { IvanSays } from "./ivan-says";

/** One of the person's Themes, and how many of its steps are behind them. */
export type ThemeProgress = {
  id: string;
  title: string;
  done: boolean;
  steps: { done: number; total: number };
};

/**
 * Where they are across all their Themes (Ronda 57): one segment per Theme,
 * filling with every round, so nobody fears an endless list of questions.
 * `celebrate` fills that Theme's segment in front of them.
 */
export function ThemesBar({
  themes,
  label,
  current,
  celebrate,
  size,
}: {
  themes: ThemeProgress[];
  /** What a screen reader calls it; a string, so a Server Component can pass it. */
  label: string;
  current?: string;
  celebrate?: string | null;
  size: "thin" | "big";
}) {
  const done = themes.reduce((n, t) => n + t.steps.done, 0);
  const total = themes.reduce((n, t) => n + t.steps.total, 0);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className={`flex w-full ${size === "big" ? "gap-1.5" : "gap-1"}`}
    >
      {themes.map((t) => (
        <Segment
          key={t.id}
          share={t.steps.total ? t.steps.done / t.steps.total : 0}
          current={t.id === current}
          grow={t.id === celebrate}
          size={size}
        />
      ))}
    </div>
  );
}

function Segment({ share, current, grow, size }: { share: number; current: boolean; grow: boolean; size: "thin" | "big" }) {
  // A Theme just finished starts a little short and fills up as the screen opens.
  const [shown, setShown] = useState(grow ? Math.min(share, 0.85) : share);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(share));
    return () => cancelAnimationFrame(frame);
  }, [share]);
  return (
    <div
      className={`flex-1 overflow-hidden rounded-full ${size === "big" ? "h-3" : "h-1.5"} ${
        current ? "bg-accent/25 ring-1 ring-accent/40" : "bg-accent/15"
      }`}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-out motion-reduce:transition-none"
        style={{ width: `${Math.round(shown * 100)}%` }}
      />
    </div>
  );
}

/**
 * The moment a Theme ends, so it never feels like the end of everything:
 * how many are done, the bar filling, Ivan cheering, and how many are left.
 */
export function ThemeCheer({
  copy,
  name,
  themes,
  finished,
  children,
}: {
  copy: Copy;
  name: string;
  themes: ThemeProgress[];
  /** The Theme just finished, whose segment fills. */
  finished: string;
  children?: React.ReactNode;
}) {
  const done = themes.filter((t) => t.done).length;
  const left = themes.length - done;
  return (
    <section className="card-in flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-center text-xl font-semibold">{copy.themeReady(done, themes.length)}</h2>
      <ThemesBar themes={themes} label={copy.progressLabel} celebrate={finished} size="big" />
      <IvanSays>{copy.ivanCheer(name, left)}</IvanSays>
      <p className="text-center text-sm font-medium text-accent">{copy.leftGo(left)}</p>
      {children}
    </section>
  );
}
