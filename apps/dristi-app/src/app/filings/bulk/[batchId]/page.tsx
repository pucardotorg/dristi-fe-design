import { Suspense } from "react";
import type { Metadata } from "next";

import { BatchScreen } from "@/components/bulk/batch-screen";

export const metadata: Metadata = { title: "Batch" };

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      {/* The tab lives in the URL. */}
      <Suspense>
        <BatchScreen batchId={batchId} />
      </Suspense>
    </main>
  );
}
