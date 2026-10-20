/**
 * Documents added on the batch's Documents screen. One file per request, aimed at a case
 * and the intake slot it fills — the screen does the matching by file name.
 */

import { NextResponse } from "next/server";

import { attachToSlot, batchView } from "@/lib/bulk/actions.server";
import { listBatches, saveFile, updateBatch } from "@/lib/bulk/store.server";

export async function POST(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  const caseId = String(form.get("caseId") ?? "");
  const slotKey = String(form.get("slotKey") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const ref = await saveFile(new Uint8Array(await file.arrayBuffer()), file.name, file.type);
  let ok = false;
  const saved = await updateBatch(batchId, (batch) => {
    const bc = batch.cases.find((c) => c.id === caseId);
    if (!bc || bc.signedWith || bc.draft.status === "filed") return null;
    ok = attachToSlot(bc, slotKey, ref);
    return ok ? batch : null;
  });
  if (!saved || !ok) return NextResponse.json({ error: "That case or document slot is not open." }, { status: 409 });
  const all = await listBatches();
  return NextResponse.json(batchView(saved, all));
}
