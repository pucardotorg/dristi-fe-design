import { Suspense } from "react";

import { BatchCommonFlow } from "@/components/bulk/batch-common-flow";

/** Width of the docked source rail, as the setup's (`/filings/bulk/upload/<setup>/layout`). */
const PANEL_WIDTH = "clamp(20rem, calc(100vw - 80rem), 40rem)";

/**
 * A created batch's Common details, on the same sections they were filled on, locked:
 * every section under `/filings/bulk/<batch>/common/` reads the batch.
 */
export default async function BatchCommonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  return (
    <div className="flex min-w-0 flex-1" style={{ ["--source-panel-w" as string]: PANEL_WIDTH }}>
      <Suspense>
        <BatchCommonFlow batchId={batchId}>{children}</BatchCommonFlow>
      </Suspense>
    </div>
  );
}
