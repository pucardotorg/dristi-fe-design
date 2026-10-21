/**
 * Where batches and their documents are kept, as the bulk handlers (`handlers.ts`) use
 * it. Two places implement it:
 *
 *   · `store.server.ts`: a JSON file and a folder of uploads on the server, where the
 *     app runs from a checkout that can write (the local demo). An API push arrives at
 *     the server with no browser attached, so the Provakil demo needs this one.
 *   · `store.browser.ts`: the browser's own IndexedDB, where the server cannot write
 *     (a hosted deployment, whose file system is read-only). Each person then sees the
 *     batches made in their own browser, as single filing keeps its drafts.
 *
 * Engineering replaces both with the case service.
 */

import type { StoredFileRef } from "@/lib/filing/types";

import type { Batch } from "./types";

export type FileMeta = Omit<StoredFileRef, "id">;

export interface BulkStore {
  listBatches(): Promise<Batch[]>;
  getBatch(id: string): Promise<Batch | null>;
  /** Add a new batch, numbering it. */
  insertBatch(batch: Omit<Batch, "number">): Promise<Batch>;
  /** Change one batch in place; `change` returns the new one, or `null` to leave it. */
  updateBatch(id: string, change: (batch: Batch, all: Batch[]) => Batch | null): Promise<Batch | null>;
  /** Replace several batches at once: clubbing closes the originals and opens a new one. */
  applyBatches(change: (all: Batch[]) => { all: Batch[]; result: Batch }): Promise<Batch>;
  saveFile(bytes: Uint8Array, name: string, type: string): Promise<StoredFileRef>;
  /** Store a file under an id the caller chose (`storeUpload` names files first). */
  saveFileAs(id: string, bytes: Uint8Array, name: string, type: string): Promise<StoredFileRef>;
  readFile(id: string): Promise<{ bytes: Uint8Array; meta: FileMeta } | null>;
}

/** File ids a store serves: its own (`bf_…`) and those the filing screens mint (`f_…`). */
export const FILE_ID = /^(bf|f)_[a-z0-9]+$/i;

/** "BLK-2026-0007": numbered in the order batches arrive, per year. */
export function numberFor(all: Batch[], at: Date): string {
  const year = at.getFullYear();
  const prefix = `BLK-${year}-`;
  const last = all
    .map((b) => b.number)
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)) || 0)
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(last + 1).padStart(4, "0")}`;
}

export function metaFor(name: string, size: number, type: string): FileMeta {
  const ext = (name.split(".").pop() || "").toUpperCase().slice(0, 5) || "FILE";
  return { name, size, type: type || "application/octet-stream", ext };
}

/** One queue per store, so two requests never interleave a read and a write. */
export function serialQueue() {
  let queue: Promise<unknown> = Promise.resolve();
  return function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  };
}

/** The batch operations every store shares, over a whole-list read and write. */
export function batchOps(
  serial: <T>(work: () => Promise<T>) => Promise<T>,
  readAll: () => Promise<Batch[]>,
  writeAll: (batches: Batch[]) => Promise<void>,
): Pick<BulkStore, "listBatches" | "getBatch" | "insertBatch" | "updateBatch" | "applyBatches"> {
  return {
    listBatches: () => serial(readAll),
    async getBatch(id) {
      return (await serial(readAll)).find((b) => b.id === id) ?? null;
    },
    insertBatch: (batch) =>
      serial(async () => {
        const all = await readAll();
        const saved: Batch = { ...batch, number: numberFor(all, new Date(batch.createdAt)) };
        all.push(saved);
        await writeAll(all);
        return saved;
      }),
    updateBatch: (id, change) =>
      serial(async () => {
        const all = await readAll();
        const i = all.findIndex((b) => b.id === id);
        if (i < 0) return null;
        const next = change(structuredClone(all[i]), all);
        if (!next) return all[i];
        all[i] = { ...next, updatedAt: new Date().toISOString() };
        await writeAll(all);
        return all[i];
      }),
    applyBatches: (change) =>
      serial(async () => {
        const before = await readAll();
        const { all, result } = change(structuredClone(before));
        if (!result.number) result.number = numberFor(before, new Date(result.createdAt));
        await writeAll(all.map((b) => (b.id === result.id ? result : b)));
        return result;
      }),
  };
}
