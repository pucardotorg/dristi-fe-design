/** A document held for a bulk case, for viewing or download, and the upload that stores one. */

import { readFile, saveFileAs } from "@/lib/bulk/store.server";

export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const file = await readFile(fileId);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.meta.type,
      "content-disposition": `inline; filename="${encodeURIComponent(file.meta.name)}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}

/**
 * Store an upload made in the filing sections while a bulk case is open, under the id
 * the screen gave it. An id already in use is refused rather than overwritten.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  if (await readFile(fileId)) return new Response("That file is already stored.", { status: 409 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return new Response("No file sent.", { status: 400 });
  try {
    const ref = await saveFileAs(fileId, new Uint8Array(await file.arrayBuffer()), file.name, file.type);
    return Response.json(ref);
  } catch (e) {
    return new Response((e as Error).message, { status: 400 });
  }
}
