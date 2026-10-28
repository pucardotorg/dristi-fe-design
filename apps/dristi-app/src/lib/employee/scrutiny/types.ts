/**
 * Domain model for the court-registry scrutiny workbench (`/employee/scrutiny`).
 *
 * The shapes are named here so the fixtures are typed data and the screens stay pure
 * rendering. Nothing in this file knows about React, the design system, or a route —
 * keep it that way, so the same model can sit behind a real API later without the
 * screens noticing.
 */

import type { CaseDocumentKind } from "@/lib/employee/case-review";

/* ── the case bundle ─────────────────────────────────────────────────────── */

/**
 * Where a bundle page comes from.
 *
 * - `generated` / `scan` render legible React facsimiles (`generated-pages.tsx`) — these
 *   exist only for the one hand-authored case, whose bundle is worth reading in full.
 * - `image` is an uploaded scan under `/public`.
 * - `facsimile` is the illegible SVG page the rest of the court side already draws
 *   (`page-facsimile.tsx`): the shape of a document, never its words. Every *derived*
 *   filing's bundle is drawn this way, because a legible page for a case we are only
 *   standing in for would be fabricating a court record — the one thing a demo must not
 *   do (`document-scroller.tsx`).
 * - `video` is an oath recording (`SCR-14`), played in place. It is not a page of the
 *   complaint PDF — a video cannot be printed (e-filing handover §18.2) — so it sits after
 *   the pages, and only where the state asks for an oath.
 */
export type BundleDocKind = "generated" | "scan" | "image" | "facsimile" | "video";

export interface BundleDoc {
  id: string;
  /** As printed on the page label and in the index rail. */
  name: string;
  kind: BundleDocKind;
  /** Only for `kind: "image"` — a URL under `/public`, never inline base64. */
  src?: string;
  /** Only for `kind: "facsimile"` — which illegible page shape to draw. */
  sheet?: CaseDocumentKind;
  /** Only for `kind: "video"` — the stored recording, when this browser holds it. */
  fileId?: string;
  /** Only for `kind: "video"` — seconds, as recorded. */
  durationSeconds?: number | null;
  /** 1-based position in the complaint-PDF reading order. */
  no: number;
  /** Uploaded scans that are illegible enough to worry about. */
  poorScan?: boolean;
}

/** `[left, top, width, height]`, each a percentage of the page box. */
export type Rect = readonly [number, number, number, number];

/* ── filed information ───────────────────────────────────────────────────── */

export interface Field {
  id: string;
  label: string;
  /** What the advocate filed. Empty string for rows that are only a document. */
  value: string;
  /** Long prose (prayer, condonation reason) reads as body, not as a datum. */
  long?: boolean;
  /**
   * A cheque number, an IFSC, a bar registration — read character by character and
   * transcribed, so the value is set as an identifier. Amounts and dates are not.
   * (`ident`, not `id`: `id` above is this row's own key.)
   */
  ident?: boolean;

  /** Bundle doc this value was read from, plus the region it was read at. */
  doc?: string;
  region?: Rect;
  /** A thumbnail of the source doc belongs on the row (ID proof). */
  thumb?: string;
  /** This row IS a document in the Evidence › Documents group. */
  docrow?: string;
  /** This row is a recording (an oath): selecting it plays this bundle doc (`SCR-14`). */
  video?: string;
  /** A standing fact about the row, said under its value — not a machine reading. */
  note?: string;

  /** AI read a different value here than the one filed. */
  docread?: string;
  /** ...and the filer dismissed that warning at filing time. */
  skipped?: boolean;
  /** AI could not read the value at all. */
  ocrfail?: boolean;
  failnote?: string;
  /** No document exists to verify this against — said plainly, not hidden. */
  nodoc?: string;
  /**
   * AI searched the bundle and found no document carrying this value — "Not in any
   * document". Unlike `nodoc`, saying so takes reading the documents, so it needs AI on.
   */
  unfound?: string;
  /** Standing caution about the upload behind this row. */
  scannote?: string;
  /** Where in the document the value sits, when that is not obvious. */
  srcnote?: string;
}

/** A field, flattened with the group and section it belongs to. */
export interface FlatField extends Field {
  group: string;
  section: string;
  sectionId: string;
}

export interface FieldGroupDef {
  id: string;
  icon: GroupIcon;
  title: string;
  fields: Field[];
}

export interface SectionDef {
  id: string;
  num: string;
  title: string;
  groups: FieldGroupDef[];
}

export type GroupIcon =
  | "user"
  | "userSearch"
  | "scale"
  | "cheque"
  | "memo"
  | "mail"
  | "pin"
  | "doc"
  | "pen"
  | "wallet";

/* ── what the officer raises ─────────────────────────────────────────────── */

/**
 * One raised item against one field: it says what is wrong, and the advocate fixes it.
 * The officer does not propose a value — the advocate enters the correct one.
 *
 * An item is a permission grant, and it grants only what it names: a field item unlocks
 * that value, a document-row item unlocks re-upload of that document. The two pointers
 * below are what let one defect be raised as both without either item pretending to be
 * the other.
 */
export interface Flag {
  /** Structured reason, only for document rows (Blurry / Wrong document / …). */
  reason: string | null;
  comment: string | null;
  /** Field item → the document row raised with it. */
  linkedTo?: string | null;
  /** Document item → the field it was raised from. */
  linkedFrom?: string | null;
}

