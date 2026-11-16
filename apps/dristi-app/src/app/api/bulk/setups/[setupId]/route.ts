/**
 * An upload left before Create, kept as an unfinished batch in the filer's list (BLK-10m):
 * read to reopen it, written as the filer moves through its screens.
 */

import { getSetup, saveSetup, type SetupBody } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ setupId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { setupId } = await ctx.params;
  return respond(await getSetup(serverStore, setupId));
}

export async function PUT(req: Request, ctx: Ctx) {
  const { setupId } = await ctx.params;
  return respond(await saveSetup(serverStore, setupId, (await req.json()) as SetupBody));
}
