/**
 * Documents marked as evidence and waiting on this bench's signature — as data.
 *
 * The sibling of `sign-forms.ts` and `sign-orders.ts`, one row below them in the same
 * rail group. Those two queues sign a *paper the court drew up*: a form for a party to
 * swear, an order the bench passed. This one signs an **act of the court on a document
 * somebody else filed** — the endorsement that takes a vakalatnama, a return memo or an
 * affidavit already on the record and marks it an exhibit in the case. So the row is not
 * a document the court wrote; it is a marking, and the four facts that make up a marking
 * (which document, who filed it, the witness it was marked through, and the exhibit
 * number it takes) are the whole content of the screen.
 *
 * That is why this queue has no document text of its own, no facsimile and no template.
 * The reference's overlay shows the marking's particulars and nothing else, and there is
 * nothing else to show — the document itself lives on the case's own documents register.
 *
 * **There is no backend and nothing here is signed.** `SIGN_EVIDENCE_QUEUE` is demo data
 * shaped to exercise what the screen has to survive: one case carrying five separate
 * markings (the reference's own case, and the reason the row cannot be identified by the
 * cause alone), every document head in the vocabulary at least once, all three exhibit
 * series, a corporate party long enough to wrap the cause title, a party appearing in
 * person with no advocate to have filed for them, a double-digit exhibit number, and
 * enough rows to page at 10, 20 and 30. No row is read from a case, a court or a
 * register.
 *
 * **Signing is a screen action, not a court record.** Neither the bulk path nor the
 * single-marking path applies a signature, endorses an exhibit, writes to the A-Diary,
 * calls an e-sign provider or notifies anyone. `signEvidence` does exactly one thing:
 * drops rows from this demo queue, the way the signing queue for forms already does.
 * Editing a marking is the same — `applyEvidenceMarking` returns a new array and touches
 * nothing else. The confirmation copy describes what signing *means* so the control is
 * not misread; the build performs none of it.
 *
 * The vocabulary is the case register's, restated rather than imported for the reason
 * `order-draft.ts` restates the direction labels: the employee area stays self-contained
 * (`content.ts`), and the *words* are the register's so the two halves of the app cannot
 * disagree about what a "Cheque return memo" is called. Document heads are
 * `lib/cases/documents.ts` (`DOCUMENT_TYPES`); witness series are `lib/cases/parties.ts`
 * (`WitnessNumberPrefix` — PW for the complainant's witness, DW for the accused's, CW for
 * the court's own).
 *
 * **The exhibit series is this module's own convention.** `docs/product/` defines no
 * §138 exhibit-marking scheme, and the register carries only `P…` numbers
 * (`documents-dummy.json`). So the demo names one — P through a complainant witness, D
 * through the accused's, C through the court's — because the reference's Mark as evidence
 * dialog locks the series letter and something has to decide it. It claims nothing more
 * than that, and the letter follows the witness rather than being typed, which is why the
 * dialog cannot edit it.
 *
 * Numbers are `ST/…` and `CMP/…` both: a document can be marked at a hearing held before
 * cognizance as well as after it. These rows do not overlap today's cause list, the
 * scheduling queue, the register queue, the three review queues, or the signing queues
 * for forms and orders.
 */

import { CURRENT_STAFF } from "./content";
import { causeTitle } from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";

/**
 * Which filed document the marking is about — the reference's "Document" column.
 *
 * The register's document heads, minus the ones that cannot be an exhibit in this queue:
 * a witness deposition and a bail bond are signed by the rail's own rows for those
 * ("Sign witness deposition", "Sign bail bonds"), and the exhibit index is the list of
 * these markings rather than one of them.
 */
export type EvidenceDocumentId =
  | "legal-demand-notice"
  | "proof-of-dispatch"
  | "dishonoured-cheque"
  | "cheque-return-memo"
  | "vakalatnama"
  | "affidavit-223-bnss"
  | "affidavit-145-ni"
  | "account-records"
  | "proof-of-debt-or-liability"
  | "proof-of-deposit-of-cheque";

