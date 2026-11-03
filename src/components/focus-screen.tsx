"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { cyclePhase, type CyclePhase } from "@/domain/cycles";
import { formatDuration } from "@/domain/dates";
import { notify } from "@/lib/notify";
import { endCycle, startCycle, toggleStep, toggleWorkDone } from "@/server/actions";
import { linkLabel } from "@/domain/links";
import type { CycleView } from "@/server/queries";
import { Markdown } from "./markdown";
import { NotificationsToggle } from "./pwa";
import { formatCountdown, useNow } from "./use-now";

type Preset = { id: string; name: string; focusMin: number; breakMin: number };

const BREATH_MS = 6000;

/** The dark palette, for content that uses the theme tokens (the Markdown of a Description). */
const DARK_TOKENS = {
  "--foreground": "#e7e5e4",
  "--muted": "#a8a29e",
  "--line": "#292524",
  "--accent": "#f59e0b",
} as React.CSSProperties;

/**
 * The focus screen: a breathing animation on entry, then one big countdown
 * for the focus, then the break. The Cycle can be closed at any moment.
 */
export function FocusScreen({ cycle, presets }: { cycle: CycleView; presets: Preset[] }) {
  const now = useNow(1000);
  const [breathing, setBreathing] = useState(true);
  const [pending, startTransition] = useTransition();
  const phase: CyclePhase | null = now ? cyclePhase(cycle, now) : null;
  const title = cycle.work?.title ?? (cycle.label || "Focus");

  useEffect(() => {
    const timer = setTimeout(() => setBreathing(false), BREATH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Announce phase changes (focus → break → over) once each.
  const lastPhase = useRef<CyclePhase["phase"] | null>(null);
  useEffect(() => {
    if (!phase) return;
    const previous = lastPhase.current;
    lastPhase.current = phase.phase;
    if (previous === "focus" && phase.phase === "break") {
      void notify("Focus done ✓", `${title} — take ${cycle.breakMin} min: move, coffee, water.`);
    } else if (previous && previous !== "over" && phase.phase === "over") {
      void notify("Break over", "Ready for the next Cycle?");
    }
  }, [phase, title, cycle.breakMin]);

  useEffect(() => {
    if (!phase || phase.phase === "over") return;
    const label = phase.phase === "focus" ? "Focus" : "Break";
    document.title = `${formatCountdown(phase.remainingMs)} · ${label}`;
    return () => {
      document.title = "Ivan OS";
    };
  }, [phase]);

  const samePreset = presets.find((p) => p.focusMin === cycle.focusMin && p.breakMin === cycle.breakMin);
  const again = () =>
    startTransition(async () => {
      await startCycle({ presetId: samePreset?.id, work: cycle.work ? { kind: cycle.work.kind, id: cycle.work.id } : null, label: cycle.label });
      setBreathing(true);
      setTimeout(() => setBreathing(false), BREATH_MS);
    });
  const close = () => startTransition(() => endCycle({ id: cycle.id }));

  if (breathing) {
    return (
      <div
        className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-10 bg-stone-950 text-stone-200"
        onClick={() => setBreathing(false)}
      >
        <div className="breathe h-40 w-40 rounded-full bg-amber-500/30 ring-2 ring-amber-500/60" />
        <div className="breathe-text text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-stone-400">Breathe in · breathe out</p>
          <p className="mt-3 text-2xl font-light">One thing: {title}</p>
        </div>
        <p className="absolute bottom-8 text-xs text-stone-500">Click to skip</p>
      </div>
    );
  }

  const ring = phase && phase.phase !== "over" ? phase.progress : 1;
  const inBreak = phase?.phase === "break";
  const over = phase?.phase === "over";
  const R = 120;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-y-auto bg-stone-950 p-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-stone-200">
      <Link href="/os" className="absolute left-5 top-4 text-sm text-stone-500 hover:text-stone-300">
        ← Back to the OS
      </Link>
      <div className="absolute right-5 top-3">
        <NotificationsToggle className="rounded-md border border-stone-700 px-2.5 py-1 text-sm text-stone-300 hover:border-amber-500" />
      </div>

      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
          {inBreak ? "Break — move, coffee, water" : over ? "Cycle complete" : "Focus"}
        </p>
        <h1 className="mt-2 text-2xl font-medium">{title}</h1>
        {cycle.work?.campaignTitle && <p className="text-sm text-stone-500">{cycle.work.campaignTitle}</p>}
        {cycle.startDelayMin !== null && cycle.startDelayMin !== 0 && (
          <p className="mt-1 text-xs text-stone-500">
            Started {Math.abs(cycle.startDelayMin)} min {cycle.startDelayMin > 0 ? "after" : "before"} the plan
          </p>
        )}
      </div>

      <div className="relative">
        <svg width={280} height={280} className="-rotate-90">
          <circle cx={140} cy={140} r={R} fill="none" stroke="#292524" strokeWidth={10} />
          <circle
            cx={140}
            cy={140}
            r={R}
            fill="none"
            stroke={inBreak ? "#4d908e" : "#f59e0b"}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - ring)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-6xl tabular-nums">
            {phase && phase.phase !== "over" ? formatCountdown(phase.remainingMs) : "✓"}
          </span>
          <span className="mt-1 text-xs text-stone-500">
            {cycle.focusMin} + {cycle.breakMin} min
          </span>
        </div>
      </div>

      {cycle.steps.length > 0 && (
        <ul className="w-full max-w-sm space-y-1">
          {cycle.steps.map((step) => (
            <li key={step.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={step.done}
                  onChange={() => {
                    const fd = new FormData();
                    fd.set("id", step.id);
                    void toggleStep(fd);
                  }}
                />
                <span className={step.done ? "text-stone-500 line-through" : ""}>{step.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {(cycle.links.length > 0 || cycle.description.trim() !== "") && (
        // The focus screen is always dark: its Markdown and Links take the dark colors.
        <div className="flex w-full max-w-sm flex-col gap-2 text-sm" style={DARK_TOKENS}>
          {cycle.links.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Links">
              {cycle.links.map((link) => (
                <li key={link.id} className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden="true" className="text-stone-500">
                    ↗
                  </span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.url}
                    className="min-w-0 truncate text-amber-400 underline-offset-2 hover:underline"
                  >
                    {linkLabel(link)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {cycle.description.trim() !== "" && (
            <details className="rounded-md border border-stone-800 px-3 py-2">
              <summary className="cursor-pointer text-stone-400">Description</summary>
              <div className="mt-2 text-stone-300">
                <Markdown>{cycle.description}</Markdown>
              </div>
            </details>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {cycle.work && (
          <button
            type="button"
            disabled={pending}
            className="rounded-md border border-stone-700 px-3 py-1.5 text-sm hover:border-amber-500"
            onClick={() => startTransition(() => toggleWorkDone({ kind: cycle.work!.kind, id: cycle.work!.id }))}
          >
            {cycle.work.done ? "☑ Done" : "☐ Mark done"}
          </button>
        )}
        {(inBreak || over) && (
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-stone-950 hover:opacity-90"
            onClick={again}
          >
            ▶ Next Cycle
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-stone-700 px-3 py-1.5 text-sm text-stone-400 hover:border-stone-500"
          onClick={close}
          title={inBreak ? "End the break now" : "Stop now — the real time is kept"}
        >
          {inBreak || over ? "Done for now" : "Close Cycle"}
        </button>
      </div>
      {phase?.phase === "focus" && (
        <p className="text-xs text-stone-600">
          {formatDuration(((now?.getTime() ?? 0) - cycle.startedAt.getTime()) / 60_000)} in so far
        </p>
      )}
    </div>
  );
}
