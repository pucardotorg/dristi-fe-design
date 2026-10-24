"use client";

/**
 * The batch's complainants and advocates while an upload is being set up (Bulk filing PRD
 * `BLK-05`), entered in the single filing's own Complainant, Advocate and Documents
 * sections.
 *
 * Those sections read and write a `FilingDraft`, so the setup is one: a draft that is not
 * a case. It is held in this tab's session storage, never in the filer's list of drafts,
 * and is copied onto every case when the batch is created (`applyParties`). Its documents
 * go straight to the bulk file store, where the batch's cases will find them.
 */

import type { FilingRepository, StoredFile } from "@/lib/filing/data";
import { newId } from "@/lib/filing/data";
import { IndexedDbFilingRepository } from "@/lib/filing/data/indexeddb";
import { createBlankDraft } from "@/lib/filing/blank";
import type { Address, FilingDraft, UserProfile } from "@/lib/filing/types";
import { bulkFetch } from "@/components/bulk/api";
import { demoPdf } from "@/components/bulk/demo-fill";

import { CLIENTS } from "./clients";

const KEY = (id: string) => `bulk-setup:${id}`;

/** A new setup, prefilled as a new filing is (the filing advocate, `FIL-05`). */
export function createSetupDraft(profile: UserProfile | null): FilingDraft {
  const draft = createBlankDraft(newId("setup"), profile);
  // Only the complainants' documents are set up here; each case's own come after.
  draft.intake.cheques = [];
  return draft;
}

/** The setup as stored, or `null` when this tab has none by that id. */
/** District and state of the demo client's pincodes, as a pincode lookup would fill them. */
const DEMO_PLACES: Record<string, Pick<Address, "district" | "state">> = {
  "400013": { district: "Mumbai", state: "Maharashtra" },
  "380009": { district: "Ahmedabad", state: "Gujarat" },
};

/**
 * Prototype only: the system knows the filer's client, so a new upload arrives with the
 * complainant filled in (`lib/bulk/clients.ts`, Tata Capital) and its identity proof
 * attached. The advocates, and the vakalatnama that names them, are left to the filer.
 */
export async function prefillKnownComplainant(draft: FilingDraft): Promise<void> {
  const src = CLIENTS[0].complainant;
  const addr = (a: { line1: string; city: string; pin: string }): Address => ({
    ...a,
    district: DEMO_PLACES[a.pin]?.district ?? "",
    state: DEMO_PLACES[a.pin]?.state ?? "",
  });
  const c = draft.complainants[0];
  const rep = src.representative!;
  c.pip = "no";
  c.type = "institution";
  c.entType = src.institutionType ?? "";
  c.entName = src.name;
  c.entCinPan = (src.cinPan ?? "").toUpperCase();
  c.entPhone = src.phone ?? "";
  c.entEmail = src.email ?? "";
  c.entAddr = addr(src.address);
  c.rep = {
    ...c.rep,
    name: rep.name,
    designation: rep.designation ?? "",
    age: rep.age ?? "",
    mobile: rep.mobile ?? "",
    email: rep.email ?? "",
    addr: addr(rep.address ?? src.address),
  };
  // The representative signs for the institution, so theirs is the number verified.
  c.mobile = c.rep.mobile;
  c.verified = true;

  const file = demoPdf(`Identity proof: ${src.name}`);
  const ref = { id: newId("f"), name: file.name, size: file.size, type: file.type, ext: "PDF" };
  await new BulkSetupRepository(draft.id).putFile({ ...ref, blob: file, createdAt: new Date().toISOString() });
  const slot = draft.intake.parties[0]?.slots.find((x) => x.docType === "id-proof");
  if (slot) slot.file = ref;
}

export function readSetupRaw(id: string): string | null {
  try {
    return window.sessionStorage.getItem(KEY(id));
  } catch {
    return null;
  }
}

export function readSetupDraft(id: string): FilingDraft | null {
  const raw = readSetupRaw(id);
  return raw ? (JSON.parse(raw) as FilingDraft) : null;
}

export function writeSetupDraft(draft: FilingDraft): void {
  window.sessionStorage.setItem(KEY(draft.id), JSON.stringify(draft));
}

export class BulkSetupRepository implements FilingRepository {
  private local = new IndexedDbFilingRepository();

  constructor(private readonly setupId: string) {}

  /* Drafts: only the setup. */

  async listDrafts(): Promise<FilingDraft[]> {
    const d = readSetupDraft(this.setupId);
    return d ? [d] : [];
  }

  async getDraft(): Promise<FilingDraft | null> {
    return readSetupDraft(this.setupId);
  }

  async putDraft(draft: FilingDraft): Promise<void> {
    writeSetupDraft(draft);
  }

  async deleteDraft(): Promise<void> {
    window.sessionStorage.removeItem(KEY(this.setupId));
  }

  /* Files: the bulk file store, so every case of the batch can use them. */

  async putFile(file: StoredFile): Promise<void> {
    const form = new FormData();
    form.set("file", new File([file.blob], file.name, { type: file.type }));
    const res = await bulkFetch(`/api/bulk/files/${encodeURIComponent(file.id)}`, {
      method: "PUT",
      body: form,
    });
    if (!res.ok) throw new Error(`The file could not be stored (${res.status})`);
  }

  async getFile(id: string): Promise<StoredFile | null> {
    const res = await bulkFetch(`/api/bulk/files/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const name = decodeURIComponent(
      /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? id,
    );
    const ext = (name.split(".").pop() || "").toUpperCase().slice(0, 5) || "FILE";
    return { id, name, size: blob.size, type: blob.type, ext, blob, createdAt: "" };
  }

  /** Kept: a case of the batch may already point at the file. */
  async deleteFile(): Promise<void> {}

  async deleteFiles(): Promise<void> {}

  /* Profile: the person at the keyboard, as everywhere else. */

  getProfile(): Promise<UserProfile | null> {
    return this.local.getProfile();
  }

  putProfile(profile: UserProfile): Promise<void> {
    return this.local.putProfile(profile);
  }
}
