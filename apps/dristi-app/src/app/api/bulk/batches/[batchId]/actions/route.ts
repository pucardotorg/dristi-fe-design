/**
 * What the filer does to a batch: fix a flagged value, skip a soft flag, declare an
 * accused's contacts unknown, sign, pay. Each returns the batch as it now stands.
 */

import { act, type Action } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export async function POST(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  return respond(await act(serverStore, batchId, (await req.json()) as Action & { ai?: string }));
}
