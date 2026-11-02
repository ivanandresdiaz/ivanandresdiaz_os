"use client";

import Link from "next/link";
import { reorderCampaigns } from "@/server/actions";
import { ClosedList, PriorityList } from "./priority-list";

export type CampaignCard = {
  id: string;
  title: string;
  status: "candidate" | "active" | "done" | "dropped";
  goal: string;
  block: { name: string; color: string } | null;
  /** Opens the Campaign next to the Strategy column. */
  href: string;
};

/**
 * A Quarter's Campaigns (or the Backlog's candidates) in Ivan's priority: drag the ⠿ to reorder
 * the open ones. Done and dropped ones sit below, out of the priority.
 */
export function CampaignPriority({
  open,
  closed = [],
  selectedId,
}: {
  open: CampaignCard[];
  closed?: CampaignCard[];
  selectedId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <PriorityList items={open} selectedId={selectedId} save={(ids) => reorderCampaigns({ ids })}>
        {(campaign) => <CampaignLink campaign={campaign} />}
      </PriorityList>
      <ClosedList items={closed} selectedId={selectedId}>
        {(campaign) => <CampaignLink campaign={campaign} />}
      </ClosedList>
    </div>
  );
}

function CampaignLink({ campaign }: { campaign: CampaignCard }) {
  const closed = campaign.status === "done" || campaign.status === "dropped";
  return (
    <Link href={campaign.href} className="group flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5">
        {campaign.block && (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: campaign.block.color }}
            title={`Played in: ${campaign.block.name}`}
          />
        )}
        <span className="truncate text-sm font-medium group-hover:text-accent">{campaign.title}</span>
        {closed && <span className="text-xs text-muted">{campaign.status}</span>}
      </div>
      {campaign.goal && <p className="truncate text-xs text-muted">{campaign.goal}</p>}
    </Link>
  );
}