export const EVIDENCE_DOCUMENTS: { id: EvidenceDocumentId; label: string }[] = [
  /* The register's labels verbatim — sentence case per the DS Laws, with the statutory
     short forms left as they are written (BNSS, NI Act). The reference's Title Case
     ("Return Memo", "Legal Demand Notice") does not survive the Laws. */
  { id: "legal-demand-notice", label: "Legal demand notice" },
  { id: "proof-of-dispatch", label: "Proof of dispatch of legal demand notice" },
  { id: "dishonoured-cheque", label: "Dishonoured cheque" },
  { id: "cheque-return-memo", label: "Cheque return memo" },
  { id: "vakalatnama", label: "Vakalatnama" },
  { id: "affidavit-223-bnss", label: "Affidavit under section 223 BNSS" },
  {
    id: "affidavit-145-ni",
    label: "Affidavit under section 145 of the Negotiable Instruments Act",
  },
  { id: "account-records", label: "Account records" },
  { id: "proof-of-debt-or-liability", label: "Proof of debt or liability" },
  { id: "proof-of-deposit-of-cheque", label: "Proof of deposit of cheque" },
];

export function evidenceDocumentLabel(id: EvidenceDocumentId): string {
  return EVIDENCE_DOCUMENTS.find((entry) => entry.id === id)?.label ?? id;
}

/** Prosecution witness, defence witness, court witness — the register's own series. */
export type WitnessSeries = "PW" | "DW" | "CW";

/** The exhibit series each witness's exhibits are numbered in. See the module header. */
export type ExhibitSeries = "P" | "D" | "C";

export function exhibitSeries(series: WitnessSeries): ExhibitSeries {
  if (series === "DW") return "D";
  if (series === "CW") return "C";
  return "P";
}

/**
 * A witness examined in the case, as the marking names them.
 *
 * `number` is composed in the fixture rather than built from `series` and an index, the
 * way the register composes `CaseWitness.number`, so no screen assembles it from two
 * fields.
 */
export type EvidenceWitness = {
  id: string;
  /** "PW-1" — the number the record calls them by. */
  number: string;
  series: WitnessSeries;
  name: string;
};

/** "PW-1 (Tahera Mustanki)" — how the witness reads in a list of choices. */
export function witnessLabel(witness: EvidenceWitness): string {
  return `${witness.number} (${witness.name})`;
}

/**
 * One document marked as evidence, waiting for the signature that endorses it.
 *
 * The case's witnesses ride on the row rather than sitting in a lookup: the marking can
 * be changed to any witness examined in *that* case and no other, so the choices belong
 * to the row the dialog is editing.
 */
export type SignEvidence = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  document: EvidenceDocumentId;
  /** Who filed the document, as the register records it — an advocate, or the party. */
  uploadedBy: string;
  /** Every witness examined in this case. Never empty — a marking needs one. */
  witnesses: EvidenceWitness[];
  /** The witness the document was marked through. An id in `witnesses`. */
  markedThrough: string;
  /** The exhibit's serial within its series: 1 → P1, 12 → P12. */
  serial: number;
  /**
   * The bench's own business of the day, once it has been written over the court's draft
   * line. Absent means the draft still stands — see `businessOfTheDay`.
   */
  botd?: string;
};

/** The court whose exhibits these are. One bench, one signing queue. */
const COURT = CURRENT_STAFF.court;

/**
 * A case and its markings — the shape the queue is authored in.
 *
 * The witnesses are a fact about the case, not about each marking, so the fixture says
 * so once and the rows below flatten out of it. Five rows of one case sharing one
 * witness list is the reference's own data, and repeating that list five times is how it
 * drifts.
 */
type EvidenceCase = {
  caseNumber: string;
  parties: { complainant: string; accused: string };
  witnesses: EvidenceWitness[];
  markings: {
    /** Suffix of the row id; the case number supplies the rest. */
    ref: string;
    document: EvidenceDocumentId;
    uploadedBy: string;
    markedThrough: string;
    serial: number;
  }[];
};

/**
 * The markings this bench has not yet signed, case by case.
 *
 * Names follow the fixtures the rest of the court side uses: local parties and the same
 * bar practising in this court.
 */
