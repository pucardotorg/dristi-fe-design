import { Suspense } from "react";

import { BulkCaseFlow } from "@/components/bulk/case-flow";

/** Width of the docked source rail, as the single filing's (`/filings/[draftId]/layout`). */
const PANEL_WIDTH = "clamp(20rem, calc(100vw - 80rem), 40rem)";

/**
 * One case of a batch, in the single filing's sections: every section under
 * `/filings/bulk/<batch>/cases/<case>/` shares its store.
 */
export default async function BulkCaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ batchId: string; caseId: string }>;
}) {
  const { batchId, caseId } = await params;
  return (
    <div className="flex min-w-0 flex-1" style={{ ["--source-panel-w" as string]: PANEL_WIDTH }}>
      {/* The `?ai=` setting is read from the address. */}
      <Suspense>
        <BulkCaseFlow batchId={batchId} caseId={caseId}>
          {children}
        </BulkCaseFlow>
      </Suspense>
    </div>
  );
}
