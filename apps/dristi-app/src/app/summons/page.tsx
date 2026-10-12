import type { Metadata } from "next";

import { SummonsDocument, type SummonsVersion } from "@/components/summons/summons-document";
import { SummonsFit, SummonsToolbar } from "@/components/summons/summons-toolbar";
import { isCourtId } from "@/lib/court/profiles";
import { serverCourt } from "@/lib/court/server";

import "./summons.css";

export const metadata: Metadata = { title: "Summons" };

/**
 * `/summons` — the summons an accused person was sent, v15, in its print and digital
 * versions (`?version=print|digital`, digital by default).
 *
 * **The state comes from the URL.** A real summons link is unique to the state that sent
 * it, so `?court=gujarat` decides the court name, numbers, places and language line here.
 * Without it, the court picked in Settings stands in, which is how the onboarding modal's
 * "View the original summons" opens it in the demo.
 */
export default async function SummonsPage({
  searchParams,
}: {
  searchParams: Promise<{ court?: string; version?: string }>;
}) {
  const params = await searchParams;
  const court = isCourtId(params.court) ? params.court : await serverCourt();
  const version: SummonsVersion = params.version === "print" ? "print" : "digital";

  return (
    <main className="summons-desk flex flex-1 flex-col items-center gap-6 bg-muted px-4 py-6 md:px-8 md:py-8">
      <SummonsToolbar version={version} />
      <SummonsFit>
        <SummonsDocument court={court} version={version} />
      </SummonsFit>
    </main>
  );
}
