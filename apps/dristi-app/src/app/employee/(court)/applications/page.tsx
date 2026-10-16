import type { Metadata } from "next";

import { ApplicationsScreen } from "@/components/employee/applications-screen";
import { readApplicationView } from "@/lib/employee/application-views";

export const metadata: Metadata = { title: "Applications" };

/**
 * Applications — the court's one queue for the application lifecycle: Onboard
 * applications and Decide on applications as one rail item, cut by pills
 * (`handovers/application-lifecycle.md`). Client-side: the tasks come from the
 * applications store in this browser — see `lib/employee/application-tasks.ts`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return <ApplicationsScreen initialView={readApplicationView(view)} />;
}
