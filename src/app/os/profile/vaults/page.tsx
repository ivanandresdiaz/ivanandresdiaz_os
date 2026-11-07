import { PageTitle } from "@/components/ui";
import { Vaults } from "@/components/vaults";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getVaultsView } from "@/server/queries";

export const metadata = { title: "Vaults" };

/** Cold storage for Secrets, opened only with the Passphrase. */
export default async function VaultsPage() {
  await requireIvan();
  const view = await getVaultsView();

  return (
    <>
      <PageTitle>Vaults</PageTitle>
      <p className="-mt-2 text-sm text-muted">
        Secrets I almost never open. Encrypted in this browser; Ivan OS only stores what it can&apos;t read.
      </p>
      <Vaults view={view} today={today()} />
    </>
  );
}
