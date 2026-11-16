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

import type { Batch, BatchCase } from "./types";

export type FileMeta = Omit<StoredFileRef, "id">;

export interface BulkStore {
  listBatches(): Promise<Batch[]>;
  getBatch(id: string): Promise<Batch | null>;
  /** Add a new batch, numbering it. */
  insertBatch(batch: Omit<Batch, "number">): Promise<Batch>;
  /** Change one batch in place; `change` returns the new one, or `null` to leave it. */
  updateBatch(id: string, change: (batch: Batch, all: Batch[]) => Batch | null): Promise<Batch | null>;
  /** Forget one batch: one whose every case was removed no longer exists (BLK-08b). */
  deleteBatch(id: string): Promise<void>;
  /** Replace several batches at once: clubbing closes the originals and opens a new one. */
  applyBatches(change: (all: Batch[]) => { all: Batch[]; result: Batch }): Promise<Batch>;
  saveFile(bytes: Uint8Array, name: string, type: string): Promise<StoredFileRef>;
  /** Store a file under an id the caller chose (`storeUpload` names files first). */
  saveFileAs(id: string, bytes: Uint8Array, name: string, type: string): Promise<StoredFileRef>;
  readFile(id: string): Promise<{ bytes: Uint8Array; meta: FileMeta } | null>;
  /** Forget every batch and file: "Reset sandbox data" starts the bulk flow empty. */
  clear(): Promise<void>;
}

/** File ids a store serves: its own (`bf_…`) and those the filing screens mint (`f_…`). */
export const FILE_ID = /^(bf|f)_[a-z0-9]+$/i;

/**
 * "B7": B and a count of the filer's own batches (BLK-04a), so two filers can each have a
 * B1. The sandbox keeps one filer's batches, so the count runs over all of them.
 */
export function numberFor(all: Pick<Batch, "number">[]): string {
  const last = all.map((b) => countOf(b.number)).reduce((max, n) => Math.max(max, n), 0);
  return `B${last + 1}`;
}

/** The count in a batch number: 7 for "B7", and for one stored as "BLK-2026-0007". */
function countOf(number: string): number {
  return Number(/^B(\d+)$/.exec(number)?.[1] ?? /^BLK-\d{4}-(\d+)$/.exec(number)?.[1] ?? 0);
}

/** A batch stored before BLK-04a ("BLK-2026-0007") read in the filer's count ("B7"). */
export function currentNumber(number: string): string {
  return /^BLK-\d{4}-\d+$/.test(number) ? `B${countOf(number)}` : number;
}

/**
 * A case's draft number: its batch number, R, and its row in the Excel file (BLK-04b).
 * A case from the API has no row; its place in the request stands in.
 */
export function draftNumber(batch: Pick<Batch, "number">, bc: Pick<BatchCase, "row">, index: number): string {
  return `${currentNumber(batch.number)}-R${bc.row ?? index + 1}`;
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
  readStored: () => Promise<Batch[]>,
  writeAll: (batches: Batch[]) => Promise<void>,
): Pick<BulkStore, "listBatches" | "getBatch" | "insertBatch" | "updateBatch" | "applyBatches" | "deleteBatch"> {
  // Batches stored before B-numbers read in the filer's count.
  const readAll = async () => (await readStored()).map((b) => ({ ...b, number: currentNumber(b.number) }));
  return {
    listBatches: () => serial(readAll),
    async getBatch(id) {
      return (await serial(readAll)).find((b) => b.id === id) ?? null;
    },
    insertBatch: (batch) =>
      serial(async () => {
        const all = await readAll();
        const saved: Batch = { ...batch, number: numberFor(all) };
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
    deleteBatch: (id) =>
      serial(async () => {
        await writeAll((await readAll()).filter((b) => b.id !== id));
      }),
    applyBatches: (change) =>
      serial(async () => {
        const before = await readAll();
        const { all, result } = change(structuredClone(before));
        if (!result.number) result.number = numberFor(before);
        await writeAll(all.map((b) => (b.id === result.id ? result : b)));
        return result;
      }),
  };
}