const EVIDENCE_CASES: EvidenceCase[] = [
  {
    caseNumber: "ST/702/2026",
    parties: {
      complainant: "Mustanki Cooperative Co.",
      accused: "Rajesh Varma",
    },
    witnesses: [
      {
        id: "pw1",
        number: "PW-1",
        series: "PW",
        name: "Tahera Mustanki",
      },
      { id: "pw2", number: "PW-2", series: "PW", name: "Sunil Menon" },
      { id: "dw1", number: "DW-1", series: "DW", name: "Rajesh Varma" },
    ],
    /* The reference's own case: five documents marked in one matter, which is why the
       cause title cannot tell one row from another and the Document column has to. */
    markings: [
      {
        ref: "a",
        document: "vakalatnama",
        uploadedBy: "Adv. Meera John",
        markedThrough: "pw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "cheque-return-memo",
        uploadedBy: "Adv. Meera John",
        markedThrough: "pw2",
        serial: 2,
      },
      {
        ref: "c",
        document: "dishonoured-cheque",
        uploadedBy: "Adv. Meera John",
        markedThrough: "pw2",
        serial: 3,
      },
      {
        ref: "d",
        document: "legal-demand-notice",
        uploadedBy: "Adv. Meera John",
        markedThrough: "pw1",
        serial: 4,
      },
      {
        ref: "e",
        document: "proof-of-dispatch",
        uploadedBy: "Adv. Meera John",
        markedThrough: "pw1",
        serial: 5,
      },
    ],
  },
  {
    caseNumber: "ST/705/2026",
    parties: {
      complainant: "Thangasseri Marine Stores and Ship Chandling",
      accused: "Beena Sasidharan",
    },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Ashraf Kunju" },
      { id: "dw1", number: "DW-1", series: "DW", name: "Beena Sasidharan" },
    ],
    markings: [
      {
        ref: "a",
        document: "affidavit-223-bnss",
        uploadedBy: "Adv. Nisha Thomas",
        markedThrough: "pw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "proof-of-deposit-of-cheque",
        uploadedBy: "Adv. Nisha Thomas",
        markedThrough: "pw1",
        serial: 2,
      },
      {
        ref: "c",
        document: "account-records",
        uploadedBy: "Adv. Nisha Thomas",
        markedThrough: "pw1",
        serial: 3,
      },
      /* The accused's own exhibit, so it is numbered in the D series — the case where
         the series letter is not P and the dialog's locked prefix has to follow the
         witness rather than the case. */
      {
        ref: "d",
        document: "account-records",
        uploadedBy: "Adv. Saurabh Verma",
        markedThrough: "dw1",
        serial: 1,
      },
    ],
  },
  {
    caseNumber: "ST/709/2026",
    parties: { complainant: "Guruprasad Iyer", accused: "Kavitha Kaur" },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Guruprasad Iyer" },
      { id: "dw1", number: "DW-1", series: "DW", name: "Kavitha Kaur" },
    ],
    markings: [
      {
        ref: "a",
        document: "vakalatnama",
        uploadedBy: "Adv. Latha Krishnan",
        markedThrough: "pw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "legal-demand-notice",
        uploadedBy: "Adv. Latha Krishnan",
        markedThrough: "pw1",
        serial: 2,
      },
    ],
  },
  {
    caseNumber: "CMP/970/2026",
    parties: {
      complainant: "Saurabh Nandakumar",
      accused: "Paravur Rice Mills and General Trading Pvt Ltd",
    },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Saurabh Nandakumar" },
    ],
    markings: [
      {
        ref: "a",
        document: "dishonoured-cheque",
        uploadedBy: "Adv. Feroz Hameed",
        markedThrough: "pw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "cheque-return-memo",
        uploadedBy: "Adv. Feroz Hameed",
        markedThrough: "pw1",
        serial: 2,
      },
    ],
  },
  {
    caseNumber: "ST/712/2026",
    parties: { complainant: "Leela Kumari", accused: "Asramam Dairy Products" },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Leela Kumari" },
      { id: "pw2", number: "PW-2", series: "PW", name: "Rema Devi" },
    ],
    markings: [
      {
        ref: "a",
        document: "affidavit-145-ni",
        uploadedBy: "Adv. Suresh Menon",
        markedThrough: "pw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "proof-of-debt-or-liability",
        uploadedBy: "Adv. Suresh Menon",
        markedThrough: "pw2",
        serial: 2,
      },
    ],
  },
  {
    caseNumber: "ST/716/2026",
    parties: {
      complainant: "Lakeside Coir Exports",
      accused: "Devika Ramachandran",
    },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Haridasan" },
      /* Summoned by the court, so neither side filed the document and neither side's
         series numbers it. */
      { id: "cw1", number: "CW-1", series: "CW", name: "K. Sasidharan" },
    ],
    markings: [
      {
        ref: "a",
        document: "account-records",
        uploadedBy: COURT,
        markedThrough: "cw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "vakalatnama",
        uploadedBy: "Adv. Rekha Pillai",
        markedThrough: "pw1",
        serial: 1,
      },
    ],
  },
  {
    caseNumber: "ST/719/2026",
    parties: { complainant: "Bindu Gurusamy", accused: "Automation Kerala" },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Bindu Gurusamy" },
      { id: "dw1", number: "DW-1", series: "DW", name: "Aniket Soni" },
    ],
    markings: [
      {
        ref: "a",
        document: "legal-demand-notice",
        uploadedBy: "Adv. Anitha George",
        markedThrough: "pw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "proof-of-debt-or-liability",
        uploadedBy: "Adv. Anitha George",
        markedThrough: "pw1",
        serial: 2,
      },
    ],
  },
  {
    caseNumber: "CMP/974/2026",
    parties: { complainant: "Shiny Varghese", accused: "Thevally Boat Yard" },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Shiny Varghese" },
    ],
    /* No vakalat on record: the complainant appears in person, so the document was
       filed under their own name rather than an advocate's. */
    markings: [
      {
        ref: "a",
        document: "dishonoured-cheque",
        uploadedBy: "Shiny Varghese",
        markedThrough: "pw1",
        serial: 1,
      },
    ],
  },
  {
    caseNumber: "ST/723/2026",
    parties: { complainant: "Ajith Kumar", accused: "Punalur Paper Depot" },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Ajith Kumar" },
      { id: "dw1", number: "DW-1", series: "DW", name: "Yousaf" },
    ],
    markings: [
      {
        ref: "a",
        document: "cheque-return-memo",
        uploadedBy: "Adv. Saurabh Verma",
        markedThrough: "pw1",
        serial: 1,
      },
      {
        ref: "b",
        document: "account-records",
        uploadedBy: "Adv. Latha Krishnan",
        markedThrough: "dw1",
        serial: 1,
      },
    ],
  },
  {
    caseNumber: "ST/726/2026",
    parties: { complainant: "Fathima Beevi", accused: "Kadappakada Motors" },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Fathima Beevi" },
    ],
    markings: [
      {
        ref: "a",
        document: "affidavit-223-bnss",
        uploadedBy: "Adv. Feroz Hameed",
        markedThrough: "pw1",
        serial: 1,
      },
    ],
  },
  {
    caseNumber: "CMP/981/2026",
    parties: { complainant: "Geetha Nair", accused: "Chavara Minerals" },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Geetha Nair" },
    ],
    markings: [
      {
        ref: "a",
        document: "vakalatnama",
        uploadedBy: "Adv. Nisha Thomas",
        markedThrough: "pw1",
        serial: 1,
      },
    ],
  },
  {
    caseNumber: "ST/730/2026",
    parties: {
      complainant: "Soumya Rajan",
      accused: "Harbour Line Logistics Pvt Ltd",
    },
    witnesses: [
      { id: "pw1", number: "PW-1", series: "PW", name: "Soumya Rajan" },
    ],
    /* Twelfth exhibit in the series — the number the field has to hold at two digits. */
    markings: [
      {
        ref: "a",
        document: "proof-of-dispatch",
        uploadedBy: "Adv. Rekha Pillai",
        markedThrough: "pw1",
        serial: 12,
      },
    ],
  },
];

