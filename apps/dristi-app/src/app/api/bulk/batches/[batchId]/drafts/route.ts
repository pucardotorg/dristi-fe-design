/**
 * Every case's draft in a batch, at once, so a case view can move between cases without
 * waiting on each one.
 */

import { NextResponse } from "next/server";

import { getBatch } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const batch = await getBatch(batchId);
  if (!batch) return NextResponse.json({ error: "No such batch." }, { status: 404 });
  return NextResponse.json({ drafts: Object.fromEntries(batch.cases.map((c) => [c.id, c.draft])) });
}
