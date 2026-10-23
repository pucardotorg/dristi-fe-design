import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseDetail } from "@/components/cases/case-detail";
import { ProfileProvider } from "@/components/shell/profile";
import { findCaseRecord } from "@/lib/cases/party-cases";
import {
  cognizanceCaseById,
  cognizanceCaseRecord,
} from "@/lib/employee/cognizance";
import { isoDay } from "@/lib/employee/hearings";

const DEMO_LISTING_ORDER_HREF = "/employee/hearings/h-241/order";

/**
 * A complaint from the cognizance queue first, so its View case opens that complaint and
 * not a case on the advocate's list that happens to share its id.
 */
function courtCase(caseId: string) {
  const matter = cognizanceCaseById(caseId);
  if (matter) {
    return {
      record: cognizanceCaseRecord(matter, isoDay(new Date())),
      orderHref: `/employee/cognizance/${matter.id}/order`,
    };
  }
  const record = findCaseRecord(caseId);
  /* Any other case opens the order screen of the demo listing it stands in for — the
     cause list's View case opens this case for every listing (owner, 2026-10-23). */
  return record ? { record, orderHref: DEMO_LISTING_ORDER_HREF } : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ caseId: string }>;
}): Promise<Metadata> {
  const { caseId } = await params;
  return { title: courtCase(caseId)?.record.caseNumber ?? "Case" };
}

/**
 * `/employee/cases/[caseId]` — the court's case view. It is the advocate's screen
 * (`components/cases/case-detail.tsx`) read as the court: no Share access, and Generate
 * order where Make filings stands (owner, 2026-10-13).
 *
 * `ProfileProvider` because the shared screen's bail and application panels read the
 * signed-in profile, and the court area does not mount the advocate's shell that holds it.
 *
 * Generate order opens the order screen: a cognizance act's for a complaint in that
 * queue, the demo listing's for any other case.
 */
export default async function CourtCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caseId } = await params;
  const found = courtCase(caseId);
  if (!found) notFound();
  return (
    <ProfileProvider>
      <CaseDetail
        record={found.record}
        searchParams={await searchParams}
        reader="court"
        orderHref={found.orderHref}
      />
    </ProfileProvider>
  );
}
