import type { Metadata } from "next";

import { ComplainantSection } from "@/components/filing/sections/complainant-section";

export const metadata: Metadata = { title: "Complainant" };

export default function Page() {
  return <ComplainantSection />;
}
