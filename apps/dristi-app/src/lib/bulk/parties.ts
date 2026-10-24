/**
 * The batch's complainants, advocates and their documents (Bulk filing PRD `BLK-05`), as
 * entered once on the upload's setup screens, and their copy onto every case.
 *
 * Copied, not linked: once the drafts exist each case's complainants and advocates are
 * its own, changed in that case like any other field (`BLK-06`).
 */

import { buildDocumentGroups } from "@/lib/filing/blank";
import type { Advocate, Complainant, FilingDraft, IntakeGroup } from "@/lib/filing/types";

import type { ApiComplainant } from "./contract";

export type BatchParties = {
  complainants: Complainant[];
  advocates: Advocate[];
  /** One group per complainant: identity proof, power of attorney, vakalatnama. */
  documents: IntakeGroup[];
};

/** What the setup draft holds for the batch. */
export function partiesOf(draft: FilingDraft): BatchParties {
  return {
    complainants: draft.complainants,
    advocates: draft.advocates,
    documents: draft.intake.parties,
  };
}

/** A complainant's name as the batch list shows it. */
export function complainantName(c: Complainant): string {
  return (c.type === "institution" ? c.entName : c.name).trim();
}

/**
 * The first complainant in the API's terms, for the parts of the batch that name its
 * complainant (the batch list, the request's own checks). The cases take the full records.
 */
export function apiComplainantOf(parties: BatchParties): ApiComplainant {
  const c = parties.complainants[0];
  return {
    type: c?.type === "individual" ? "individual" : "institution",
    name: c ? complainantName(c) : "",
    address: { line1: "", city: "", pin: "" },
  };
}

/** Puts the batch's complainants, advocates and their documents on a new case. */
export function applyParties(draft: FilingDraft, parties: BatchParties): void {
  draft.complainants = structuredClone(parties.complainants);
  draft.advocates = structuredClone(parties.advocates);
  draft.intake.parties = structuredClone(parties.documents);
  draft.documents = buildDocumentGroups(draft);
}
