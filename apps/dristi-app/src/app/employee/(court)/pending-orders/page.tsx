import type { Metadata } from "next";

import { PendingOrdersScreen } from "@/components/employee/pending-orders-screen";

export const metadata: Metadata = { title: "Pending orders" };

/**
 * Every order not yet through — being typed, awaiting a signature, or signed with its
 * workflows still to trigger — for the magistrate and the steno alike. In memory; see
 * `lib/employee/pending-orders.ts`.
 */
export default function EmployeePendingOrdersPage() {
  return <PendingOrdersScreen />;
}
