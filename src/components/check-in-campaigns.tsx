"use client";

import Link from "next/link";
import { useRemembered } from "./use-remembered";

/** The Campaigns of the Check-in: always their titles; the label shows or hides their Goals. */
export function CheckInCampaigns({
  label,
  campaigns,
}: {
  label: string;
  campaigns: { id: string; title: string; goal: string }[];
}) {
  const [remembered, remember] = useRemembered("check-in:goals-open");
  const open = remembered === "1";

  return (
    <div>
      {campaigns.some((c) => c.goal) ? (
        <button
          type="button"
          aria-expanded={open}
          title={open ? "Hide Goals" : "Show Goals"}
          onClick={() => remember(open ? "0" : "1")}
          className="label flex cursor-pointer items-center gap-1"
        >
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
          {label}
        </button>
      ) : (
        <div className="label">{label}</div>
      )}
      <ul className="mt-1 space-y-1 text-sm">
        {campaigns.map((c) => (
          <li key={c.id}>
            <Link href={`/os/plan?campaign=${c.id}&col=campaign`} className="font-medium hover:underline">
              {c.title}
            </Link>
            {open && c.goal && <p className="text-muted">{c.goal}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
