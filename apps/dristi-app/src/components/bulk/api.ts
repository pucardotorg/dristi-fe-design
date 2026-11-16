/** The batch endpoints, as the screens call them. */

import * as React from "react";

import type { BatchSummary, BatchView, CaseView } from "@/lib/bulk/actions.server";
import type { SetupBody } from "@/lib/bulk/handlers";
import type { ApiBatchRequest } from "@/lib/bulk/contract";
import type { NotCreated } from "@/lib/bulk/types";
import { firstFlaggedStep } from "@/lib/bulk/flag-place";
import { getStep } from "@/lib/filing/steps";
import type { StepId } from "@/lib/filing/types";
import type { AiMode } from "@/lib/court/profiles";

export type { BatchSummary, BatchView, CaseView } from "@/lib/bulk/actions.server";

/** An upload kept before Create, as the setup screens reopen it. */
export type KeptSetup = Omit<Extract<NotCreated, { kind: "excel" }>, "kind"> & { batchId: string; batchNumber: string };

/* ───────────────────────────── Where batches live ───────────────────────────── */

let where: Promise<"server" | "browser"> | null = null;

/**
 * Whether this deployment keeps batches on its server or in the browser (`lib/bulk/store.ts`):
 * asked once, of `/api/bulk/where`. A server that does not answer counts as read-only.
 */
export function bulkStoreWhere(): Promise<"server" | "browser"> {
  where ??= fetch("/api/bulk/where", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { store?: string } | null) => (j?.store === "server" ? "server" : "browser"))
    .catch(() => "browser" as const);
  return where;
}

/**
 * "Reset sandbox data" for the bulk flow: every batch goes, from the server and from this
 * browser, so the flow opens empty. Both, because which one held them depends on the
 * deployment; a server that cannot write just declines.
 */
export async function resetBulk(): Promise<void> {
  const { browserStore } = await import("@/lib/bulk/store.browser");
  await Promise.all([
    fetch("/api/bulk/batches", { method: "DELETE" }).catch(() => undefined),
    browserStore.clear(),
  ]);
}

/**
 * `fetch` for the bulk endpoints. Where the server keeps batches it is `fetch`; where it
 * cannot, the same handlers (`lib/bulk/handlers.ts`) run here against the browser's store
 * and answer with an ordinary `Response`, so the screens read it the same way.
 */
