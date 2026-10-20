import { NextResponse } from "next/server";

import { batchView } from "@/lib/bulk/actions.server";
import { listBatches } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const all = await listBatches();
  const batch = all.find((b) => b.id === batchId);
  if (!batch) return NextResponse.json({ error: "No such batch." }, { status: 404 });
  return NextResponse.json(batchView(batch, all));
}
