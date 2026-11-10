import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Waiting } from "@/components/discovery/waiting";
import { SLUG } from "@/domain/discovery";
import { discoveryTitle } from "@/server/stakeholder-views";

/**
 * A Discovery as its Stakeholders see it: its own light look, nothing of Ivan OS
 * (Q44). The installed-app name still comes from the site's manifest.
 */
export async function generateMetadata({ params }: LayoutProps<"/d/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const title = (SLUG.test(slug) && (await discoveryTitle(slug))) || "Discovery";
  return {
    title: { absolute: title },
    description: null,
    appleWebApp: { capable: true, title, statusBarStyle: "default" },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: "#f6f5f1", colorScheme: "light" };

export default function DiscoveryLayout({ children }: LayoutProps<"/d/[slug]">) {
  return (
    <div className="discovery flex min-h-full flex-1 flex-col">
      <Suspense fallback={<Waiting />}>{children}</Suspense>
    </div>
  );
}
