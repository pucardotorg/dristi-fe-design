import type { Metadata } from "next";

import { BulkCaseFile } from "@/components/bulk/case-file";

export const metadata: Metadata = { title: "Case file" };

export default async function BulkCasePage({ params }: { params: Promise<{ batchId: string; caseId: string }> }) {
  const { batchId, caseId } = await params;
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <BulkCaseFile batchId={batchId} caseId={caseId} />
    </main>
  );
}
