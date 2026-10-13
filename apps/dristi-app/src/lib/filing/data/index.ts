/**
 * Repository access for the filing screens. `getRepository()` is the one place that
 * chooses the implementation — swap it for an HTTP-backed one when the backend lands.
 */

import { IndexedDbFilingRepository } from "./indexeddb";
import type { FilingRepository, StoredFile } from "./repository";
import type { FilingDraft, StoredFileRef } from "../types";

export type { FilingRepository, StoredFile } from "./repository";

let instance: FilingRepository | null = null;

export function getRepository(): FilingRepository {
  if (typeof window === "undefined") {
    throw new Error("The filing repository is browser-only (IndexedDB).");
  }
  if (!instance) instance = new IndexedDbFilingRepository();
  return instance;
}

/** Short, URL-safe id for drafts, files and rows. */
export function newId(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${raw.slice(0, 12)}` : raw.slice(0, 12);
}

const REF_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Stand-in payment reference — the shape a gateway returns, generated locally. */
export function newPaymentRef(): string {
  const n = 10;
  let out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  } else {
    for (let i = 0; i < n; i += 1) {
      out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
    }
  }
  return `TXN-${out}`;
}

/** Stand-in case number — the sandbox generates one rather than getting it from a court. */
export function newCaseFileNumber(): string {
  const serial = String(Date.now() % 1_000_000).padStart(6, "0");
  return `KL-${serial}-${new Date().getFullYear()}`;
}

/** Store an upload and return the reference the draft keeps. */
export async function storeUpload(file: File): Promise<StoredFileRef> {
  const ext = (file.name.split(".").pop() || "").toUpperCase().slice(0, 5) || "FILE";
  const ref: StoredFileRef = {
    id: newId("f"),
    name: file.name,
    size: file.size,
    type: file.type,
    ext,
  };
  const stored: StoredFile = { ...ref, blob: file, createdAt: new Date().toISOString() };
  await getRepository().putFile(stored);
  return ref;
}

/** Every file id a draft references (intake, list of documents, signed copy). */
export function draftFileIds(draft: FilingDraft): string[] {
  const ids: string[] = [];
  const push = (ref: StoredFileRef | null | undefined) => {
    if (ref) ids.push(ref.id);
  };
  for (const g of draft.intake.cheques) g.slots.forEach((s) => push(s.file));
  for (const g of draft.intake.parties) g.slots.forEach((s) => push(s.file));
  draft.intake.supporting.forEach((s) => push(s.file));
  for (const g of draft.documents) g.docs.forEach((d) => push(d.file));
  Object.values(draft.sign.oaths ?? {}).forEach((o) => push(o.video?.file));
  push(draft.sign.signedCopy);
  return ids;
}

/** Delete a draft and every file only it referenced. */
export async function deleteDraftWithFiles(id: string): Promise<void> {
  const repo = getRepository();
  const draft = await repo.getDraft(id);
  await repo.deleteDraft(id);
  if (draft) await repo.deleteFiles(draftFileIds(draft));
}
