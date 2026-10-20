/**
 * Bulk Filing API v1 — `POST /api/bulk/v1/batches`.
 *
 * A litigation system sends many S-138 complaints in one call (`lib/bulk/contract.ts`).
 * Each push becomes its own batch of drafts; nothing is filed by this call. Documents
 * listed in the request are fetched from the sender here, so the batch holds them.
 *
 * Auth is a bearer key (`BULK_API_KEY`, a demo default otherwise). The live service
 * replaces it with the court's client credentials.
 */

import { NextResponse } from "next/server";

import { localizeCaseNumber } from "@/lib/court/localize";
import type { ApiBatchRequest, ApiBatchResponse, ApiDocument } from "@/lib/bulk/contract";
import { documentText } from "@/lib/bulk/doc-text";
import { buildBatch, validateRequest } from "@/lib/bulk/intake";
import { insertBatch, listBatches, saveFile } from "@/lib/bulk/store.server";

const API_KEY = process.env.BULK_API_KEY ?? "dristi-demo-key";

function authorised(req: Request): boolean {
  return req.headers.get("authorization") === `Bearer ${API_KEY}`;
}

async function fetchDocument(doc: ApiDocument) {
  try {
    const res = await fetch(doc.url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = (doc.contentType || res.headers.get("content-type") || "application/octet-stream").split(";")[0];
    const ref = await saveFile(bytes, doc.name, type);
    return { ...ref, text: documentText(bytes, type) };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Missing or wrong API key." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The body is not valid JSON." }, { status: 400 });
  }
  const errors = validateRequest(body);
  if (errors.length) {
    return NextResponse.json({ error: "Not a valid batch.", details: errors }, { status: 422 });
  }
  const request = body as ApiBatchRequest;
  const built = await buildBatch(
    request,
    {
      kind: "api",
      system: request.source.system,
      reference: request.source.reference,
      sentBy: request.source.sentBy,
    },
    fetchDocument
  );
  const batch = await insertBatch(built);
  const origin = new URL(req.url).origin;
  const response: ApiBatchResponse = {
    batchId: batch.id,
    batchNumber: batch.number,
    receivedAt: batch.createdAt,
    url: `${origin}/filings/bulk/${batch.id}`,
    cases: batch.cases.map((c) => ({ reference: c.reference, caseId: c.id, status: "draft" })),
  };
  return NextResponse.json(response, { status: 201 });
}

/** The sender's view of what it has pushed: batch numbers and where each case stands. */
export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Missing or wrong API key." }, { status: 401 });
  }
  const all = await listBatches();
  return NextResponse.json(
    all.map((b) => ({
      batchId: b.id,
      batchNumber: b.number,
      receivedAt: b.createdAt,
      source: b.source,
      clubbedInto: b.clubbedInto,
      cases: b.cases.map((c) => ({
        reference: c.reference,
        caseId: c.id,
        status: c.draft.status,
        // In the deployment's own numbering, as the court's screens show it.
        caseFileNumber: c.draft.sign.caseFileNumber ? localizeCaseNumber(c.draft.sign.caseFileNumber, "gujarat") : null,
      })),
    }))
  );
}
