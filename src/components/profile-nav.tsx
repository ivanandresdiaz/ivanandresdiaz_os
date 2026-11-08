"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";

const OPTIONS = [
  { href: "/os/profile/context", label: "Context" },
  { href: "/os/profile/clips", label: "Clips" },
  { href: "/os/profile/vaults", label: "Vaults" },
];

const optionClass = (active: boolean) =>
  `flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm md:min-h-9 ${
    active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-line/60 hover:text-foreground"
  }`;

/**
 * The Profile's options: a vertical sidebar on a computer, a row of tabs on a
 * phone. Sign out is the last option and always asks first.
 */
type NavProps = {
  email: string | null;
  /** How many Clips wait in the bank; null until known. */
  clips: number | null;
  logout: () => Promise<void>;
};

export function ProfileNav(props: NavProps) {
  // The pathname is unknown while prerendering: show the options without the current one until it is.
  return (
    <Suspense fallback={<Nav {...props} pathname={null} />}>
      <CurrentNav {...props} />
    </Suspense>
  );
}

function CurrentNav(props: NavProps) {
  return <Nav {...props} pathname={usePathname()} />;
}

function Nav({ email, clips, logout, pathname }: NavProps & { pathname: string | null }) {
  const [asking, setAsking] = useState(false);

  return (
    <nav
      aria-label="Profile"
      className="flex gap-1 overflow-x-auto border-b border-line pb-2 md:sticky md:top-20 md:w-48 md:shrink-0 md:flex-col md:overflow-visible md:border-r md:border-b-0 md:pr-4 md:pb-0"
    >
      <p className="label hidden px-3 pb-1 md:block">Profile</p>
      {OPTIONS.map((option) => {
        const active = pathname === option.href || !!pathname?.startsWith(`${option.href}/`);
        return (
          <Link
            key={option.href}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={optionClass(active)}
          >
            {option.label}
            {option.label === "Clips" && !!clips && (
              <span className="ml-2 text-xs text-muted tabular-nums" aria-label={`${clips} waiting`}>
                {clips}
              </span>
            )}
          </Link>
        );
      })}
      <div className="hidden md:mt-4 md:block md:border-t md:border-line md:pt-3" />
      {email && <p className="hidden truncate px-3 pb-1 text-xs text-muted md:block">Signed in as {email}</p>}
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={`${optionClass(false)} ml-auto text-left hover:text-red-600 md:ml-0`}
      >
        Sign out
      </button>
      {asking && <SignOutDialog email={email} logout={logout} onClose={() => setAsking(false)} />}
    </nav>
  );
}

/** Focus starts on Cancel, so Enter or Escape never signs out; only the red button does. */
function SignOutDialog({
  email,
  logout,
  onClose,
}: {
  email: string | null;
  logout: () => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    cancel.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-label="Sign out of Ivan OS?"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 p-4 text-sm">
        <h2 className="font-semibold">Sign out of Ivan OS?</h2>
        {email && <p className="text-muted">You&apos;re signed in as {email}.</p>}
        <div className="flex items-center justify-end gap-2">
          <button ref={cancel} type="button" className="btn" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="btn border-red-600 bg-red-600 text-white hover:bg-red-700"
            disabled={pending}
            onClick={() => startTransition(() => logout())}
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
