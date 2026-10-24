import { Suspense } from "react";

import { BulkSetupFlow } from "@/components/bulk/setup-flow";

/** Width of the docked source rail, as the single filing's (`/filings/[draftId]/layout`). */
const PANEL_WIDTH = "clamp(20rem, calc(100vw - 80rem), 40rem)";

/**
 * The batch's complainants and advocates, before the Excel file: every section under
 * `/filings/bulk/upload/<setup>/` shares the setup's store.
 */
export default async function BulkSetupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ setupId: string }>;
}) {
  const { setupId } = await params;
  return (
    <div className="flex min-w-0 flex-1" style={{ ["--source-panel-w" as string]: PANEL_WIDTH }}>
      <Suspense>
        <BulkSetupFlow setupId={setupId}>{children}</BulkSetupFlow>
      </Suspense>
    </div>
  );
}
