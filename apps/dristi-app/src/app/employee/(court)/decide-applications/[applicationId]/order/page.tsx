import type { Metadata } from "next";

import { ApplicationOrderScreen } from "@/components/employee/application-order-screen";
import { isApplicationOrderDecision } from "@/lib/employee/application-order-decision";

export const metadata: Metadata = { title: "Order" };

/** The order on one application, opened from its dialog (`application-order-screen.tsx`). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ decision?: string }>;
}) {
  const { applicationId } = await params;
  const { decision } = await searchParams;
  return (
    <ApplicationOrderScreen
      applicationId={decodeURIComponent(applicationId)}
      kind="decide"
      decision={isApplicationOrderDecision(decision) ? decision : undefined}
    />
  );
}
