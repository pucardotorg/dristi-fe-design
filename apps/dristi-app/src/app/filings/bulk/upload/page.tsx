import type { Metadata } from "next";

import { UploadScreen } from "@/components/bulk/upload-screen";

export const metadata: Metadata = { title: "Upload Excel" };

export default function UploadPage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <UploadScreen />
    </main>
  );
}
