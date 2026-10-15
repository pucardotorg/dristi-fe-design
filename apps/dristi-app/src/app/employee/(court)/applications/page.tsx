import type { Metadata } from "next";

import { ApplicationsScreen } from "@/components/employee/applications-screen";

import { readView } from "./views";

export const metadata: Metadata = { title: "Applications" };

/**
 * Applications — the court's one queue for the application lifecycle: onboarding, the
 * order on each, what is listed ahead and what has closed. Client-side: the applications
 * come from the store in this browser (`lib/applications/store.ts`).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return <ApplicationsScreen initialView={readView(view, "all")} />;
}
