import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseBreadcrumbs } from "@/components/cases/case-breadcrumbs";
import { SubmitDocumentsForm } from "@/components/cases/submit-documents-form";
import { PAGE_GROUND, PAGE_GUTTER } from "@/components/shell/page-frame";
import { findCaseRecord } from "@/lib/cases/party-cases";
import { partiesLabel } from "@/lib/cases/types";
import { cn } from "@/lib/utils";
import { serverCourtText } from "@/lib/court/server";

function findCase(caseId: string) {
  return findCaseRecord(caseId);
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
    title: record ? `Submit documents · ${courtText(record.caseNumber)}` : "Submit documents",
  };
}

export default async function SubmitDocumentsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const record = findCase(caseId);
  if (!record) notFound();
  const courtText = await serverCourtText();

  return (
    <main className={cn("flex flex-1 flex-col", PAGE_GROUND, PAGE_GUTTER)}>
      <CaseBreadcrumbs
        caseId={record.id}
        caseNumber={record.caseNumber}
        trail={[{ label: "Submit documents" }]}
      />
      <SubmitDocumentsForm
        caseId={record.id}
        caseLine={`${courtText(record.caseNumber)} · ${partiesLabel(record)}`}
      />
    </main>
  );
}
