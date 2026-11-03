/**
 * Batches as the filer's screens read them (same origin, no API key): the list, and
 * creating one from an Excel upload. API pushes come in through `v1/batches`.
 */

import { createBatch, listSummaries, type CreateBody } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return respond(await listSummaries(serverStore));
}

export async function POST(req: Request) {
  return respond(await createBatch(serverStore, (await req.json()) as CreateBody));
}

/** "Reset sandbox data": every batch and upload on this server goes. */
export async function DELETE() {
  await serverStore.clear();
  return new Response(null, { status: 204 });
}
