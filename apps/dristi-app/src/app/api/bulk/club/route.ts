/** Club batches the filer chose into a new one; the originals close. */

import { club } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export async function POST(req: Request) {
  const { batchIds } = (await req.json()) as { batchIds: string[] };
  return respond(await club(serverStore, batchIds));
}
