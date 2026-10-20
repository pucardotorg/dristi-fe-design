/**
 * One case of a batch, whole: its draft, for the single filing's case file view.
 */

import { NextResponse } from "next/server";

import { getBatch } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ batchId: string; caseId: string }> }) {
  const { batchId, caseId } = await ctx.params;
  const batch = await getBatch(batchId);
  if (!batch) return NextResponse.json({ error: "No such batch." }, { status: 404 });
  const at = batch.cases.findIndex((c) => c.id === caseId);
  if (at < 0) return NextResponse.json({ error: "No such case in this batch." }, { status: 404 });
  const bc = batch.cases[at];
  return NextResponse.json({
    batchNumber: batch.number,
    reference: bc.reference,
    draft: bc.draft,
    prev: batch.cases[at - 1]?.id ?? null,
    next: batch.cases[at + 1]?.id ?? null,
    index: at,
    total: batch.cases.length,
  });
}
