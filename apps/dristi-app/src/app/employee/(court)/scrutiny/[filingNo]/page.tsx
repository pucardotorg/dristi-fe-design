import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { scrutinyCaseFor } from "@/lib/employee/scrutiny/case";
import { courtProfile, type AiMode } from "@/lib/court/profiles";
import { serverCourt } from "@/lib/court/server";
import { CaseWorkbench } from "@/components/employee/scrutiny/case-workbench";

export const metadata: Metadata = { title: "Case review" };

/**
 * The scrutiny workbench for one filing: filed fields, the document bundle, and the
 * decision to send back or register.
 *
 * Every real filing opens. The one hand-authored case brings its own rich bundle; every
 * other row is assembled from what the queue knows about it (`case.ts`), so no row in the
 * queue is a dead link. Only an id that names no filing at all 404s. When a registry
 * service is real, `scrutinyCaseFor` is where the case is fetched instead of derived.
 *
 * The AI mode is the selected court's (`aiMode` in `lib/court/profiles.ts` — off for
 * Punjab). `?ai=on`, `?ai=unavailable` or `?ai=off` overrides it, so every mode can be
 * shown in any court. Its signing rules decide whether the affidavit is read with an oath.
 */
export default async function EmployeeScrutinyCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ filingNo: string }>;
  searchParams: Promise<{ ai?: string | string[] }>;
}) {
  const { filingNo } = await params;
  const profile = courtProfile(await serverCourt());
  const caseData = scrutinyCaseFor(decodeURIComponent(filingNo), profile.signing);
  if (!caseData) notFound();

  const { ai } = await searchParams;
  const mode: AiMode =
    ai === "on" || ai === "unavailable" || ai === "off" ? ai : profile.aiMode;

  return <CaseWorkbench caseData={caseData} ai={mode} />;
}
