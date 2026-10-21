import type { Metadata } from "next";

import { DocumentsSection } from "@/components/filing/sections/documents-section";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return <DocumentsSection />;
}
