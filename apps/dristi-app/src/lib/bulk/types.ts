/**
 * A bulk batch: the filer's container for cases that came in together, by one API push or
 * one Excel upload. It exists only on the filer's side. The court never sees a batch
 * (Bulk Filing PRD §5); each case inside is an ordinary `FilingDraft`, so a case filed
 * from here is indistinguishable from one filed on its own (PRD §1).
 *
 * Batches never mix: a push or an upload always makes a new one. A filer may club batches
 * deliberately, which moves the cases into a new batch and closes the originals.
 */

import type { ApiBatchRequest } from "./contract";
import type {
  FilingDraft,
  SignInstrument,
  StoredFileRef,
} from "@/lib/filing/types";

/**
 * The batch's Common details as they were filled (BLK-05): its complainants, advocates,
 * their documents and the ADR answer. Kept on the batch so the step reopens on the same
 * pages it was filled on, read-only, rather than as a summary (owner, 2026-11-11).
 */
export type BatchCommon = {
  complainants: FilingDraft["complainants"];
  advocates: FilingDraft["advocates"];
  documents: FilingDraft["intake"]["parties"];
  adr: FilingDraft["adr"]["adr"];
};

export type BatchSourceKind = "api" | "excel" | "documents" | "clubbed";

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
  /**
   * The key the case came in under: the sender's reference for an API push, "R12" for
   * Excel row 12. Never shown: the filer knows a case by its draft number (`draftNumber`,
   * BLK-04b), and the filer's own reference is withdrawn (BLK-07).
   */
  reference: string;
  /** The case's row in the Excel file, which its draft number carries (B7-R12). */
  row?: number;
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
  /** Text read from each stored document, by file id; `null` when none could be read. For the AI review. */
  docText?: Record<string, string | null>;
  /** Notices (by index) whose delivery the sender did not know yet, such as in transit. */
  unknownService: number[];
  /**
   * Required yes/no answers the sender did not give, by draft path (`jurisdiction.deposited`,
   * `notices.0.replied`). The draft holds a default there; the case is held until each is
   * answered.
   */
  unstated?: string[];
  /** How each case was signed in bulk, once it is. */
  signedWith: BulkSignMethod | null;
  /** The per-case receipt issued against the batch's one payment (PRD §4.2). */
  receiptNumber: string | null;
  /** The Word file or PDF the case was read from, when it came in as a case document. */
  original?: StoredFileRef;
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
  /** "B3": B and a count of the filer's own batches (BLK-04a). */
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
  /**
   * When the filer first opened the batch. `null` on an API push nobody has opened yet:
   * the bell flags it until someone does. Absent on batches stored before this existed.
   */
  openedAt?: string | null;
  /**
   * Common details as set when the batch was created. Absent on an API push and on batches
   * stored before this existed: those read them from the first case, which got them first.
   */
  common?: BatchCommon;
  /**
   * The complainant's oath for the batch (owner, 2026-11-17): one general affirmation, by
   * whoever signs for the complainant, recorded on camera through a link, as in individual
   * filing (`OTH`). Paying waits for it.
   */
  oath?: BatchOath;
  /** The upload setup this batch was created from, so a late save of it never makes another. */
  setupId?: string;
  /** Set until the batch is created (`NotCreated`); absent on a created batch. */
  notCreated?: NotCreated;
};

/**
 * An Excel upload's screens as the filer left them, to come back to (BLK-10m): the setup's
 * Common details and, once a file is read, the file and every choice made on it.
 */
export type UploadSnapshot = {
  format: "template" | "own" | null;
  template: boolean;
  fileName: string;
  book: { cases: { name: string; headers: string[]; rows: string[][]; discarded: number; rowNumbers?: number[] } };
  map: Record<string, number | { every: string } | null>;
  values: Record<string, Record<string, string>>;
  counts: Record<string, number>;
  later: string[];
  factsChoice: { id: string | undefined; html: string } | null;
  everyCase: boolean | null;
};

/**
 * A batch that is not created yet, listed so the filer can come back to it or delete it.
 *
 *  · `excel`: an upload left before Create (BLK-10m). `path` is where it was left, under
 *    the setup (`advocate`, `file?step=map`), and `where` says it in words.
 *  · `api`: a push from a client's system. Its cases are built (their documents fetched)
 *    on arrival, but it starts at Facts of the case and becomes a batch on Create (§3):
 *    `request` is what was sent, for the Facts preview.
 */
export type NotCreated =
  | { kind: "excel"; setupId: string; path: string; where: string; draft: FilingDraft; upload?: UploadSnapshot }
  | { kind: "api"; request: ApiBatchRequest };

export type BatchOath = {
  /** When the link was last sent to the complainant's representative. */
  sentAt?: string;
  /** When the oath was recorded. */
  takenAt?: string;
  /** The recording; `null` for the sandbox shortcut that marks it taken. */
  video?: StoredFileRef | null;
  /** Who took it, as their link named them. */
  by?: string;
};

/** Where one case stands in its batch. */
export type CaseStage = "held" | "ready" | "signed" | "filed";
