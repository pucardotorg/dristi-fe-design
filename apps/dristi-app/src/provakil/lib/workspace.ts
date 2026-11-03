/**
 * Provakil's own back end, in the browser: what its screens used to ask its server for
 * (`/api/matters`, `/api/assign`, `/api/court-advocates`, `/api/push`), answered here with
 * the same responses, so the demo runs from one deployment with nothing written on a
 * server. Provakil's records — the legal manager's advocate assignments and what it has
 * sent to the court — are kept in this browser's localStorage. SARAS 2.0 is reached only
 * through its Bulk Filing API (`saras-link.ts`).
 */

import { buildRequest } from "./connector";
import { ADVOCATES, allMatters, type Matter } from "./matters";
import { sarasAdvocates, sarasBatches, sarasPush } from "./saras-link";

/* ─────────────────────────────── Provakil's records ─────────────────────────────── */

export type PushRecord = {
  /** The advocate whose account the batch went to. */
  advocate?: string;
  pushId: string;
  at: string;
  by: string;
  matterIds: string[];
  batchId: string;
  batchNumber: string;
  url: string;
};

const PUSHES = "provakil.pushes";
const ASSIGN = "provakil.assignments";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the demo still runs, it just forgets on reload.
  }
}

const readPushes = () => read<PushRecord[]>(PUSHES, []);
const readAssignments = () => read<Record<string, string>>(ASSIGN, {});

function assign(matterIds: string[], enrolment: string): void {
  const all = readAssignments();
  for (const id of matterIds) all[id] = enrolment;
  write(ASSIGN, all);
}

/** The matters as the workspace stands now: seed data plus the legal manager's assignments. */
function currentMatters(): Matter[] {
  const assigned = readAssignments();
  return allMatters().map((m) => {
    const bar = assigned[m.id];
    const adv = bar ? ADVOCATES.find((a) => a.enrolment === bar) : undefined;
    return adv ? { ...m, advocate: adv } : m;
  });
}

/* ─────────────────────────────── Endpoints ─────────────────────────────── */

type DristiBatch = {
  batchId: string;
  batchNumber: string;
  clubbedInto: string | null;
  cases: { reference: string; status: "draft" | "filed"; caseFileNumber: string | null }[];
};

/**
 * The workspace's Section 138 matters, with what has happened to each since it was filed
 * through the connector: "Filed" on SARAS 2.0 at once, and the case file number once the
 * court reports one.
 */
