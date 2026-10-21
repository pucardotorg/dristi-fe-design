import type { Metadata } from "next";

import { CasesScreen } from "@/provakil/components/cases-screen";

export const metadata: Metadata = { title: "Litigation · Section 138/25" };

export default function Page() {
  return <CasesScreen />;
}
