/**
 * Where batches live: a JSON file and a folder of uploads under `apps/dristi-app/.data/bulk`
 * (git-ignored). Server-side, because an API push arrives at the server with no browser
 * attached, and the sender asks it back for status. The single-case flow keeps its drafts
 * in the browser (`lib/filing/data`); engineering replaces both with the case service.
 *
 * Writes are serialised through one queue so two requests never interleave a read and a
 * write of the same file.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { newId } from "@/lib/filing/data";
import type { StoredFileRef } from "@/lib/filing/types";

import type { Batch } from "./types";

const ROOT = path.join(process.cwd(), ".data", "bulk");
const BATCHES = path.join(ROOT, "batches.json");
const FILES = path.join(ROOT, "files");

let queue: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

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

export function listBatches(): Promise<Batch[]> {
  return serial(readAll);
}

export async function getBatch(id: string): Promise<Batch | null> {
  const all = await listBatches();
  return all.find((b) => b.id === id) ?? null;
}

/** "BLK-2026-0007" — numbered in the order batches arrive, per year. */
function numberFor(all: Batch[], at: Date): string {
  const year = at.getFullYear();
  const prefix = `BLK-${year}-`;
  const last = all
    .map((b) => b.number)
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)) || 0)
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(last + 1).padStart(4, "0")}`;
}

/** Add a new batch, numbering it. */
export function insertBatch(batch: Omit<Batch, "number">): Promise<Batch> {
  return serial(async () => {
    const all = await readAll();
    const saved: Batch = { ...batch, number: numberFor(all, new Date(batch.createdAt)) };
    all.push(saved);
    await writeAll(all);
    return saved;
  });
}

/**
 * Change one batch in place. `change` gets the stored copy and returns the new one, or
 * `null` to leave it untouched. Returns what was saved.
 */
export function updateBatch(
  id: string,
  change: (batch: Batch, all: Batch[]) => Batch | null
): Promise<Batch | null> {
  return serial(async () => {
    const all = await readAll();
    const i = all.findIndex((b) => b.id === id);
    if (i < 0) return null;
    const next = change(structuredClone(all[i]), all);
    if (!next) return all[i];
    all[i] = { ...next, updatedAt: new Date().toISOString() };
    await writeAll(all);
    return all[i];
  });
}

/** Replace several batches at once — clubbing closes the originals and opens a new one. */
export function applyBatches(
  change: (all: Batch[]) => { all: Batch[]; result: Batch }
): Promise<Batch> {
  return serial(async () => {
    const before = await readAll();
    const { all, result } = change(structuredClone(before));
    if (!result.number) result.number = numberFor(before, new Date(result.createdAt));
    await writeAll(all.map((b) => (b.id === result.id ? result : b)));
    return result;
  });
}

export function nextNumberPreview(all: Batch[], at: Date): string {
  return numberFor(all, at);
}

/* ─────────────────────────────── Files ─────────────────────────────── */

type FileMeta = Omit<StoredFileRef, "id">;

/** File ids this store serves: its own (`bf_…`) and those the filing screens mint (`f_…`). */
const FILE_ID = /^(bf|f)_[a-z0-9]+$/i;

export async function saveFile(bytes: Uint8Array, name: string, type: string): Promise<StoredFileRef> {
  return saveFileAs(newId("bf"), bytes, name, type);
}

/**
 * Store a file under an id the caller chose. The filing screens name an upload before
 * they store it (`storeUpload`), so a bulk case opened in them keeps that id.
 */
export async function saveFileAs(
  id: string,
  bytes: Uint8Array,
  name: string,
  type: string
): Promise<StoredFileRef> {
  if (!FILE_ID.test(id)) throw new Error("Not a file id.");
  await fs.mkdir(FILES, { recursive: true });
  const ext = (name.split(".").pop() || "").toUpperCase().slice(0, 5) || "FILE";
  const meta: FileMeta = { name, size: bytes.byteLength, type: type || "application/octet-stream", ext };
  await fs.writeFile(path.join(FILES, id), bytes);
  await fs.writeFile(path.join(FILES, `${id}.json`), JSON.stringify(meta));
  return { id, ...meta };
}

export async function readFile(id: string): Promise<{ bytes: Buffer; meta: FileMeta } | null> {
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
}
