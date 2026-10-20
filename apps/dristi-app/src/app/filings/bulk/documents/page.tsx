import type { Metadata } from "next";
import { Suspense } from "react";

import { DocumentsScreen } from "@/components/bulk/documents-screen";

export const metadata: Metadata = { title: "Upload case documents" };

export default function DocumentsPage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Suspense>
        <DocumentsScreen />
      </Suspense>
    </main>
  );
}
