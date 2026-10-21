import type { Metadata } from "next";
import { Suspense } from "react";

import { UploadScreen } from "@/components/bulk/upload-screen";

export const metadata: Metadata = { title: "Upload cases" };

export default function UploadPage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Suspense>
        <UploadScreen />
      </Suspense>
    </main>
  );
}