/** The queue the screen opens on: every marking, in case order. */
export const SIGN_EVIDENCE_QUEUE: SignEvidence[] = EVIDENCE_CASES.flatMap(
  (record) =>
    record.markings.map((marking) => ({
      id: `se-${record.caseNumber.replace(/\//g, "-")}-${marking.ref}`,
      caseNumber: record.caseNumber,
      parties: record.parties,
      witnesses: record.witnesses,
      document: marking.document,
      uploadedBy: marking.uploadedBy,
      markedThrough: marking.markedThrough,
      serial: marking.serial,
    })),
);

/**
 * How many markings are waiting for signature — the number the rail carries beside
 * "Sign evidence".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `SIGN_FORM_QUEUE_COUNT` is, so the rail and the screen cannot disagree about the size
 * of the queue.
 */
export const SIGN_EVIDENCE_QUEUE_COUNT = SIGN_EVIDENCE_QUEUE.length;

/** The witness this document was marked through. */
export function markedThroughWitness(row: SignEvidence): EvidenceWitness {
  return (
    row.witnesses.find((witness) => witness.id === row.markedThrough) ??
    row.witnesses[0]
  );
}

/** "P1" — the exhibit number, series letter and serial together. */
export function evidenceNumber(row: SignEvidence): string {
  return `${exhibitSeries(markedThroughWitness(row).series)}${row.serial}`;
}

