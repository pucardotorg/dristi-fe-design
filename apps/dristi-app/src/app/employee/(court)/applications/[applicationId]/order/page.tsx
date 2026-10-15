import type { Metadata } from "next";

import { ApplicationOrderScreen } from "@/components/employee/application-order-screen";
import { isApplicationOrderDecision } from "@/lib/employee/application-order-decision";

import { readView } from "../../views";

export const metadata: Metadata = { title: "Order" };

/** The order on one application, opened from the workstation (`application-order-screen.tsx`). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ decision?: string; view?: string | string[] }>;
}) {
  const { applicationId } = await params;
  const { decision, view } = await searchParams;
  return (
    <ApplicationOrderScreen
      applicationId={decodeURIComponent(applicationId)}
      decision={isApplicationOrderDecision(decision) ? decision : undefined}
      view={view === undefined ? undefined : readView(view, "all")}
    />
  );
}
