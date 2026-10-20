/**
 * A bulk batch: the filer's container for cases that came in together, by one API push or
 * one Excel upload. It exists only on the filer's side. The court never sees a batch
 * (Bulk Filing PRD §5); each case inside is an ordinary `FilingDraft`, so a case filed
 * from here is indistinguishable from one filed on its own (PRD §1).
 *
 * Batches never mix: a push or an upload always makes a new one. A filer may club batches
 * deliberately, which moves the cases into a new batch and closes the originals.
 */

import type { FilingDraft, SignInstrument } from "@/lib/filing/types";

export type BatchSourceKind = "api" | "excel" | "clubbed";

export type BatchSource = {
  kind: BatchSourceKind;
  /** "Provakil", "Excel upload", "Clubbed". */
  system: string;
  /** The sender's id for the push, or the uploaded file's name. */
  reference?: string;
  sentBy?: string;
};

/** How a batch was signed — least friction first (owner, 2026-10-20). */
export type BulkSignMethod = "mobile-otp" | "dsc" | "aadhaar" | "upload";

/**
 * Most documents one Aadhaar eSign OTP may sign. The eSign request carries one `InputHash`
 * per document, and the spec caps their index at 5: CCA, eSign API Specifications v3.3
 * (09 Dec 2020), §3.3.1.1 Element Details, `InputHash` attribute `id`: "Should start with
 * one. Maximum 5." Version 2.1, which the PRD names (§4.3), allows only one.
 */
export const AADHAAR_DOCS_PER_OTP = 5;

/** The rule above, for the hint that links to it. */
export const AADHAAR_LIMIT_SOURCE = {
  title: "eSign API Specifications v3.3, §3.3.1.1",
  publisher: "Controller of Certifying Authorities, MeitY",
  url: "https://cca.gov.in/sites/files/pdf/esign/eSign-APIv3.3.pdf#page=14",
  quote: "Maximum 5",
} as const;

/** The instrument a method writes on each signature record. */
export const SIGN_INSTRUMENT: Record<BulkSignMethod, SignInstrument> = {
  "mobile-otp": "otp",
  dsc: "dsc",
  aadhaar: "aadhaar",
  upload: "paper",
};

export type BatchCase = {
  id: string;
  /** The sender's reference (loan account number), shown beside the parties. */
  reference: string;
  draft: FilingDraft;
  /** Soft flags the filer chose to skip, by flag id. */
  skipped: string[];
  /**
   * The filer's declaration that they know neither phone nor email for these accused
   * (PRD A.3). Recorded as data; nothing is added to the case file.
   */
  noContactDeclared: string[];
  /** The Bar Council lookup failed for these bar numbers at intake. */
  unknownBar: string[];
  /** Documents the sender listed but DRISTI could not fetch. */
  fetchFailed: string[];
  /** Notices (by index) whose delivery the sender did not know yet, such as in transit. */
  unknownService: number[];
  /** How each case was signed in bulk, once it is. */
  signedWith: BulkSignMethod | null;
  /** The per-case receipt issued against the batch's one payment (PRD §4.2). */
  receiptNumber: string | null;
};

export type BatchPayment = {
  ref: string;
  at: string;
  amount: number;
  caseIds: string[];
};

export type BatchSigning = {
  method: BulkSignMethod;
  at: string;
  caseIds: string[];
  /** OTP rounds it took — one per five cases with Aadhaar, else one. */
  rounds: number;
};

export type Batch = {
  id: string;
  /** "BLK-2026-0003" — what the filer calls it. */
  number: string;
  source: BatchSource;
  /** The complainant, as the batch list names it. */
  client: string;
  createdAt: string;
  updatedAt: string;
  cases: BatchCase[];
  payments: BatchPayment[];
  signings: BatchSigning[];
  /** Set on a batch whose cases were clubbed into another; it is closed. */
  clubbedInto: string | null;
  /** Batch numbers this one was clubbed from. */
  clubbedFrom: string[];
};

/** Where one case stands in its batch. */
export type CaseStage = "held" | "ready" | "signed" | "filed";
