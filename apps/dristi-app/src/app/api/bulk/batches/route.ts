/**
 * Batches as the filer's screens read them (same origin, no API key): the list, and
 * creating one from an Excel upload. API pushes come in through `v1/batches`.
 */

import { NextResponse } from "next/server";

import { summarise } from "@/lib/bulk/actions.server";
import type { ApiBatchRequest } from "@/lib/bulk/contract";
import { buildBatch, validateRequest } from "@/lib/bulk/intake";
import { insertBatch, listBatches } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await listBatches();
  const list = all
    .map((b) => summarise(b, all))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json(list);
}

/** An Excel upload, already parsed and mapped in the browser into the API's shape. */
export async function POST(req: Request) {
  const { request, fileName } = (await req.json()) as { request: ApiBatchRequest; fileName: string };
  const errors = validateRequest(request);
  if (errors.length) return NextResponse.json({ error: "Not a valid batch.", details: errors }, { status: 422 });
  const built = await buildBatch(request, { kind: "excel", system: "Excel upload", reference: fileName }, async () => null);
  const batch = await insertBatch(built);
  return NextResponse.json({ batchId: batch.id, batchNumber: batch.number }, { status: 201 });
}
