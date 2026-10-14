import type { Metadata } from "next";

import { PendingOrderScreen } from "@/components/employee/pending-order-screen";

export const metadata: Metadata = { title: "Pending order" };

/**
 * One pending order: its text, its signature and its workflow. The segment is the
 * order's draft key — a hearing id, `cognizance:<case>:<act>` or `application:<id>`.
 */
export default async function EmployeePendingOrderPage({
  params,
}: {
  params: Promise<{ orderKey: string }>;
}) {
  const { orderKey } = await params;
  return <PendingOrderScreen orderKey={decodeURIComponent(orderKey)} />;
}
