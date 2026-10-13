import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseBreadcrumbs } from "@/components/cases/case-breadcrumbs";
import { RaiseApplicationEntry } from "@/components/cases/raise-application-form";
import {
  applicationsFile,
  findDraftSubmission,
} from "@/lib/cases/applications";
import { PAGE_GROUND, PAGE_GUTTER } from "@/components/shell/page-frame";
import { findCaseRecord } from "@/lib/cases/party-cases";
import { Breadcrumbs } from "@/components/shell/chrome";
import { areaOf, originCrumb, safeOrigin } from "@/lib/nav/origin";
import { cn } from "@/lib/utils";
import { serverCourtText } from "@/lib/court/server";

function findCase(caseId: string) {
  return findCaseRecord(caseId);
}

/**
 * ?draft=<submission id> reopens a saved draft; without it the flow starts at
 * the type picker. Resolving it here rather than in the form keeps the
 * register the one place that knows how a draft is stored.
 */
/**
 * ?objectTo=<application id> comes from a File objection task. Honoured only
 * for an application that is waiting on the court's decision and invited
 * objections; anything else starts at the type picker, as a stale draft id
 * does.
 */
function objectionTarget(caseId: string, applicationId: string | undefined) {
  const record = findCase(caseId);
  if (!record || !applicationId) return undefined;
  try {
    const target = applicationsFile(record).submissions.find(
      (item) => item.id === applicationId
    );
    return target &&
      target.status === "pending-decision" &&
      target.objectionsInvited === true
      ? target.id
      : undefined;
  } catch {
    return undefined;
  }
}

function resumedDraft(caseId: string, draftId: string | undefined) {
  const record = findCase(caseId);
  if (!record || !draftId) return null;
  try {
    return findDraftSubmission(applicationsFile(record), draftId);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ caseId: string }>;
}): Promise<Metadata> {
  const { caseId } = await params;
  const record = findCase(caseId);
  const courtText = await serverCourtText();
  return {
    title: record ? `Raise application · ${courtText(record.caseNumber)}` : "Raise application",
  };
}

export default async function RaiseApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ draft?: string; from?: string; objectTo?: string }>;
}) {
  const { caseId } = await params;
  const { draft, from, objectTo } = await searchParams;
  const record = findCase(caseId);
  if (!record) notFound();

  // Reached from the rail's Raise application, the person never opened the
  // case: a trail of `Cases › the case › here` named two places they had not
  // been, and lit Cases in the rail (owner, Sept 21). The trail follows the
  // door instead: `Raise application › the case`.
  const door = originCrumb(from);
  const fromOutsideCases = door && areaOf(door.href).label !== "Cases";

  return (
    <main className="flex flex-1 flex-col">
      {fromOutsideCases ? (
        <Breadcrumbs
          root={door}
          crumbs={[{ label: record.caseNumber, mono: true }]}
        />
      ) : (
        <CaseBreadcrumbs
          caseId={record.id}
          caseNumber={record.caseNumber}
          trail={[{ label: "Raise application" }]}
        />
      )}
      {/* View Case's ground, so this reads as the same place and the white
          cards stand off it. Dark keeps its own background. */}
      <div className={cn("flex min-w-0 flex-1 flex-col", PAGE_GROUND, PAGE_GUTTER)}>
        <RaiseApplicationEntry
          record={record}
          draftId={draft}
          resume={resumedDraft(caseId, draft)}
          objectTo={draft ? undefined : objectionTarget(caseId, objectTo)}
          // The door this was opened from: the rail's case list records itself
          // here, so the way back returns to it rather than to the case.
          backHref={safeOrigin(from) ?? undefined}
        />
      </div>
    </main>
  );
}
