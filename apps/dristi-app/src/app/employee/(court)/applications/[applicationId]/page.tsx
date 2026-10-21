import { redirect } from "next/navigation";

import { applicationHref } from "@/lib/employee/application-order-decision";

/**
 * One application's own address. It opens as a pop-up over the Applications list now
 * (owner, 2026-10-21), so the address lands there with it open.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { applicationId } = await params;
  const { view } = await searchParams;
  redirect(
    applicationHref(
      decodeURIComponent(applicationId),
      Array.isArray(view) ? view[0] : view,
    ),
  );
}
