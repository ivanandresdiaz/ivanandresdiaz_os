import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth, isAllowedEmail, signOut } from "@/auth";
import { CycleBadge } from "@/components/cycle-badge";
import { PwaSetup } from "@/components/pwa";
import { getActiveCycle } from "@/server/queries";

const NAV = [
  { href: "/os", label: "Today" },
  { href: "/os/week", label: "Week" },
  { href: "/os/focus", label: "Focus" },
  { href: "/os/plan", label: "Plan" },
  { href: "/os/structure", label: "Structure" },
  { href: "/os/principles", label: "Principles" },
];

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
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PwaSetup />
      <header className="flex items-center gap-4 border-b border-line bg-surface px-4 py-2">
        <Link href="/os" className="font-semibold tracking-tight">
          Ivan OS
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded px-2 py-1 text-muted hover:bg-background hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={null}>
          <ActiveCycle />
        </Suspense>
        <form action={logout}>
          <button className="text-xs text-muted hover:underline">Sign out</button>
        </form>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
