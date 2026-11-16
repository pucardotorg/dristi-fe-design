import { deleteNotCreated, getBatchView } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  return respond(await getBatchView(serverStore, batchId, new URL(req.url).searchParams.get("ai")));
}

/** The batch list's Delete, for a batch not created yet. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  return respond(await deleteNotCreated(serverStore, batchId));
}
