"use client";

import { useTransition } from "react";
import { rewriteInsights } from "@/server/discovery-actions";

export function RewriteInsights({ interviewId }: { interviewId: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending} onClick={() => start(() => rewriteInsights({ interviewId }))}>
      {pending ? "Rewriting…" : "Rewrite Insights"}
    </button>
  );
}
