import Link from "next/link";
import { NewDiscovery } from "@/components/discovery/new-discovery";
import { PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { listDiscoveries } from "@/server/discoveries";

export const metadata = { title: "Discoveries" };

const STATUS = { draft: "Draft", open: "Open", closed: "Closed" } as Record<string, string>;

/** Interviews with Stakeholders, led by an AI that knows the Brief they never see. */
export default async function DiscoveriesPage() {
  await requireIvan();
  const discoveries = await listDiscoveries();
  return (
    <>
      <PageTitle>Discoveries</PageTitle>
      <p className="-mt-2 text-sm text-muted">
        People I build for, interviewed by an AI in short rounds: their Needs and their Vision, in their own words.
      </p>
      <NewDiscovery />
      {discoveries.length === 0 && <p className="text-sm text-muted">No Discoveries yet.</p>}
      <ul className="flex flex-col gap-2">
        {discoveries.map((d) => (
          <li key={d.id}>
            <Link href={`/os/profile/discoveries/${d.id}`} className="card flex items-center gap-3 hover:border-accent">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.title}</span>
                <span className="text-xs text-muted">
                  {d.themes} Themes · {d.stakeholders} Stakeholders · {d.language === "es" ? "Spanish" : "English"}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  d.status === "open" ? "bg-accent/15 text-accent" : d.status === "draft" ? "bg-amber-100 text-amber-900" : "bg-line text-muted"
                }`}
              >
                {STATUS[d.status] ?? d.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
