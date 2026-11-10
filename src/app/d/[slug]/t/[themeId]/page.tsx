import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { copyFor } from "@/components/discovery/copy";
import { InterviewScreen } from "@/components/discovery/interview";
import { SLUG } from "@/domain/discovery";
import { access } from "@/server/stakeholder-session";
import { stakeholderInterview } from "@/server/stakeholder-views";

// Writing a round takes the AI up to a few minutes; the page's Server Actions wait for it.
export const maxDuration = 300;

/** One Theme's Interview. Someone signed out, or a closed Discovery, goes back to the link's home. */
export default async function ThemePage({ params }: PageProps<"/d/[slug]/t/[themeId]">) {
  const { slug, themeId } = await params;
  if (!SLUG.test(slug) || !z.uuid().safeParse(themeId).success) notFound();
  await connection();
  const found = await access(slug);
  if (found.kind === "missing") notFound();
  if (found.kind !== "in") redirect(`/d/${slug}`);
  const copy = copyFor(found.discovery.language);
  const props = await stakeholderInterview(found.discovery, found.stakeholder, themeId, copy.other);
  if (!props) notFound();
  return (
    <div lang={found.discovery.language} className="flex flex-1 flex-col">
      <InterviewScreen {...props} />
    </div>
  );
}
