/** A handler's reply (`handlers.ts`) as the route's HTTP response. */

import { NextResponse } from "next/server";

import type { Reply } from "./handlers";

export function respond(reply: Reply): Response {
  if ("file" in reply) {
    const { bytes, meta } = reply.file;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": meta.type,
        "content-disposition": `inline; filename="${encodeURIComponent(meta.name)}"`,
        "cache-control": "private, max-age=3600",
      },
    });
  }
  return NextResponse.json(reply.json, { status: reply.status });
}
