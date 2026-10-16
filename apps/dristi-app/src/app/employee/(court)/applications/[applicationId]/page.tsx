import type { Metadata } from "next";

import { ApplicationWorkstation } from "@/components/employee/application-workstation";

import { readView } from "../views";

export const metadata: Metadata = { title: "Application" };

/**
 * One application, worked in the list it was opened from — the workstation. The rail
 * folds to its strip here (`employee-area.tsx`) so the three columns have the width.
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
  return (
    <ApplicationWorkstation
      applicationId={applicationId}
      view={view === undefined ? undefined : readView(view, "all")}
    />
  );
}
