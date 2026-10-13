import type { Metadata } from "next";

import { RegistersScreen } from "@/components/employee/registers-screen";
import { REGISTERS_PAGE } from "@/lib/employee/registers";

export const metadata: Metadata = { title: REGISTERS_PAGE.label };

/**
 * `/employee/registers` — the court's registers, from the rail's "Registers" row and the
 * dashboard's "Open registers". A client screen: its counts are read from the generated
 * court for the reader's today (`lib/employee/court-docket.ts`).
 */
export default function CourtRegistersPage() {
  return <RegistersScreen />;
}
