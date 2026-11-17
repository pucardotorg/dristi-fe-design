import type { Metadata } from "next";

import { OathLink } from "@/components/bulk/oath-link";

export const metadata: Metadata = { title: "Take your oath" };

/**
 * The oath link: what the complainant's representative receives by SMS for a bulk batch
 * (owner, 2026-11-17). One recording for every case in it.
 */
export default async function Page({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return <OathLink batchId={batchId} />;
}
