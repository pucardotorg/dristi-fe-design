import type { Metadata } from "next";

import { ChequeSection } from "@/components/filing/sections/cheque-section";

export const metadata: Metadata = { title: "Cheque & return memo" };

export default function Page() {
  return <ChequeSection />;
}
