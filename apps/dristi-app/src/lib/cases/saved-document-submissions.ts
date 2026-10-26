/**
 * Documents filed from Submit documents during this visit — demo memory, no
 * backend (see `demo-session.ts`: kept while the viewer moves around, gone on
 * a refresh so every scenario is back). The Applications register's own
 * filings live beside it in `saved-application-drafts.ts`; this is its
 * sibling for documents.
 *
 * A submission carries one document for now (PM, Oct 26); the list keeps
 * room for more (DSB-02). Each document is its own row on the Documents tab,
 * with its own title and type, and shares the submission's signature. So a
 * saved submission comes back as one `Submission` per document.
 *
 * The chosen files are kept twice: as object URLs on each document, for the
 * register to show, and as the `File`s themselves in memory here, so that
 * Continue draft can put them back into the form.
 *
 * Read with `useSessionValue(savedDocumentSubmissionsKey(caseId))` and parse
 * with `parseSavedDocumentSubmissions`, so every reader updates when one is
 * saved.
 */

import { readSessionValue, writeSessionValue } from "./demo-session";

import type { SubmissionDocumentTypeId, Submission } from "./applications";

export type SavedDocument = {
  id: string;
  type: SubmissionDocumentTypeId;
  title: string;
  /** Object URLs of the chosen files, with their names. */
  files: { label: string; href: string }[];
};

export type SavedDocumentSubmission = {
  id: string;
  documents: SavedDocument[];
  /**
   * Draft (saved to finish later), Pending signature (signed later, or sent
   * by a clerk to their advocates), or Submitted (signed). No payment
   * (DSB-19).
   */
  status: "draft" | "pending-signature" | "submitted";
  /** Who prepared it. */
  createdById: string;
  /** Who signs it: the filer themselves, or a clerk's first advocate. */
  submittedById: string;
  /** Every advocate who may sign a clerk's submission (DSB-18). */
  signers: string[];
  onBehalfOfId: string;
  /** ISO timestamp. */
  addedOn: string;
  /** ISO day, once signed. */
  submittedOn?: string;
};

export function savedDocumentSubmissionsKey(caseId: string): string {
  return `dristi-demo-document-submissions:${caseId}`;
}

export function parseSavedDocumentSubmissions(
  raw: string | null
): SavedDocumentSubmission[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as SavedDocumentSubmission[]) : [];
  } catch {
    return [];
  }
}

/** Save, or replace the submission with the same id. */
export function saveDocumentSubmission(
  caseId: string,
  submission: SavedDocumentSubmission,
  files: Map<string, File[]>
): void {
  const key = savedDocumentSubmissionsKey(caseId);
  const next = [
    submission,
    ...parseSavedDocumentSubmissions(readSessionValue(key)).filter(
      (item) => item.id !== submission.id
    ),
  ];
  for (const [documentId, chosen] of files) FILES.set(documentId, chosen);
  writeSessionValue(key, JSON.stringify(next));
}

/** The saved submission a document belongs to, for Continue draft. */
export function findDocumentSubmission(
  caseId: string,
  documentId: string
): SavedDocumentSubmission | undefined {
  return parseSavedDocumentSubmissions(
    readSessionValue(savedDocumentSubmissionsKey(caseId))
  ).find((item) => item.documents.some((doc) => doc.id === documentId));
}

/** The files chosen for a document, for the form to take back. */
export function savedDocumentFiles(documentId: string): File[] {
  return FILES.get(documentId) ?? [];
}

const FILES = new Map<string, File[]>();

export function newDocumentSubmissionId(): string {
  return `saved-docs-${crypto.randomUUID()}`;
}

export function newSavedDocumentId(): string {
  return `saved-doc-${crypto.randomUUID()}`;
}

/** Each document of a saved submission, as a register row. */
export function savedDocumentRows(
  submission: SavedDocumentSubmission
): Submission[] {
  const submitted = submission.status === "submitted";
  return submission.documents.map((doc) => ({
    id: doc.id,
    kind: "document",
    type: doc.type,
    title: doc.title,
    status: submission.status,
    addedOn: submission.addedOn,
    submittedById: submission.submittedById,
    signers: submission.signers,
    createdById: submission.createdById,
    onBehalfOfId: submission.onBehalfOfId,
    temporaryId: null,
    applicationNumber: null,
    submittedOn: submitted ? (submission.submittedOn ?? null) : null,
    onboardedOn: null,
    decisionOn: null,
    objectionsInvited: null,
    objectionToId: null,
    expiresOn: null,
    request: null,
    courtResult: null,
    linkedOrder: null,
    defects: [],
    documents: doc.files.map((file) => ({ label: file.label, href: file.href })),
  }));
}
