/**
 * Bulk Filing API v1 — `POST /api/bulk/v1/batches`.
 *
 * A litigation system sends many S-138 complaints in one call (`lib/bulk/contract.ts`).
 * Each push becomes its own batch of drafts; nothing is filed by this call. Documents
 * listed in the request are fetched from the sender here, so the batch holds them.
 * What it does is `receivePush` (`lib/bulk/handlers.ts`), which a hosted deployment's
 * browser runs against its own store instead (`provakil/lib/saras-link.ts`).
 *
 * Auth is a bearer key (`BULK_API_KEY`, a demo default otherwise). The live service
 * replaces it with the court's client credentials.
 */

import { NextResponse } from "next/server";

import { pushedBatches, receivePush } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

const API_KEY = process.env.BULK_API_KEY ?? "dristi-demo-key";

function authorised(req: Request): boolean {
  return req.headers.get("authorization") === `Bearer ${API_KEY}`;
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
  return respond(await receivePush(serverStore, body, new URL(req.url).origin));
}

/** The sender's view of what it has pushed: batch numbers and where each case stands. */
export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Missing or wrong API key." }, { status: 401 });
  }
  return respond(await pushedBatches(serverStore));
}
