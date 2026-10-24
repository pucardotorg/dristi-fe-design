import type { Metadata } from "next";

import { AdvocateSection } from "@/components/filing/sections/advocate-section";

export const metadata: Metadata = { title: "Advocates" };

export default function Page() {
  return <AdvocateSection />;
}
