/**
 * Every case's draft in a batch, at once, so a case view can move between cases without
 * waiting on each one.
 */

import { batchDrafts } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  return respond(await batchDrafts(serverStore, batchId));
}
