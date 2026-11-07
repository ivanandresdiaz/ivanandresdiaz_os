import { redirect } from "next/navigation";

/** The Profile opens on its first option. */
export default function ProfilePage() {
  redirect("/os/profile/context");
}
