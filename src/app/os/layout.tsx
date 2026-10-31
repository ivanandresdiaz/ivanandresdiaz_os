import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/auth";

const NAV = [
  { href: "/os", label: "Today" },
  { href: "/os/week", label: "Week" },
  { href: "/os/plan", label: "Plan" },
  { href: "/os/structure", label: "Structure" },
  { href: "/os/principles", label: "Principles" },
];

export default function OsLayout({ children }: LayoutProps<"/os">) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-surface px-4 py-2">
        <Link href="/os" className="font-semibold tracking-tight">
          Ivan OS
        </Link>
        <nav className="flex flex-1 gap-1 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded px-2 py-1 text-muted hover:bg-background hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
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
