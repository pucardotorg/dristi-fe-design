/** A document held for a bulk case, for viewing or download. */

import { readFile } from "@/lib/bulk/store.server";

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
