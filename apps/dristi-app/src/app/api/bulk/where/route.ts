/**
 * Where the filer's screens keep batches: on this server when it can write, else in the
 * browser (`lib/bulk/store.ts`). A hosted deployment's file system is read-only.
 */

import { NextResponse } from "next/server";

import { serverCanWrite } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ store: (await serverCanWrite()) ? "server" : "browser" });
}
