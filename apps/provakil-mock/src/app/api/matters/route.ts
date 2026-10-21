/**
 * The workspace's Section 138 matters, with what has happened to each since it was filed
 * through the connector: "Filed" on SARAS 2.0 at once, and the case file number once the
 * court reports one.
 */

import { NextResponse } from "next/server";

import { DRISTI_API_KEY, DRISTI_URL } from "@/lib/config.server";
import { currentMatters } from "@/lib/workspace.server";
import { readPushes } from "@/lib/pushes.server";

type DristiBatch = {
  batchId: string;
  batchNumber: string;
  clubbedInto: string | null;
  cases: { reference: string; status: "draft" | "filed"; caseFileNumber: string | null }[];
};

export const dynamic = "force-dynamic";

export async function GET() {
  const matters = await currentMatters();
  const pushes = await readPushes();

  let dristi: DristiBatch[] | null = null;
  try {
    const res = await fetch(`${DRISTI_URL}/api/bulk/v1/batches`, {
      headers: { authorization: `Bearer ${DRISTI_API_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) dristi = (await res.json()) as DristiBatch[];
  } catch {
    dristi = null;
  }

  const rows = matters.map((m) => {
    const push = [...pushes].reverse().find((p) => p.matterIds.includes(m.id));
    if (!push) return { ...m, push: null, dristi: null };
    // Follow a clubbed batch to where its cases went.
    let batch = dristi?.find((b) => b.batchId === push.batchId) ?? null;
    if (batch?.clubbedInto) batch = dristi?.find((b) => b.batchId === batch!.clubbedInto) ?? batch;
    const c = batch?.cases.find((x) => x.reference === m.lan) ?? null;
    const registered = c?.status === "filed";
    return {
      ...m,
      stage: "Filed" as const,
      filedOn: "SARAS 2.0",
      cnr: registered ? c?.caseFileNumber ?? m.cnr : m.cnr,
      push: { ...push, batchNumber: batch?.batchNumber ?? push.batchNumber, batchId: batch?.batchId ?? push.batchId },
      dristi: c ? { status: c.status, caseFileNumber: c.caseFileNumber } : null,
    };
  });

  return NextResponse.json({ matters: rows, courtReachable: dristi !== null, courtUrl: DRISTI_URL });
}
