import { notFound } from "next/navigation";
import { copyFor } from "@/components/discovery/copy";
import { DiscoveryFrame, Goodbye, Notice, PromiseNote, StakeholderHome } from "@/components/discovery/home";
import { IvanSays } from "@/components/discovery/ivan-says";
import { SignIn } from "@/components/discovery/sign-in";
import { type Language, SLUG } from "@/domain/discovery";
import { access, goodbyeName } from "@/server/stakeholder-session";
import { stakeholderHome } from "@/server/stakeholder-views";

/** The one link a Discovery has (Q11): sign in, then the Opening and this person's Themes. */
export default async function DiscoveryPage({ params, searchParams }: PageProps<"/d/[slug]">) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const found = await access(slug);
  if (found.kind === "missing") notFound();
  const { discovery } = found;
  const copy = copyFor(discovery.language);

  if (found.kind === "closed") return <Page lang={discovery.language}><Notice title={copy.closedTitle} body={copy.closedBody} /></Page>;
  if (found.kind === "draft") return <Page lang={discovery.language}><Notice title={copy.draftTitle} body={copy.draftBody} /></Page>;
  if (found.kind === "out") {
    // Just signed out: say goodbye, unless they asked to sign in again.
    const goodbye = (await searchParams).entrar ? null : await goodbyeName();
    if (goodbye) {
      return (
        <Page lang={discovery.language}>
          <Goodbye slug={slug} name={goodbye} copy={copy} />
        </Page>
      );
    }
    return (
      <Page lang={discovery.language}>
        <DiscoveryFrame title={discovery.title} copy={copy}>
          <IvanSays big>{copy.ivanHello}</IvanSays>
          <SignIn slug={slug} language={discovery.language as Language} />
          <PromiseNote copy={copy} />
        </DiscoveryFrame>
      </Page>
    );
  }

  const home = await stakeholderHome(discovery, found.stakeholder);
  return (
    <Page lang={discovery.language}>
      <StakeholderHome
        slug={slug}
        title={discovery.title}
        name={found.stakeholder.name}
        isTest={found.stakeholder.isTest}
        copy={copy}
        {...home}
      />
    </Page>
  );
}

function Page({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <div lang={lang} className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