async function matters() {
  const all = currentMatters();
  let dristi: DristiBatch[] | null = null;
  try {
    const res = await sarasBatches();
    if (res.ok) dristi = res.json as DristiBatch[];
  } catch {
    dristi = null;
  }

  // A push whose batch the court no longer holds (its records were reset) is forgotten,
  // so the two sides of the demo never disagree.
  let pushes = readPushes();
  if (dristi) {
    const kept = pushes.filter((p) => dristi!.some((b) => b.batchId === p.batchId));
    if (kept.length !== pushes.length) write(PUSHES, (pushes = kept));
  }

  const rows = all.map((m) => {
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

  return { matters: rows, courtReachable: dristi !== null, courtUrl: window.location.origin };
}

/** Assign an empanelled advocate to matters. */
function assignAdvocate({ matterIds, enrolment }: { matterIds: string[]; enrolment: string }) {
  if (!ADVOCATES.some((a) => a.enrolment === enrolment) || !matterIds?.length) {
    return Response.json({ error: "Choose an empanelled advocate and at least one case." }, { status: 400 });
  }
  assign(matterIds, enrolment);
  return Response.json({ ok: true });
}

/**
 * The advocates who may file for Tata Capital on a court, asked of that court: SARAS 2.0
 * answers through its Bulk Filing API. Other courts are not connected in this demo.
 */
async function courtAdvocates(court: string | null) {
  if (court !== "saras") return Response.json({ error: "This court is not connected." }, { status: 404 });
  try {
    const res = await sarasAdvocates();
    if (!res.ok) throw new Error(String(res.status));
    return Response.json(res.json);
  } catch {
    return Response.json({ error: `SARAS 2.0 could not be reached at ${window.location.origin}.` }, { status: 502 });
  }
}

/**
 * File the selected matters on SARAS 2.0 through the court's Bulk Filing API
 * (`POST /api/bulk/v1/batches`). One batch per advocate, since each lands in that
 * advocate's account.
 */
async function push(body: {
  matterIds: string[];
  adr?: "yes" | "no";
  sentBy?: string;
  /** Matter id → the court advocate it is filed through, chosen in the filing dialog. */
  assignments?: Record<string, { name: string; enrolment: string }>;
}) {
  const { matterIds, adr, sentBy, assignments } = body;
  // Record the dialog's choices on the matters first, so Provakil shows who filed each.
  if (assignments) {
    const byAdvocate = new Map<string, string[]>();
    for (const [id, a] of Object.entries(assignments)) byAdvocate.set(a.enrolment, [...(byAdvocate.get(a.enrolment) ?? []), id]);
    for (const [enrolment, ids] of byAdvocate) assign(ids, enrolment);
  }
  const chosen = currentMatters()
    .filter((m) => matterIds.includes(m.id))
    .map((m) => (assignments?.[m.id] ? { ...m, advocate: assignments[m.id] } : m));
  if (chosen.length === 0) return Response.json({ error: "No cases selected." }, { status: 400 });
  const unassigned = chosen.filter((m) => !m.advocate);
  if (unassigned.length) {
    return Response.json(
      { error: "Assign an advocate first.", details: unassigned.map((m) => `${m.lan} has no advocate.`) },
      { status: 400 }
    );
  }

  const byAdvocate = new Map<string, Matter[]>();
  for (const m of chosen) byAdvocate.set(m.advocate!.enrolment, [...(byAdvocate.get(m.advocate!.enrolment) ?? []), m]);

  // The court fetches each document from Provakil's own address, as it would from outside.
  const docBase = `${window.location.origin}/provakil`;
  const batches: { pushId: string; advocate: Matter["advocate"]; request: unknown; response: unknown }[] = [];
  for (const [enrolment, group] of byAdvocate) {
    const pushId = `PVK-PUSH-${Date.now().toString(36).toUpperCase()}${batches.length}`;
    const request = buildRequest(group, { docBase, pushId, sentBy: sentBy ?? "Priya Vyas", adr: adr ?? "no" });
    let res: Awaited<ReturnType<typeof sarasPush>>;
    try {
      res = await sarasPush(request);
    } catch {
      return Response.json({ error: `SARAS 2.0 could not be reached at ${window.location.origin}.`, batches }, { status: 502 });
    }
    const json = res.json as { error?: string; details?: string[]; batchId: string; batchNumber: string; url: string };
    if (!res.ok) {
      return Response.json({ error: json.error ?? `SARAS 2.0 answered ${res.status}.`, details: json.details, batches }, { status: 502 });
    }
    write(PUSHES, [
      ...readPushes(),
      {
        pushId,
        advocate: enrolment,
        at: new Date().toISOString(),
        by: sentBy ?? "Priya Vyas",
        matterIds: group.map((m) => m.id),
        batchId: json.batchId,
        batchNumber: json.batchNumber,
        url: json.url,
      } satisfies PushRecord,
    ]);
    batches.push({ pushId, advocate: group[0].advocate, request, response: json });
  }
  return Response.json({ batches });
}

/** `fetch` for Provakil's screens: its four endpoints, answered in the browser. */
export async function provakilFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const u = new URL(url, window.location.origin);
  const body = () => JSON.parse(typeof init.body === "string" ? init.body : "null");
  switch (u.pathname) {
    case "/api/matters":
      return Response.json(await matters());
    case "/api/assign":
      return assignAdvocate(body());
    case "/api/court-advocates":
      return courtAdvocates(u.searchParams.get("court"));
    case "/api/push":
      return push(body());
    default:
      return Response.json({ error: "Not found." }, { status: 404 });
  }
}
