import { redirect } from "next/navigation";

import {
  applicationOrderHref,
  isApplicationOrderDecision,
} from "@/lib/employee/application-order-decision";

/** Folded into Applications (owner, 2026-10-07); kept so old order links still land. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ decision?: string }>;
}) {
  const { applicationId } = await params;
  const { decision } = await searchParams;
  redirect(
    applicationOrderHref(
      decodeURIComponent(applicationId),
      isApplicationOrderDecision(decision) ? decision : undefined,
    ),
  );
}
