/**
 * A batch pushed from a client's system, before it is created (§3): read what was sent for
 * Facts of the case and Check, and create it with the facts chosen.
 */

import { createPush, getPush } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ batchId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { batchId } = await ctx.params;
  return respond(await getPush(serverStore, batchId));
}

export async function POST(req: Request, ctx: Ctx) {
  const { batchId } = await ctx.params;
  return respond(await createPush(serverStore, batchId, await req.json()));
}
