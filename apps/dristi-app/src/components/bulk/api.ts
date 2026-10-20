/** The batch endpoints, as the screens call them. */

import type { BatchSummary, BatchView } from "@/lib/bulk/actions.server";
import type { AiMode } from "@/lib/court/profiles";

export type { BatchSummary, BatchView, CaseView } from "@/lib/bulk/actions.server";

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
  list: () => fetch(`/api/bulk/batches?ai=${aiMode}`, { cache: "no-store" }).then((r) => json<BatchSummary[]>(r)),
  get: (id: string) => fetch(`/api/bulk/batches/${id}?ai=${aiMode}`, { cache: "no-store" }).then((r) => json<BatchView>(r)),
  act: (id: string, body: Record<string, unknown>) =>
    fetch(`/api/bulk/batches/${id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, ai: aiMode }),
    }).then((r) => json<BatchView>(r)),
  attach: (id: string, caseId: string, slotKey: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("caseId", caseId);
    form.set("slotKey", slotKey);
    form.set("ai", aiMode);
    return fetch(`/api/bulk/batches/${id}/files`, { method: "POST", body: form }).then((r) => json<BatchView>(r));
  },
  club: (batchIds: string[]) =>
    fetch("/api/bulk/club", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchIds }),
    }).then((r) => json<{ batchId: string; batchNumber: string }>(r)),
};

export const fileUrl = (id: string) => `/api/bulk/files/${id}`;
