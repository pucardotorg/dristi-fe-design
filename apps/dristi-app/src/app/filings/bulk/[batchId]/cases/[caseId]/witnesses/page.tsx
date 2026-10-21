import type { Metadata } from "next";

import { WitnessesSection } from "@/components/filing/sections/witnesses-section";

export const metadata: Metadata = { title: "Witnesses" };

export default function Page() {
  return <WitnessesSection />;
}
