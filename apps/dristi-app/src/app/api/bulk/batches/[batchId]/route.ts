import { NextResponse } from "next/server";

import { batchView } from "@/lib/bulk/actions.server";
import { aiModeFrom } from "@/lib/bulk/ai-review";
import { listBatches, updateBatch } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const ai = aiModeFrom(new URL(req.url).searchParams.get("ai"));
  const all = await listBatches();
  let batch = all.find((b) => b.id === batchId);
  if (!batch) return NextResponse.json({ error: "No such batch." }, { status: 404 });
  // Opening a pushed batch is what clears its notification.
  if (batch.openedAt === null) {
    const at = new Date().toISOString();
    batch = (await updateBatch(batchId, (b) => (b.openedAt === null ? { ...b, openedAt: at } : null))) ?? batch;
  }
  return NextResponse.json(batchView(batch, all, ai));
}
