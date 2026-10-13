import type { Metadata } from "next";

import { ApplicationOrderScreen } from "@/components/employee/application-order-screen";

export const metadata: Metadata = { title: "Order" };

/** The order on one application, opened from its dialog (`application-order-screen.tsx`). */
export default async function Page({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return (
    <ApplicationOrderScreen
      applicationId={decodeURIComponent(applicationId)}
      kind="decide"
    />
  );
}
