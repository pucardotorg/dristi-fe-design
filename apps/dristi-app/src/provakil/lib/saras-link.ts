/**
 * Provakil's only way into SARAS 2.0: the court's Bulk Filing API v1, as any outside
 * litigation system would call it, with its bearer key.
 *
 * Where the court keeps batches on its server (a local checkout), these are HTTP calls to
 * `/api/bulk/v1/*`, and the court fetches each document from Provakil's own address. Where
 * it cannot (a hosted deployment, whose file system is read-only), the court's screens
 * keep batches in the browser (`lib/bulk/store.ts`), so the same v1 handlers run here
 * against that store; the request and the answer are the same either way.
 */

import { bulkStoreWhere } from "@/components/bulk/api";

const API_KEY = "dristi-demo-key";
const auth = { authorization: `Bearer ${API_KEY}` };

type Answer = { ok: boolean; status: number; json: unknown };

async function answer(res: Response): Promise<Answer> {
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

async function inBrowser(run: (h: typeof import("@/lib/bulk/handlers"), store: typeof import("@/lib/bulk/store.browser").browserStore) => Promise<{ status: number; json?: unknown }>): Promise<Answer> {
  const [h, { browserStore }] = await Promise.all([import("@/lib/bulk/handlers"), import("@/lib/bulk/store.browser")]);
  const reply = await run(h, browserStore);
  return { ok: reply.status < 400, status: reply.status, json: reply.json ?? {} };
}

/** `GET /api/bulk/v1/advocates`: the court's advocates who may file for the client. */
export async function sarasAdvocates(): Promise<Answer> {
  return answer(await fetch("/api/bulk/v1/advocates", { headers: auth, cache: "no-store" }));
}

/** `POST /api/bulk/v1/batches`: one push, one batch of drafts in the advocate's login. */
export async function sarasPush(body: unknown): Promise<Answer> {
  if ((await bulkStoreWhere()) === "server") {
    return answer(
      await fetch("/api/bulk/v1/batches", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      })
    );
  }
  return inBrowser((h, store) => h.receivePush(store, body, window.location.origin));
}

/** `GET /api/bulk/v1/batches`: what has been pushed, and where each case stands. */
export async function sarasBatches(): Promise<Answer> {
  if ((await bulkStoreWhere()) === "server") {
    return answer(await fetch("/api/bulk/v1/batches", { headers: auth, cache: "no-store", signal: AbortSignal.timeout(3000) }));
  }
  return inBrowser((h, store) => h.pushedBatches(store));
}
