/**
 * One case of a batch, whole: its draft, for the single filing's sections to read and
 * write (`lib/bulk/case-repository.ts`).
 */

import { getCase, putCase } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";
import type { FilingDraft } from "@/lib/filing/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ batchId: string; caseId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { batchId, caseId } = await ctx.params;
  return respond(await getCase(serverStore, batchId, caseId));
}

/** Save the case's draft as the filing sections left it. */
export async function PUT(req: Request, ctx: Ctx) {
  const { batchId, caseId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { draft?: FilingDraft } | null;
  return respond(await putCase(serverStore, batchId, caseId, body));
}
