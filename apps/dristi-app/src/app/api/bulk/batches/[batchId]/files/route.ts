/**
 * Documents added on the batch's Documents screen. One file per request, aimed at a case
 * and the intake slot it fills — the screen does the matching by file name.
 */

import { attach } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export async function POST(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  return respond(
    await attach(serverStore, batchId, {
      file: file instanceof File ? file : null,
      caseId: String(form.get("caseId") ?? ""),
      slotKey: String(form.get("slotKey") ?? ""),
      ai: form.get("ai")?.toString() ?? null,
    }),
  );
}