/**
 * The line the court offers for the day's business, composed from the marking.
 *
 * The case register's rule is that business of the day is *authored* and never
 * synthesised (`lib/cases/orders.ts`), and this does not break it: what is composed here
 * is the draft the reference prefills the field with, and the bench writes over it before
 * signing. `businessOfTheDay` is what the record would carry — the bench's own line where
 * there is one, the draft where there is not.
 */
export function draftBusinessOfTheDay(row: SignEvidence): string {
  return `Document marked as evidence exhibit number ${evidenceNumber(row)}`;
}

export function businessOfTheDay(row: SignEvidence): string {
  return row.botd ?? draftBusinessOfTheDay(row);
}

/** What the Mark as evidence dialog edits. */
export type EvidenceMarking = {
  markedThrough: string;
  serial: number;
};

/**
 * Change which witness a document was marked through, and the number it takes.
 *
 * Returns a new array; the caller holds the queue. A marking whose business of the day is
 * still the court's draft keeps following the exhibit number — the draft names it, so a
 * marking renumbered from P2 to P3 would otherwise carry a line that reads P2. A line the
 * bench has actually written is theirs and is left alone.
 */
export function applyEvidenceMarking(
  rows: SignEvidence[],
  id: string,
  marking: EvidenceMarking,
): SignEvidence[] {
  return rows.map((row) =>
    row.id === id ? { ...row, ...marking } : row,
  );
}

/**
 * Write the bench's own business of the day onto one marking.
 *
 * Stored as typed, not trimmed — this runs on every keystroke, and a function that
 * strips the space you just pressed is a field you cannot type a second word into. The
 * comparison that decides whether the bench has actually departed from the court's draft
 * is the only place trimming belongs.
 */
export function applyBusinessOfTheDay(
  rows: SignEvidence[],
  id: string,
  botd: string,
): SignEvidence[] {
  return rows.map((row) =>
    row.id === id
      ? {
          ...row,
          botd:
            botd.trim() === draftBusinessOfTheDay(row) ? undefined : botd,
        }
      : row,
  );
}

/**
 * Sign — which here means the rows leave the demo queue, and nothing else happens.
 *
 * No signature is applied, no exhibit is endorsed, nothing is written to the A-Diary and
 * no provider is called. See the module header.
 */
export function signEvidence(
  rows: SignEvidence[],
  ids: ReadonlySet<string>,
): SignEvidence[] {
  return rows.filter((row) => !ids.has(row.id));
}

/**
 * Exhibit numbers already taken in this marking's case and series.
 *
 * An exhibit number identifies one exhibit, so two markings in the same case cannot both
 * be P2 — the Document column would be the only thing telling them apart, and the
 * endorsement would name the same exhibit twice. The dialog checks a proposed number
 * against this set.
 */
export function takenSerials(
  rows: SignEvidence[],
  row: SignEvidence,
  series: ExhibitSeries,
): Set<number> {
  return new Set(
    rows
      .filter(
        (other) =>
          other.id !== row.id &&
          other.caseNumber === row.caseNumber &&
          exhibitSeries(markedThroughWitness(other).series) === series,
      )
      .map((other) => other.serial),
  );
}

/** The largest exhibit serial the field accepts. A court numbers exhibits, not files. */
export const MAX_EVIDENCE_SERIAL = 999;

/**
 * A typed exhibit serial, or `null` when it is not one.
 *
 * Whole numbers from 1 only: an exhibit is P1, never P0, P1.5 or P-3.
 */
export function parseEvidenceSerial(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const serial = Number(trimmed);
  if (serial < 1 || serial > MAX_EVIDENCE_SERIAL) return null;
  return serial;
}

/**
 * Free text over the cause title, the case number, the document and the exhibit number.
 *
 * The reference labelled the box "Case Name or Number" and searches those two; the
 * document and the exhibit number are on screen in their own columns, so a bench that
 * types "vakalatnama" or "P4" is naming something it can see and gets it.
 */
export type SignEvidenceFilters = { query: string };

export const EMPTY_SIGN_EVIDENCE_FILTERS: SignEvidenceFilters = { query: "" };

export function filterSignEvidence(
  rows: SignEvidence[],
  filters: SignEvidenceFilters,
): SignEvidence[] {
  const query = caseSearchKey(filters.query);
  if (!query) return rows;
  return rows.filter((row) => {
    const haystack = [
      causeTitle(row),
      row.caseNumber,
      evidenceDocumentLabel(row.document),
      evidenceNumber(row),
      row.uploadedBy,
      witnessLabel(markedThroughWitness(row)),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
