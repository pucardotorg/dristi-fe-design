import { redirect } from "next/navigation";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { firstFlaggedStep } from "@/lib/bulk/flag-place";
import { openFlags } from "@/lib/bulk/scrutiny";
import { listBatches } from "@/lib/bulk/store.server";
import { getStep } from "@/lib/filing/steps";

export const dynamic = "force-dynamic";

/** A case on its own opens at the first section with something to fix. */
export default async function BulkCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string; caseId: string }>;
  searchParams: Promise<{ ai?: string }>;
}) {
  const { batchId, caseId } = await params;
  const { ai } = await searchParams;
  const all = await listBatches();
  const batch = all.find((b) => b.id === batchId);
  const bc = batch?.cases.find((c) => c.id === caseId);
  const step =
    batch && bc
      ? firstFlaggedStep(openFlags(bc, { batch, others: all.filter((b) => b.id !== batchId), ai: aiModeFrom(ai) }))
      : "complainant";
  const q = ai ? `?ai=${encodeURIComponent(ai)}` : "";
  redirect(`/filings/bulk/${encodeURIComponent(batchId)}/cases/${encodeURIComponent(caseId)}/${getStep(step).segment}${q}`);
}
