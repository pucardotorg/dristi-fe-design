/** Sandbox: a client's system pushes one of the 300-case scenarios (`lib/bulk/sandbox-scale.ts`). */

import { sandboxPushScenario } from "@/lib/bulk/handlers";
import { respond } from "@/lib/bulk/respond.server";
import { serverStore } from "@/lib/bulk/store.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { scenario } = (await req.json()) as { scenario: string };
  return respond(await sandboxPushScenario(serverStore, scenario, new URL(req.url).origin));
}
