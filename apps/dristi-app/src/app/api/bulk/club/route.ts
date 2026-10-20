/** Club batches the filer chose into a new one; the originals close. */

import { NextResponse } from "next/server";

import { clubBatches } from "@/lib/bulk/actions.server";
import { applyBatches } from "@/lib/bulk/store.server";

export async function POST(req: Request) {
  const { batchIds } = (await req.json()) as { batchIds: string[] };
  let problem: string | null = null;
  try {
    const result = await applyBatches((all) => {
      const out = clubBatches(all, batchIds, new Date().toISOString());
      if ("error" in out) {
        problem = out.error;
        throw new Error(out.error);
      }
      return out;
    });
    return NextResponse.json({ batchId: result.id, batchNumber: result.number });
  } catch {
    return NextResponse.json({ error: problem ?? "Could not club these batches." }, { status: 409 });
  }
}
