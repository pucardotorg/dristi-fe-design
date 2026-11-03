import type { Metadata } from "next";

import { UploadScreen } from "@/components/bulk/upload-screen";

export const metadata: Metadata = { title: "Upload cases" };

export default function Page() {
  return <UploadScreen />;
}
