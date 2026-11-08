"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

const NAV = [
  { href: "/os", label: "Today", also: ["/os/day"] },
  { href: "/os/week", label: "Week", also: ["/os/month"] },
  { href: "/os/focus", label: "Focus", also: [] },
  { href: "/os/feed", label: "Feed", also: [] },
  { href: "/os/plan", label: "Plan", also: ["/os/campaigns"] },
  { href: "/os/learning", label: "Learning", also: [] },
  { href: "/os/structure", label: "Structure", also: [] },
  { href: "/os/principles", label: "Principles", also: [] },
];

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

function isActive(pathname: string | null, item: (typeof NAV)[number]) {
  if (pathname === null) return false;
  // "/os" is a prefix of every page, so Today only claims itself and its days.
  if (item.href === "/os" ? pathname === "/os" : under(pathname, item.href)) return true;
  return item.also.some((prefix) => under(pathname, prefix));
}

type Placement = "top" | "bottom";

/**
 * The OS navigation: inline in the header on wide screens; on a phone, a bar
 * fixed at the bottom, within reach of the thumb and away from the status bar.
 */
export function OsNav({ placement }: { placement: Placement }) {
  // The pathname of a dated page is unknown while prerendering: show the links
  // without the current tab until it is.
  return (
    <Suspense fallback={<Nav placement={placement} pathname={null} />}>
      <CurrentNav placement={placement} />
    </Suspense>
  );
}

function CurrentNav({ placement }: { placement: Placement }) {
  return <Nav placement={placement} pathname={usePathname()} />;
}

function Nav({ placement, pathname }: { placement: Placement; pathname: string | null }) {
  const nav = useRef<HTMLElement>(null);

  // The bottom bar scrolls sideways; keep the current page's tab in view.
  useEffect(() => {
    const bar = nav.current;
    const active = bar?.querySelector<HTMLElement>("[aria-current=page]");
    if (!bar || !active) return;
    bar.scrollTo({ left: active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2 });
  }, [pathname]);

  const links = NAV.map((item) => {
    const active = isActive(pathname, item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 shrink-0 items-center rounded px-3 text-sm hover:bg-background ${
          active ? "font-medium text-accent" : "text-muted hover:text-foreground"
        }`}
      >
        {item.label}
      </Link>
    );
  });

  if (placement === "top") {
    return <nav className="hidden flex-1 gap-1 overflow-x-auto md:flex">{links}</nav>;
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <nav ref={nav} className="flex gap-1 overflow-x-auto px-2 py-1">
        {links}
      </nav>
    </div>
  );
}
