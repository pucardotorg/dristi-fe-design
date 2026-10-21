import type { Metadata } from "next";

import { AffidavitSection } from "@/components/filing/sections/affidavit-section";

export const metadata: Metadata = { title: "Affidavit" };

export default function Page() {
  return <AffidavitSection />;
}
