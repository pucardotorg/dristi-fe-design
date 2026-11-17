/** The complainant's oath for a batch: what the link shows, and the recording it sends. */

import { getOath, recordOath } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ batchId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { batchId } = await ctx.params;
  return respond(await getOath(serverStore, batchId));
}

export async function POST(req: Request, ctx: Ctx) {
  const { batchId } = await ctx.params;
  const f = await req.formData();
  const file = f.get("file");
  return respond(await recordOath(serverStore, batchId, file instanceof File ? file : null, String(f.get("by") ?? "")));
}
