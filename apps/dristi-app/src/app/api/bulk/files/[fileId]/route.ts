/** A document held for a bulk case, for viewing or download, and the upload that stores one. */

import { getFile, putFile } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

type Ctx = { params: Promise<{ fileId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { fileId } = await ctx.params;
  return respond(await getFile(serverStore, fileId));
}

/** Stored under the id the screen gave it; an id already in use is refused. */
export async function PUT(req: Request, ctx: Ctx) {
  const { fileId } = await ctx.params;
  const file = (await req.formData().catch(() => null))?.get("file");
  return respond(await putFile(serverStore, fileId, file instanceof File ? file : null));
}
