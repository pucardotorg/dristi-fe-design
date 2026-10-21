"use client";

/**
 * Batches in the browser's IndexedDB, for where the server cannot write (`store.ts`).
 * The whole list is one record, read and written whole, as the server's JSON file is.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { newId } from "@/lib/filing/data";
import type { StoredFileRef } from "@/lib/filing/types";

import { batchOps, FILE_ID, metaFor, serialQueue, type BulkStore, type FileMeta } from "./store";
import type { Batch } from "./types";

interface BulkDB extends DBSchema {
  batches: { key: string; value: Batch[] };
  files: { key: string; value: { blob: Blob; meta: FileMeta } };
}

let dbPromise: Promise<IDBPDatabase<BulkDB>> | null = null;

function db(): Promise<IDBPDatabase<BulkDB>> {
  dbPromise ??= openDB<BulkDB>("dristi-bulk", 1, {
    upgrade(database) {
      database.createObjectStore("batches");
      database.createObjectStore("files");
    },
  });
  return dbPromise;
}

async function readAll(): Promise<Batch[]> {
  return (await (await db()).get("batches", "all")) ?? [];
}

async function writeAll(batches: Batch[]): Promise<void> {
  await (await db()).put("batches", batches, "all");
}

async function saveFileAs(id: string, bytes: Uint8Array, name: string, type: string): Promise<StoredFileRef> {
  if (!FILE_ID.test(id)) throw new Error("Not a file id.");
  const meta = metaFor(name, bytes.byteLength, type);
  await (await db()).put("files", { blob: new Blob([bytes as BlobPart], { type: meta.type }), meta }, id);
  return { id, ...meta };
}

export const browserStore: BulkStore = {
  ...batchOps(serialQueue(), readAll, writeAll),
  saveFileAs,
  saveFile: (bytes, name, type) => saveFileAs(newId("bf"), bytes, name, type),
  async readFile(id) {
    if (!FILE_ID.test(id)) return null;
    const hit = await (await db()).get("files", id);
    return hit ? { bytes: new Uint8Array(await hit.blob.arrayBuffer()), meta: hit.meta } : null;
  },
};
