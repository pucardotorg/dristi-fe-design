import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseDetail } from "@/components/cases/case-detail";
import { findCaseRecord } from "@/lib/cases/party-cases";
import { serverCourtText } from "@/lib/court/server";

export async function generateMetadata(
  props: PageProps<"/cases/[caseId]">
): Promise<Metadata> {
  const { caseId } = await props.params;
  const record = findCaseRecord(caseId);
  const courtText = await serverCourtText();
  return { title: record ? courtText(record.caseNumber) : "Case" };
}

/** The advocate's case view. The screen is shared with the court (`case-detail.tsx`). */
export default async function CaseDetailPage(
  props: PageProps<"/cases/[caseId]">
) {
  const { caseId } = await props.params;
  const record = findCaseRecord(caseId);
  if (!record) notFound();
  return <CaseDetail record={record} searchParams={await props.searchParams} />;
}
