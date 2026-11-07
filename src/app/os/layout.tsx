import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth, isAllowedEmail } from "@/auth";
import { CycleBadge } from "@/components/cycle-badge";
import { OsNav } from "@/components/os-nav";
import { PwaSetup } from "@/components/pwa";
import { getActiveCycle } from "@/server/queries";

/** Shows the running Cycle; renders nothing when signed out or idle. */
async function ActiveCycle() {
  await connection();
  const session = await auth();
  if (!isAllowedEmail(session?.user?.email)) return null;
  const cycle = await getActiveCycle();
  if (!cycle) return null;
  return <CycleBadge cycle={{ ...cycle, title: cycle.work?.title ?? (cycle.label || "Focus") }} />;
}

export default function OsLayout({ children }: LayoutProps<"/os">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PwaSetup />
      {/* 12px below the status bar of the installed iPhone app, so nothing sits under the clock. */}
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-line bg-surface px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-1">
        <Link href="/os" className="flex min-h-11 items-center font-semibold tracking-tight">
          Ivan OS
        </Link>
        <OsNav placement="top" />
        <div className="flex-1 md:hidden" />
        <Suspense fallback={null}>
          <ActiveCycle />
        </Suspense>
        <Link href="/os/profile" className="flex min-h-11 items-center text-xs whitespace-nowrap text-muted hover:underline">
          Profile
        </Link>
      </header>
      {/* On a phone the bottom bar covers the last 3.5rem; leave room to scroll past it. */}
      <main className="flex flex-1 flex-col gap-4 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>{children}</Suspense>
      </main>
      <OsNav placement="bottom" />
    </div>
  );
}
