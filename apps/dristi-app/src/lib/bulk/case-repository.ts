"use client";

/**
 * One bulk case, as the single filing's sections read and write it.
 *
 * A bulk case is an ordinary `FilingDraft` held on the server with its batch
 * (`store.server.ts`). Opening it in the filing sections means giving those sections a
 * repository that talks to the server instead of the browser's IndexedDB: the draft by
 * its case, uploads and file reads by the bulk file store. Everything that is not the
 * case (the profile, other drafts) stays with the browser's own repository.
 *
 * Engineering replaces this, like the IndexedDB one, with the case service.
 */

import type { FilingRepository, StoredFile } from "@/lib/filing/data";
import { IndexedDbFilingRepository } from "@/lib/filing/data/indexeddb";
import { bulkFetch } from "@/components/bulk/api";
import type { FilingDraft, UserProfile } from "@/lib/filing/types";

/** Window event after a case is saved; `detail` is the case id. */
export const BULK_CASE_SAVED = "bulk-case-saved";

async function failed(res: Response, what: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error((body as { error?: string } | null)?.error ?? `${what} (${res.status})`);
}

export class BulkCaseRepository implements FilingRepository {
  private local = new IndexedDbFilingRepository();

  constructor(
    private readonly batchId: string,
    private readonly caseId: string
  ) {}

  private get caseUrl() {
    return `/api/bulk/batches/${encodeURIComponent(this.batchId)}/cases/${encodeURIComponent(this.caseId)}`;
  }

  /* Drafts: only this case. */

  async listDrafts(): Promise<FilingDraft[]> {
    const d = await this.getDraft();
    return d ? [d] : [];
  }

  async getDraft(): Promise<FilingDraft | null> {
    const res = await bulkFetch(this.caseUrl, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) return failed(res, "The case could not be read");
    return ((await res.json()) as { draft: FilingDraft }).draft;
  }

  async putDraft(draft: FilingDraft): Promise<void> {
    const res = await bulkFetch(this.caseUrl, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft }),
    });
    if (!res.ok) return failed(res, "The case could not be saved");
    // The host listens, so it can re-run the batch's checks on what was saved.
    window.dispatchEvent(new CustomEvent(BULK_CASE_SAVED, { detail: this.caseId }));
  }

  async deleteDraft(): Promise<void> {
    throw new Error("A case is removed from its batch, not discarded here.");
  }

  /* Files: the bulk file store. */

  async putFile(file: StoredFile): Promise<void> {
    const form = new FormData();
    form.set("file", new File([file.blob], file.name, { type: file.type }));
    const res = await bulkFetch(`/api/bulk/files/${encodeURIComponent(file.id)}`, { method: "PUT", body: form });
    if (!res.ok) throw new Error(`The file could not be stored (${res.status})`);
  }

  async getFile(id: string): Promise<StoredFile | null> {
    const res = await bulkFetch(`/api/bulk/files/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const name =
      decodeURIComponent(/filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? id);
    const ext = (name.split(".").pop() || "").toUpperCase().slice(0, 5) || "FILE";
    return { id, name, size: blob.size, type: blob.type, ext, blob, createdAt: "" };
  }

  /**
   * Kept: a batch's files are its record, and the case may still point at an earlier one
   * through its documents list. The sandbox store does not collect them.
   */
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
