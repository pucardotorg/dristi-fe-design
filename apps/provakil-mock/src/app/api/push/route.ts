/**
 * File the selected matters on SARAS 2.0 through the court's Bulk Filing API
 * (`POST /api/bulk/v1/batches`). One batch per advocate, since each lands in that
 * advocate's account. Server to server: the browser never holds the API key.
 */

import { NextResponse } from "next/server";

import { DRISTI_API_KEY, DRISTI_URL, PROVAKIL_URL } from "@/lib/config.server";
import { buildRequest } from "@/lib/connector";
import type { Matter } from "@/lib/matters";
import { addPush, assign } from "@/lib/pushes.server";
import { currentMatters } from "@/lib/workspace.server";

export async function POST(req: Request) {
  const { matterIds, adr, sentBy, assignments } = (await req.json()) as {
    matterIds: string[];
    adr?: "yes" | "no";
    sentBy?: string;
    /** Matter id → the court advocate it is filed through, chosen in the filing dialog. */
    assignments?: Record<string, { name: string; enrolment: string }>;
  };
  // Record the dialog's choices on the matters first, so Provakil shows who filed each.
  if (assignments) {
    const byAdvocate = new Map<string, string[]>();
    for (const [id, a] of Object.entries(assignments)) byAdvocate.set(a.enrolment, [...(byAdvocate.get(a.enrolment) ?? []), id]);
    for (const [enrolment, ids] of byAdvocate) await assign(ids, enrolment);
  }
  const matters = (await currentMatters())
    .filter((m) => matterIds.includes(m.id))
    .map((m) => (assignments?.[m.id] ? { ...m, advocate: assignments[m.id] } : m));
  if (matters.length === 0) return NextResponse.json({ error: "No cases selected." }, { status: 400 });
  const unassigned = matters.filter((m) => !m.advocate);
  if (unassigned.length) {
    return NextResponse.json(
      { error: "Assign an advocate first.", details: unassigned.map((m) => `${m.lan} has no advocate.`) },
      { status: 400 }
    );
  }

  const byAdvocate = new Map<string, Matter[]>();
  for (const m of matters) byAdvocate.set(m.advocate!.enrolment, [...(byAdvocate.get(m.advocate!.enrolment) ?? []), m]);

  const batches: { pushId: string; advocate: Matter["advocate"]; request: unknown; response: unknown }[] = [];
  for (const [enrolment, group] of byAdvocate) {
    const pushId = `PVK-PUSH-${Date.now().toString(36).toUpperCase()}${batches.length}`;
    const body = buildRequest(group, { docBase: PROVAKIL_URL, pushId, sentBy: sentBy ?? "Priya Vyas", adr: adr ?? "no" });
    let res: Response;
    try {
      res = await fetch(`${DRISTI_URL}/api/bulk/v1/batches`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${DRISTI_API_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      return NextResponse.json({ error: `SARAS 2.0 could not be reached at ${DRISTI_URL}.`, batches }, { status: 502 });
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: json.error ?? `SARAS 2.0 answered ${res.status}.`, details: json.details, batches }, { status: 502 });
    }
    await addPush({
      pushId,
      advocate: enrolment,
      at: new Date().toISOString(),
      by: sentBy ?? "Priya Vyas",
      matterIds: group.map((m) => m.id),
      batchId: json.batchId,
      batchNumber: json.batchNumber,
      url: json.url,
    });
    batches.push({ pushId, advocate: group[0].advocate, request: body, response: json });
  }
  return NextResponse.json({ batches });
}
