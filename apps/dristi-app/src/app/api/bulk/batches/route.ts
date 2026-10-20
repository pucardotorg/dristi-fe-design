/**
 * Batches as the filer's screens read them (same origin, no API key): the list, and
 * creating one from an Excel upload. API pushes come in through `v1/batches`.
 */

import { NextResponse } from "next/server";

import { summarise } from "@/lib/bulk/actions.server";
import { aiModeFrom } from "@/lib/bulk/ai-review";
import type { ApiBatchRequest } from "@/lib/bulk/contract";
import type { StoredFileRef } from "@/lib/filing/types";
import { buildBatch, validateRequest } from "@/lib/bulk/intake";
import { insertBatch, listBatches } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ai = aiModeFrom(new URL(req.url).searchParams.get("ai"));
  const all = await listBatches();
  const list = all
    .map((b) => summarise(b, all, ai))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json(list);
}

/** An Excel upload, already parsed and mapped in the browser into the API's shape. */
export async function POST(req: Request) {
  const { request, fileName, from, originals } = (await req.json()) as {
    request: ApiBatchRequest;
    fileName: string;
    /** "documents": cases read from one document each, and reviewed (AI-assisted upload). */
    from?: "excel" | "documents";
    /** For case documents: each case's original file and its text, by case reference. */
    originals?: Record<string, { file: StoredFileRef; text: string | null }>;
  };
  const errors = validateRequest(request);
  if (errors.length)
    return NextResponse.json(
      { error: "Not a valid batch.", details: errors },
      { status: 422 },
    );
  const source =
    from === "documents"
      ? {
          kind: "documents" as const,
          system: "Case documents",
          reference: fileName,
        }
      : { kind: "excel" as const, system: "Excel upload", reference: fileName };
  const built = await buildBatch(request, source, async () => null);
  for (const bc of built.cases) {
    const o = originals?.[bc.reference];
    if (!o) continue;
    bc.original = o.file;
    bc.docText = { ...bc.docText, [o.file.id]: o.text };
  }
  const batch = await insertBatch(built);
  return NextResponse.json(
    { batchId: batch.id, batchNumber: batch.number },
    { status: 201 },
  );
}
