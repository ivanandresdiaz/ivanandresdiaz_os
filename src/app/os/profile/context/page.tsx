import { ContextBuilder } from "@/components/context-builder";
import { PageTitle } from "@/components/ui";
import { requireIvan } from "@/lib/session";
import { getContextSource } from "@/server/queries";

export const metadata = { title: "Context" };

/** Where Ivan builds the Context he copies into an AI. */
export default async function ContextPage() {
  await requireIvan();
  const source = await getContextSource();

  return (
    <>
      <PageTitle>Context</PageTitle>
      <ContextBuilder source={source} />
    </>
  );
}
