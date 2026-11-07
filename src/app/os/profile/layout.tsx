import { Suspense } from "react";
import { signOut } from "@/auth";
import { ProfileNav } from "@/components/profile-nav";
import { requireIvan } from "@/lib/session";

async function logout() {
  "use server";
  await signOut({ redirectTo: "/" });
}

/** The sidebar with the signed-in email, which arrives with the session. */
async function NavWithEmail() {
  const user = await requireIvan();
  return <ProfileNav email={user.email ?? null} logout={logout} />;
}

/** The Profile: its options in a sidebar (tabs on a phone) beside the one that is open. */
export default function ProfileLayout({ children }: LayoutProps<"/os/profile">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:flex-row md:items-start md:gap-8">
      <Suspense fallback={<ProfileNav email={null} logout={logout} />}>
        <NavWithEmail />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}
