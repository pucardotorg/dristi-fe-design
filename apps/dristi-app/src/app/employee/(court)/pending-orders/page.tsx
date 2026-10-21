import type { Metadata } from "next";

import { PendingOrdersScreen } from "@/components/employee/pending-orders-screen";
import { PENDING_ORDER_STAGES } from "@/lib/employee/pending-orders";

export const metadata: Metadata = { title: "Pending orders" };

/**
 * Every order not yet through — being typed, awaiting a signature, or signed with its
 * workflows still to trigger — for the magistrate and the steno alike. In memory; see
 * `lib/employee/pending-orders.ts`.
 */
export default async function EmployeePendingOrdersPage(
  props: PageProps<"/employee/pending-orders">,
) {
  const { tab } = await props.searchParams;
  const initialTab = PENDING_ORDER_STAGES.find((stage) => stage.id === tab)?.id;
  return <PendingOrdersScreen initialTab={initialTab} />;
}
