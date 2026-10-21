/**
 * One case of a batch, whole: its draft, for the single filing's sections to read and
 * write (`lib/bulk/case-repository.ts`).
 */

import { NextResponse } from "next/server";

import { replaceDraft } from "@/lib/bulk/actions.server";
import { getBatch, updateBatch } from "@/lib/bulk/store.server";
import type { FilingDraft } from "@/lib/filing/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ batchId: string; caseId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
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

/** Save the case's draft as the filing sections left it. */
export async function PUT(req: Request, ctx: Ctx) {
  const { batchId, caseId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { draft?: FilingDraft } | null;
  if (!body?.draft) return NextResponse.json({ error: "No draft sent." }, { status: 400 });
  let problem: string | null = "No such case in this batch.";
  const saved = await updateBatch(batchId, (batch) => {
    const bc = batch.cases.find((c) => c.id === caseId);
    if (!bc) return null;
    problem = replaceDraft(bc, body.draft!);
    return problem ? null : batch;
  });
  if (!saved) return NextResponse.json({ error: "No such batch." }, { status: 404 });
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });
  return NextResponse.json({ ok: true });
}
