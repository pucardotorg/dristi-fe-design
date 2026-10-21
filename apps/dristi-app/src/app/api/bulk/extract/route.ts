/**
 * Reads case documents for the AI-assisted upload: one Word file or PDF per case, each
 * read for the bulk sheet's fields (`lib/bulk/case-doc.ts`, a stand-in for the model).
 * Each file is kept, so the case can show its original document later.
 */

import { extract } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  return respond(await extract(serverStore, files, form.get("ai")?.toString() ?? null));
}
