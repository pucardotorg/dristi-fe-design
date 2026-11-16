/** Sandbox: every case's documents filed at once, in one of three states (`sandboxDocuments`). */

import { sandboxDocuments, type SandboxDocs } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const { scenario } = (await req.json()) as { scenario: SandboxDocs };
  return respond(await sandboxDocuments(serverStore, batchId, scenario, new URL(req.url).searchParams.get("ai")));
}
