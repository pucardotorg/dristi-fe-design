import type { Metadata } from "next";

import { DemandNoticeSection } from "@/components/filing/sections/demand-notice-section";

export const metadata: Metadata = { title: "Demand notice & debt" };

export default function Page() {
  return <DemandNoticeSection />;
}
