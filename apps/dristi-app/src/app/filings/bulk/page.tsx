import type { Metadata } from "next";
import { Suspense } from "react";

import { BatchesScreen } from "@/components/bulk/batches-screen";

export const metadata: Metadata = { title: "Bulk filing" };

export default function BulkFilingPage() {
  // The shell owns the header and nav landmarks, so the screen owns `main`.
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Suspense>
        <BatchesScreen />
      </Suspense>
    </main>
  );
}
