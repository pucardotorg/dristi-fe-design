import { Suspense } from "react";
import type { Metadata } from "next";

import { PushStart } from "@/components/bulk/push-start";

export const metadata: Metadata = { title: "Batch" };

/** A pushed batch before it is created: Facts of the case, then Check and Create (§3). */
export default async function PushStartPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Suspense>
        <PushStart batchId={batchId} />
      </Suspense>
    </main>
  );
}
