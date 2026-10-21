/**
 * Batches on the server: a JSON file and a folder of uploads under
 * `apps/dristi-app/.data/bulk` (git-ignored), for a checkout that can write. See
 * `store.ts` for when the browser keeps them instead.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { newId } from "@/lib/filing/data";
import type { StoredFileRef } from "@/lib/filing/types";

import { batchOps, FILE_ID, metaFor, serialQueue, type BulkStore, type FileMeta } from "./store";
import type { Batch } from "./types";

const ROOT = path.join(process.cwd(), ".data", "bulk");
const BATCHES = path.join(ROOT, "batches.json");
const FILES = path.join(ROOT, "files");

async function readAll(): Promise<Batch[]> {
  try {
    return JSON.parse(await fs.readFile(BATCHES, "utf8")) as Batch[];
  } catch {
    return [];
  }
}

async function writeAll(batches: Batch[]): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
  const tmp = `${BATCHES}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(batches));
  await fs.rename(tmp, BATCHES);
}

async function saveFileAs(id: string, bytes: Uint8Array, name: string, type: string): Promise<StoredFileRef> {
  if (!FILE_ID.test(id)) throw new Error("Not a file id.");
  await fs.mkdir(FILES, { recursive: true });
  const meta = metaFor(name, bytes.byteLength, type);
  await fs.writeFile(path.join(FILES, id), bytes);
  await fs.writeFile(path.join(FILES, `${id}.json`), JSON.stringify(meta));
  return { id, ...meta };
}

export const serverStore: BulkStore = {
  ...batchOps(serialQueue(), readAll, writeAll),
  saveFileAs,
  saveFile: (bytes, name, type) => saveFileAs(newId("bf"), bytes, name, type),
  async readFile(id) {
    if (!FILE_ID.test(id)) return null;
    try {
      const [bytes, meta] = await Promise.all([
        fs.readFile(path.join(FILES, id)),
        fs.readFile(path.join(FILES, `${id}.json`), "utf8"),
      ]);
      return { bytes, meta: JSON.parse(meta) as FileMeta };
    } catch {
      return null;
    }
  },
};

/**
 * Whether this server can keep batches: false on a deployment whose file system is
 * read-only, and the screens then keep them in the browser.
 */
export async function serverCanWrite(): Promise<boolean> {
  // `BULK_STORE=browser` keeps batches in the browser on a server that could write, to
  // try a hosted deployment's behaviour locally.
  if (process.env.BULK_STORE === "browser") return false;
  try {
    await fs.mkdir(ROOT, { recursive: true });
    const probe = path.join(ROOT, `.probe-${process.pid}`);
    await fs.writeFile(probe, "");
    await fs.rm(probe);
    return true;
  } catch {
    return false;
  }
}

// The names the routes and the v1 API have always used.
export const { listBatches, getBatch, insertBatch, updateBatch, applyBatches, saveFile, readFile } = serverStore;
export { saveFileAs };