export async function bulkFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if ((await bulkStoreWhere()) === "server") return fetch(url, init);
  const [h, { browserStore: store }] = await Promise.all([
    import("@/lib/bulk/handlers"),
    import("@/lib/bulk/store.browser"),
  ]);
  const u = new URL(url, window.location.origin);
  const method = (init.method ?? "GET").toUpperCase();
  const parts = u.pathname.replace(/^\/api\/bulk\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const json = () => JSON.parse(typeof init.body === "string" ? init.body : "null");
  const form = () => (init.body instanceof FormData ? init.body : new FormData());
  const fileIn = (f: FormData, key: string) => {
    const v = f.get(key);
    return v instanceof File ? v : null;
  };
  const ai = u.searchParams.get("ai");

  let reply: Awaited<ReturnType<typeof h.getFile>> | null = null;
  const [a, id, b, caseId] = parts;
  if (a === "batches" && !id) reply = method === "POST" ? await h.createBatch(store, json()) : await h.listSummaries(store);
  else if (a === "batches" && !b)
    reply = method === "DELETE" ? await h.deleteNotCreated(store, id) : await h.getBatchView(store, id, ai);
  else if (a === "setups" && id)
    reply = method === "PUT" ? await h.saveSetup(store, id, json()) : await h.getSetup(store, id);
  else if (a === "batches" && b === "actions") reply = await h.act(store, id, json());
  else if (a === "batches" && b === "start")
    reply = method === "POST" ? await h.createPush(store, id, json()) : await h.getPush(store, id);
  else if (a === "batches" && b === "drafts") reply = await h.batchDrafts(store, id);
  else if (a === "batches" && b === "cases" && caseId)
    reply = method === "PUT" ? await h.putCase(store, id, caseId, json()) : await h.getCase(store, id, caseId);
  else if (a === "batches" && b === "files") {
    const f = form();
    reply = await h.attach(store, id, {
      file: fileIn(f, "file"),
      caseId: String(f.get("caseId") ?? ""),
      slotKey: String(f.get("slotKey") ?? ""),
      poor: f.get("poor") === "true",
      ai: f.get("ai")?.toString() ?? null,
    });
  } else if (a === "files" && id)
    reply = method === "PUT" ? await h.putFile(store, id, fileIn(form(), "file")) : await h.getFile(store, id);
  else if (a === "batches" && b === "sandbox-documents")
    reply = await h.sandboxDocuments(store, id, json().scenario, ai);
  else if (a === "sandbox" && id === "push") reply = await h.sandboxPushScenario(store, json().scenario, window.location.origin);
  else if (a === "club") reply = await h.club(store, json().batchIds);
  else if (a === "extract") {
    const f = form();
    reply = await h.extract(store, f.getAll("files").filter((x): x is File => x instanceof File), f.get("ai")?.toString() ?? null);
  }

  if (!reply) return Response.json({ error: "Not available in this deployment." }, { status: 404 });
  if ("file" in reply) {
    const { bytes, meta } = reply.file;
    return new Response(new Blob([bytes as BlobPart], { type: meta.type }), {
      headers: { "content-type": meta.type, "content-disposition": `inline; filename="${encodeURIComponent(meta.name)}"` },
    });
  }
  return Response.json(reply.json, { status: reply.status });
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/**
 * The AI setting every call carries, so the server's flags match the screen: the page's
 * `?ai=on|off|unavailable`, else the court's own setting. Set by the screen that owns it.
 */
let aiMode: AiMode = "on";
export function setBulkAiMode(mode: AiMode): void {
  aiMode = mode;
}

export const bulkApi = {
  list: () => bulkFetch(`/api/bulk/batches?ai=${aiMode}`, { cache: "no-store" }).then((r) => json<BatchSummary[]>(r)),
  get: (id: string) => bulkFetch(`/api/bulk/batches/${id}?ai=${aiMode}`, { cache: "no-store" }).then((r) => json<BatchView>(r)),
  act: (id: string, body: Record<string, unknown>) =>
    bulkFetch(`/api/bulk/batches/${id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, ai: aiMode }),
    }).then((r) => json<BatchView>(r)),
  /** Keep an upload left before Create in the batch list (BLK-10m). */
  saveSetup: (setupId: string, body: SetupBody) =>
    bulkFetch(`/api/bulk/setups/${encodeURIComponent(setupId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<{ batchId: string; batchNumber: string }>(r)),
  /** The upload kept for a setup, or `null` when none was. */
  getSetup: (setupId: string) =>
    bulkFetch(`/api/bulk/setups/${encodeURIComponent(setupId)}`, { cache: "no-store" }).then((r) =>
      r.status === 404 ? null : json<KeptSetup>(r),
    ),
  /** A push before it is created: what was sent (§3). */
  getPush: (id: string) =>
    bulkFetch(`/api/bulk/batches/${id}/start`, { cache: "no-store" }).then((r) =>
      json<{ batchId: string; batchNumber: string; client: string; source: BatchSummary["source"]; request: ApiBatchRequest }>(r),
    ),
  /** Create a push with the facts chosen on Facts of the case. */
  createPush: (id: string, detailsFormat: ApiBatchRequest["detailsFormat"]) =>
    bulkFetch(`/api/bulk/batches/${id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ detailsFormat }),
    }).then((r) => json<{ batchId: string; batchNumber: string }>(r)),
  /** Sandbox: Provakil pushes one of the 300-case scenarios. */
  sandboxPush: (scenario: string) =>
    bulkFetch("/api/bulk/sandbox/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario }),
    }).then((r) => json<{ batchId: string; batchNumber: string }>(r)),
  /** Sandbox: every case's documents filed at once, in one of three states. */
  sandboxDocuments: (id: string, scenario: "all" | "most" | "issues") =>
    bulkFetch(`/api/bulk/batches/${id}/sandbox-documents?ai=${aiMode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario }),
    }).then((r) => json<BatchView>(r)),
  /** The list's Delete, for a batch not created yet. */
  deleteNotCreated: (id: string) =>
    bulkFetch(`/api/bulk/batches/${id}`, { method: "DELETE" }).then((r) => json<{ deleted: string }>(r)),
  /** Take a case out; the reply says when that was the batch's last and the batch is gone. */
  remove: (id: string, caseId: string) =>
    bulkFetch(`/api/bulk/batches/${id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "remove", caseId, ai: aiMode }),
    }).then((r) => json<BatchView | { deleted: string }>(r)),
  /** `poor`: the browser's readability check found the scan too small to read. */
  attach: (id: string, caseId: string, slotKey: string, file: File, poor = false) => {
    const form = new FormData();
    form.set("file", file);
    form.set("caseId", caseId);
    form.set("slotKey", slotKey);
    form.set("poor", String(poor));
    form.set("ai", aiMode);
    return bulkFetch(`/api/bulk/batches/${id}/files`, { method: "POST", body: form }).then((r) => json<BatchView>(r));
  },
  club: (batchIds: string[]) =>
    bulkFetch("/api/bulk/club", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchIds }),
    }).then((r) => json<{ batchId: string; batchNumber: string }>(r)),
};

/**
 * A link to a stored document: the server's address where it keeps them, else an object
 * URL for the copy in this browser. `null` until it is known.
 */
export function useBulkFileUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = React.useState<{ id: string; url: string } | null>(null);
  React.useEffect(() => {
    if (!id) return;
    let live = true;
    let made: string | null = null;
    void bulkStoreWhere().then(async (w) => {
      if (w === "server") {
        if (live) setUrl({ id, url: `/api/bulk/files/${encodeURIComponent(id)}` });
        return;
      }
      const res = await bulkFetch(`/api/bulk/files/${encodeURIComponent(id)}`);
      if (!res.ok || !live) return;
      made = URL.createObjectURL(await res.blob());
      setUrl({ id, url: made });
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return id && url?.id === id ? url.url : null;
}

/** The AI setting the screen is on, for links that should keep it. */
export const bulkAiMode = () => aiMode;

/**
 * A case of a batch, open in the single filing's sections: at `step`, or at the first
 * section with something to fix. The `?ai=` the batch was opened with travels along.
 */
export function caseFlowHref(
  batchId: string,
  c: Pick<CaseView, "id" | "flags">,
  step: StepId = firstFlaggedStep(c.flags),
  ai: string | null = null,
): string {
  const base = `/filings/bulk/${encodeURIComponent(batchId)}/cases/${encodeURIComponent(c.id)}/${getStep(step).segment}`;
  return ai ? `${base}?ai=${encodeURIComponent(ai)}` : base;
}
