import { signOut } from "@/auth";
import { ContextBuilder } from "@/components/context-builder";
import { PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { getContextSource } from "@/server/queries";

export const metadata = { title: "Profile" };

/** Ivan's place in Ivan OS: where he builds his Context and signs out. */
export default async function ProfilePage() {
  const user = await requireIvan();
  const source = await getContextSource();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <>
      <PageTitle>Profile</PageTitle>
      {user.email && <p className="-mt-2 text-sm text-muted">Signed in as {user.email}</p>}
      <ContextBuilder source={source} />
      <form action={logout} className="mt-2">
        <button className="btn text-red-600">Sign out</button>
      </form>
    </>
  );
}
