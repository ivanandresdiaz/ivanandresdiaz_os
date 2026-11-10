"use client";

import { useFormStatus } from "react-dom";
import { signOutStakeholder } from "@/server/stakeholder-actions";

const LOOK = {
  primary: "min-h-12 w-full rounded-full bg-accent px-6 text-sm font-medium text-white shadow-sm active:scale-[0.99]",
  quiet: "min-h-11 w-full text-sm text-muted underline underline-offset-4",
  link: "min-h-11 shrink-0 text-xs text-muted underline underline-offset-4",
} as const;

/** Signs the Stakeholder out: a goodbye by name, or Ivan's editor after a test. */
export function SignOutButton({ slug, label, look }: { slug: string; label: string; look: keyof typeof LOOK }) {
  return (
    <form action={signOutStakeholder.bind(null, { slug })} className={look === "link" ? undefined : "w-full"}>
      <Submit label={label} className={LOOK[look]} />
    </form>
  );
}

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {pending ? `${label}…` : label}
    </button>
  );
}
