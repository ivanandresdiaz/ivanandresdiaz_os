"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { startCycle } from "@/server/actions";

/** ▶ Starts a Cycle on this work right away (default preset) and opens the focus screen. */
export function StartCycleButton({
  work,
  slotId,
  className = "",
}: {
  work?: { kind: "task" | "move"; id: string };
  slotId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Start a Cycle on this"
      className={`text-accent hover:scale-110 disabled:opacity-40 ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() =>
        startTransition(async () => {
          await startCycle({ work, slotId });
          router.push("/os/focus");
        })
      }
    >
      ▶
    </button>
  );
}
