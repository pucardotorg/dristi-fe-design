import type { Metadata } from "next";
import { Suspense } from "react";

import { UploadStart } from "@/components/bulk/upload-start";

export const metadata: Metadata = { title: "Upload cases" };

export default function UploadPage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Suspense>
        <UploadStart />
      </Suspense>
    </main>
  );
}