/** The document-row item being written alongside a field item, before either is saved. */
export interface LinkedDoc {
  /** Field id of the document row in Evidence › Documents. */
  rowId: string;
  /** Bundle doc id that row represents. */
  docId: string;
  reason: string | null;
  note: string;
}

/** The in-progress state of the composer, before it is saved as a `Flag`. */
export interface Draft {
  /** Contents of the note box. */
  text: string;
  reason: string | null;
  /** The linked document item this save will write alongside the field item. */
  linked: LinkedDoc | null;
}

export type FlagMap = Record<string, Flag>;

/* ── the queue ───────────────────────────────────────────────────────────── */

/** Who currently holds the ball. This is what the queue tabs segment by. */
export type Ball = "registry" | "advocate" | "closed";

export interface Filing {
  no: string;
  parties: string;
  type: string;
  stage: string;
  ball: Ball;
  reason: string;
  advocate: string;
  /** Officer holding it, or "—" when unclaimed. */
  who: string;
  /** Days the filing has been waiting on whoever holds it. */
  days: number;
  /** Claimed by the signed-in officer. */
  self?: boolean;
}

export type QueueOwner = "anyone" | "me" | "unclaimed";

/* ── case history ────────────────────────────────────────────────────────── */

/** One item that travelled in a send-back, and what became of it. */
export interface HistoryItem {
  /** Field id, so clicking navigates back into the work. */
  ref: string;
  what: string;
  was: string;
  status: string;
  /** Still unresolved after the round trip. */
  open?: boolean;
}

export interface HistoryEvent {
  status: "past" | "current" | "future";
  title: string;
  meta: string;
  /**
   * The part of the line that only AI could have produced — "Filer skipped an AI
   * warning". Shown after `meta` with AI on; without AI the event never had it.
   */
  aiNote?: string;
  items?: HistoryItem[];
}

/* ── the round that came back ────────────────────────────────────────────── */

/**
 * How the advocate answered one returned item — the advocate side's `Resolution.how`
 * (`lib/tasks/types.ts`), so the two ends of the round trip speak one vocabulary.
 *
 * `kept` is the advocate leaving the filed value as it was. No reason is asked for on
 * that side, so none is shown here: the card says so rather than calling it "contested".
 */
export type ReturnAnswer = "edited" | "kept" | "replaced";

/** One item the officer sent back, and what came back for it. */
export interface ReturnedItem {
  /** The row it was raised on — a value row, or a document row in Evidence › Documents. */
  fieldId: string;
  /** The officer's note, as sent. The whole instruction. */
  note: string;
  /** The value (or file) as scrutiny saw it when it went back. Now is the row's own value. */
  was: string;
  answer: ReturnAnswer;
  /** "9 Jun 2026" — when the advocate answered it. */
  answered: string;
}

/**
 * The last send-back and its answers — what a re-scrutiny is for.
 *
 * Only these items can differ from what the officer last saw: the advocate's correction
 * screen locks every field that was not flagged (`correction-screen.tsx`, D3). So this
 * list is the whole of "what changed", not a sample of it.
 */
export interface ReturnRound {
  /** The round now being scrutinised (2 for the first resubmission). */
  round: number;
  sentBack: string;
  sentBackBy: string;
  resubmitted: string;
  resubmittedBy: string;
  items: ReturnedItem[];
}

/* ── one case, assembled ─────────────────────────────────────────────────── */

/** The party names and provenance line the case bar prints. */
export interface CaseParty {
  complainant: string;
  accused: string;
  /** "Submitted 4 Jul 2026" — the provenance line under the title. */
  submitted: string;
  advocate: string;
}

/**
 * Everything one filing's workbench reads, in one object.
 *
 * The workbench used to import each of these from a module-level constant, which is why
 * only the single hand-authored case could open. Assembled per filing instead — the one
 * authored case returns its rich, hand-built content; every other filing returns content
 * derived from its queue row (`case.ts`) — the workbench is handed this and renders the
 * same regardless of which it got. Threaded through the tree by `ScrutinyCaseProvider`
 * rather than prop-drilled, since nine components below read from it.
 */
export interface ScrutinyCase {
  filing: Filing;
  party: CaseParty;
  sections: SectionDef[];
  allFields: FlatField[];
  fieldById: Record<string, FlatField>;
  bundle: BundleDoc[];
  docById: Record<string, BundleDoc>;
  /** Bundle doc id → the Evidence › Documents row that represents it. */
  docRow: Record<string, string>;
  /** The officer's standing checklist — cheque-shaped or civil, per the matter. */
  checks: string[];
  history: HistoryEvent[];
  historySummary: string;
  historyRound: number;
  /** The send-back this filing came back from, or `null` on a first scrutiny. */
  returned: ReturnRound | null;
}

/**
 * The two lookups the pure state transitions need to resolve an id.
 *
 * Passed in rather than imported so `use-scrutiny-state.ts` and `field.ts` stay pure
 * functions of one case's data — the workbench builds this once from its `ScrutinyCase`,
 * and the unit tests pass the authored case's own maps.
 */
export interface ScrutinyLookups {
  fieldById: Record<string, FlatField>;
  docRow: Record<string, string>;
}

