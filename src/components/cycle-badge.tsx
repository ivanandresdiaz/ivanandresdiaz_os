"use client";

import Link from "next/link";
import { cyclePhase } from "@/domain/cycles";
import { formatCountdown, useNow } from "./use-now";

/** The running Cycle in the header, so it is never forgotten. */
export function CycleBadge({
  cycle,
}: {
  cycle: { startedAt: Date; endedAt: Date | null; focusMin: number; breakMin: number; title: string };
}) {
  const now = useNow(1000);
  if (!now) return null;
  const phase = cyclePhase(cycle, now);
  if (phase.phase === "over") return null;
  const focus = phase.phase === "focus";
  return (
    <Link
      href="/os/focus"
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        focus ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-teal-500/15 text-teal-700 dark:text-teal-400"
      }`}
      title={cycle.title}
    >
      <span className={focus ? "animate-pulse" : ""}>{focus ? "●" : "☕"}</span>
      <span className="font-mono tabular-nums">{formatCountdown(phase.remainingMs)}</span>
      <span className="hidden max-w-40 truncate sm:inline">{focus ? cycle.title : "Break"}</span>
    </Link>
  );
}
