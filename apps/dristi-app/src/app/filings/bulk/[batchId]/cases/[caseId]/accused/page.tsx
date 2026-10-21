import type { Metadata } from "next";

import { AccusedSection } from "@/components/filing/sections/accused-section";

export const metadata: Metadata = { title: "Accused" };

export default function Page() {
  return <AccusedSection />;
}
