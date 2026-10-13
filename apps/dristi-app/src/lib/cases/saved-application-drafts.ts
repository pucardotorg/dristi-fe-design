/**
 * Applications filed from the Raise application form during this visit —
 * demo memory, no backend (see `demo-session.ts`: kept while the viewer
 * moves around, gone on a refresh so every scenario is back). Drafts first (Save as draft), and since
 * Sept 24 anything the form's chain ends on too: waiting for a signature
 * (signed later, or a clerk's hand-off to the advocate), waiting for
 * payment, or paid. Before that, nothing filed from the form ever reached
 * the register.
 *
 * "Save as draft" on the Raise application form has to leave something the
 * filer can come back to, or the button is a promise the prototype cannot
 * keep. So a saved draft is written here, per case, and the Applications
 * register reads it back as a Draft row whose "Continue draft" reopens the
 * form. The same shape the register already resumes pack drafts from: the
 * type, a title, and the ask in the filer's words (see
 * `applicationDraftFrom`). Files and dates are not kept, exactly as with the
 * pack's drafts.
 *
 * Read with `useSessionValue(savedDraftsKey(caseId))` and parse with
 * `parseSavedDrafts`, so every reader updates when one is saved.
 */

import { readSessionValue, writeSessionValue } from "./demo-session";

import {
  isSubmittedToCourt,
  type ApplicationTypeId,
  type FilingStatus,
  type Submission,
} from "./applications";

export type SavedApplicationDraft = {
  id: string;
  type: ApplicationTypeId;
  title: string;
  /** The ask in the filer's words; restored into the field that holds it. */
  request: string;
  objectionToId: string | null;
  createdById: string;
  submittedById: string;
  onBehalfOfId: string;
  /** ISO timestamp. */
  addedOn: string;
  /** Absent means a draft. */
  status?: FilingStatus;
  /** Set once paid: submitted (ALC-01) and allotted its temporary ID (ALC-02). */
  submittedOn?: string;
  temporaryId?: string;
};

export function savedDraftsKey(caseId: string): string {
  return `dristi-demo-application-drafts:${caseId}`;
}

export function parseSavedDrafts(raw: string | null): SavedApplicationDraft[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as SavedApplicationDraft[]) : [];
  } catch {
    return [];
  }
}

function readSaved(caseId: string): SavedApplicationDraft[] {
  return parseSavedDrafts(readSessionValue(savedDraftsKey(caseId)));
}

/** Save, or replace the draft with the same id. */
export function saveApplicationDraft(
  caseId: string,
  draft: SavedApplicationDraft
): void {
  const next = [
    draft,
    ...readSaved(caseId).filter((item) => item.id !== draft.id),
  ];
  writeSessionValue(savedDraftsKey(caseId), JSON.stringify(next));
}

export function newSavedDraftId(): string {
  return `saved-${crypto.randomUUID()}`;
}

/** A saved filing as a register row. A draft has nothing allotted yet. */
export function savedDraftSubmission(draft: SavedApplicationDraft): Submission {
  const status = draft.status ?? "draft";
  const filed = isSubmittedToCourt(status);
  return {
    id: draft.id,
    kind: "application",
    type: draft.type,
    title: draft.title,
    status,
    addedOn: draft.addedOn,
    submittedById: draft.submittedById,
    createdById: draft.createdById,
    onBehalfOfId: draft.onBehalfOfId,
    temporaryId: filed ? (draft.temporaryId ?? null) : null,
    applicationNumber: null,
    submittedOn: filed ? (draft.submittedOn ?? null) : null,
    onboardedOn: null,
    decisionOn: null,
    objectionsInvited: null,
    objectionToId: draft.objectionToId,
    expiresOn: null,
    request: draft.request || null,
    courtResult: null,
    linkedOrder: null,
    defects: [],
    documents: [
      { label: filed ? "Filed application" : "Draft application" },
    ],
  };
}
