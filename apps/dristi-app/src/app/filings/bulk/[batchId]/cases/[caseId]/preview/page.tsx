import type { Metadata } from "next";

import { PreviewSection } from "@/components/filing/sections/preview-section";

export const metadata: Metadata = { title: "Preview" };

export default function Page() {
  return <PreviewSection />;
}
