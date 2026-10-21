import type { Metadata } from "next";

import { JurisdictionSection } from "@/components/filing/sections/jurisdiction-section";

export const metadata: Metadata = { title: "Jurisdiction & limitation" };

export default function Page() {
  return <JurisdictionSection />;
}
