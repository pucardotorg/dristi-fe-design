/**
 * Copy applications waiting on this bench's approval — the seventh court-side queue, as
 * data.
 *
 * A copy application is a party asking the court for a certified copy of something on
 * the record: the judgement, an order, a witness's deposition, a marked exhibit, or the
 * complaint itself. The office prepares the copy; the bench first has to allow the
 * application. This module is that queue.
 *
 * It is the sibling of `sign-forms.ts`, `sign-orders.ts` and `rescheduling-request.ts`,
 * and it shares the court-side vocabulary — counsel, sides, the cause title, the page
 * sizes, the column date format — rather than restating it. Only the citizen side is off
 * limits (see `content.ts`).
 *
 * **`docs/product/` does not define copy applications for §138.** The only mentions are
 * passing ones in `docs/design/research/pending-tasks-ux.md` and
 * `docs/design/proposals/pending-tasks.md`. So everything below — the vocabulary, the
 * wording of the application, the folio counts, the amounts tendered — is demo text
 * modelled so the preview has something real-shaped to render. **No rule, form number or
 * fee schedule is quoted or implied**, and none should be read into the figures: a copy
 * application in a real court is priced by a schedule this build has never seen.
 *
 * **There is no backend.** `COPY_APPLICATION_QUEUE` is demo data shaped to exercise what
 * the screen has to survive: all five kinds of record, a corporate petitioner long enough
 * to wrap its column, a record description long enough to wrap three lines, three
 * applicants with no counsel on record, applications raised across ten months so the list
 * pages at 10, 20 and 30, and application serials that reset with the year. No row is
 * read from a case, a court or a copying section.
 *
 * **Accept and Reject perform no judicial act.** Neither allows nor refuses anything,
 * neither issues a copy, assesses a fee, notifies the applicant or writes to a record.
 * Both do exactly one thing: drop the row from this demo queue, the way Approve and
 * Reject already do on the rescheduling queue and the way signing does on the two signing
 * queues. Nothing persists past a reload.
 *
 * Numbers follow the stage the record belongs to: a judgement, a deposition and a marked
 * exhibit only exist once the case is on file, so those rows are numbered `ST/…`; the
 * complaint and an early order can be asked for before that, so those rows are both.
 * These matters do not overlap today's cause list, the scheduling queue, the register
 * queue, the rescheduling queue, the delay-condonation queue, the Others queue or either
 * signing queue.
 */

import { CURRENT_STAFF } from "./content";
import {
  applicationFiler,
  causeTitle,
  formatListingDate,
  parseIsoDay,
  partySideLabel,
  type CounselSide,
  type CourtCounsel,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/**
 * Which record on the file the copy is asked for.
 *
 * Five, because a §138 file has five things a party comes back for. The list is the
 * screen's own vocabulary rather than a backend enum — nothing here is read from a
 * server — and each id selects a genuinely different application below, not one string
 * with the names swapped.
 */
export type CopyRecordKind =
  | "judgement"
  | "order"
  | "deposition"
  | "exhibit"
  | "complaint";

export const COPY_RECORD_KINDS: { id: CopyRecordKind; label: string }[] = [
  /* Sentence case, per the DS Laws — the reference's Title Case does not survive them. */
  { id: "judgement", label: "Judgement" },
  { id: "order", label: "Order" },
  { id: "deposition", label: "Deposition" },
  { id: "exhibit", label: "Exhibit" },
  { id: "complaint", label: "Complaint" },
];

export function copyRecordKindLabel(kind: CopyRecordKind): string {
  return COPY_RECORD_KINDS.find((entry) => entry.id === kind)?.label ?? kind;
}

/**
 * Why the copy is wanted.
 *
 * A copy application says what it is for, because the answer changes how quickly the
 * office has to produce it. These three cover what a party asks for after a §138 case
 * has been decided or while it is running; nothing turns on the choice in this build
 * beyond the sentence it writes into the application.
 */
export type CopyPurpose = "appeal" | "revision" | "own-record";

export const COPY_PURPOSES: { id: CopyPurpose; label: string }[] = [
  { id: "appeal", label: "To prefer an appeal" },
  { id: "revision", label: "To move in revision" },
  { id: "own-record", label: "For the applicant's own record" },
];

export function copyPurposeLabel(purpose: CopyPurpose): string {
  return COPY_PURPOSES.find((entry) => entry.id === purpose)?.label ?? purpose;
}

/** Ordinary or urgent — the side the application is filed on. */
export type CopyUrgency = "ordinary" | "urgent";

export function copyUrgencyLabel(urgency: CopyUrgency): string {
  return urgency === "urgent" ? "Urgent" : "Ordinary";
}

/** The record the copy is asked of, as the application recites it. */
export type CopyRecord = {
  kind: CopyRecordKind;
  /**
   * What is asked for, in the applicant's own words — the row's "Copy sought" cell and
   * the phrase the application's prayer repeats. Written long where a real one would be
   * long; the column wraps rather than truncating.
   */
  description: string;
  /** ISO day the record itself bears. Always on or before `raisedOn`. */
  dated: string;
};

export type CopyApplication = {
  id: string;
  /** `CA/<serial>/<year>` — the serial resets with the year, so 2025 rows run high. */
  applicationNumber: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /** Counsel on record for the cause. A side may have none — no vakalat yet. */
  counsel: CourtCounsel[];
  /**
   * The party asking for the copy — the reference's Petitioner column.
   *
   * Either side of the cause may apply, so this is not the same as the complainant:
   * `name` is whichever party is asking, and `capacity` is how the application's opening
   * sentence names them, which a company cannot derive from its own name.
   */
  applicant: { name: string; side: CounselSide; capacity: string };
  /** ISO day the application was raised at the counter. */
  raisedOn: string;
  record: CopyRecord;
  /** How many certified copies are asked for. */
  copies: number;
  urgency: CopyUrgency;
  purpose: CopyPurpose;
  /** The applicant's own estimate of the length of the record. A demo figure. */
  folios: number;
  /** Already written the way the counter would receipt it. A demo figure — see above. */
  feeTendered: string;
};

/** The court whose queue this is. One bench, one copying counter. */
const COURT = CURRENT_STAFF.court;

/** Where the application is presented. The court's own seat — not a per-row fact. */
const PLACE = "Sample District";

/**
 * The copy applications this bench has not yet dealt with.
 *
 * Ordered newest first — the order the reference showed, and the order a counter queue is
 * worked. Names follow the fixtures the rest of the court side uses: local parties and
 * the same bar practising in this court.
 */
export const COPY_APPLICATION_QUEUE: CopyApplication[] = [
  {
    id: "ca-318",
    applicationNumber: "CA/318/2026",
    caseNumber: "ST/1204/2026",
    parties: {
      complainant: "Sreedevi Anandan",
      accused: "Ittiva Rubberised Coir Products",
    },
    counsel: [
      { name: "Adv. Meera John", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    applicant: {
      name: "Ittiva Rubberised Coir Products",
      side: "accused",
      capacity: "Accused, through its managing partner",
    },
    raisedOn: "2026-09-03",
    record: {
      kind: "judgement",
      description: "Judgement of conviction and the sentence passed with it",
      dated: "2026-08-27",
    },
    copies: 2,
    urgency: "urgent",
    purpose: "appeal",
    folios: 24,
    feeTendered: "₹72",
  },
  {
    id: "ca-316",
    applicationNumber: "CA/316/2026",
    caseNumber: "ST/1198/2026",
    parties: {
      complainant: "Munroe Island Backwater Tours",
      accused: "Vipin Raghavan",
    },
    counsel: [{ name: "Adv. Nisha Thomas", side: "complainant" }],
    applicant: {
      name: "Munroe Island Backwater Tours",
      side: "complainant",
      capacity: "Complainant, through its authorised signatory",
    },
    raisedOn: "2026-09-01",
    record: {
      kind: "exhibit",
      description: "Exhibit P3, the cheque return memo issued by the drawee bank",
      dated: "2026-07-16",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 4,
    feeTendered: "₹12",
  },
  {
    id: "ca-311",
    applicationNumber: "CA/311/2026",
    caseNumber: "ST/1191/2026",
    parties: {
      complainant: "Aiswarya Nandakumar",
      accused: "Chandanathope Industrial Estate Suppliers",
    },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    applicant: {
      name: "Aiswarya Nandakumar",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-08-27",
    record: {
      kind: "deposition",
      description:
        "Deposition of PW-2, the branch manager who proved the return memo",
      dated: "2026-08-13",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 9,
    feeTendered: "₹27",
  },
  {
    /* The worst case the column widths have to survive: the longest petitioner in the
       queue beside the longest record description. Both wrap; neither truncates. */
    id: "ca-307",
    applicationNumber: "CA/307/2026",
    caseNumber: "ST/1186/2026",
    parties: {
      complainant: "Harbour Bunkering and Marine Fuels Private Limited",
      accused: "Adarsh Vijayan",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    applicant: {
      name: "Harbour Bunkering and Marine Fuels Private Limited",
      side: "complainant",
      capacity: "Complainant, through its authorised representative",
    },
    raisedOn: "2026-08-24",
    record: {
      kind: "order",
      description:
        "Order on the application for recall of PW-1 for further cross-examination, together with the endorsement made on the docket the same day",
      dated: "2026-08-19",
    },
    copies: 2,
    urgency: "urgent",
    purpose: "revision",
    folios: 11,
    feeTendered: "₹33",
  },
  {
    /* Nobody on record for either side — the complainant applies in person. */
    id: "ca-303",
    applicationNumber: "CA/303/2026",
    caseNumber: "CMP/3142/2026",
    parties: {
      complainant: "Muhammed Ashraf",
      accused: "Thrikkaruva Poultry and Hatchery",
    },
    counsel: [],
    applicant: {
      name: "Muhammed Ashraf",
      side: "complainant",
      capacity: "Complainant, in person",
    },
    raisedOn: "2026-08-20",
    record: {
      kind: "complaint",
      description: "Complaint together with the list of documents filed with it",
      dated: "2026-06-11",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 14,
    feeTendered: "₹42",
  },
  {
    id: "ca-298",
    applicationNumber: "CA/298/2026",
    caseNumber: "ST/1179/2026",
    parties: {
      complainant: "Vadakkumbhagom Timber and Plywood Traders",
      accused: "Sheeba Antony",
    },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Priya Raghavan", side: "accused" },
    ],
    applicant: {
      name: "Sheeba Antony",
      side: "accused",
      capacity: "Accused",
    },
    raisedOn: "2026-08-14",
    record: {
      kind: "complaint",
      description: "Complaint and the statutory notice annexed to it",
      dated: "2026-02-04",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 18,
    feeTendered: "₹54",
  },
  {
    id: "ca-292",
    applicationNumber: "CA/292/2026",
    caseNumber: "ST/1173/2026",
    parties: {
      complainant: "Rajmohan Kesavan",
      accused: "Panayam Cold Chain Solutions",
    },
    counsel: [{ name: "Adv. Haridas Nair", side: "complainant" }],
    applicant: {
      name: "Rajmohan Kesavan",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-08-07",
    record: {
      kind: "judgement",
      description: "Judgement of acquittal",
      dated: "2026-07-31",
    },
    copies: 3,
    urgency: "urgent",
    purpose: "appeal",
    folios: 22,
    feeTendered: "₹66",
  },
  {
    id: "ca-287",
    applicationNumber: "CA/287/2026",
    caseNumber: "ST/1168/2026",
    parties: {
      complainant: "Nirmala Ponnappan",
      accused: "Kilikollur Printing and Packaging House",
    },
    counsel: [
      { name: "Adv. Elizabeth Kurian", side: "complainant" },
      { name: "Adv. Mohan Das", side: "accused" },
    ],
    applicant: {
      name: "Kilikollur Printing and Packaging House",
      side: "accused",
      capacity: "Accused, through its proprietor",
    },
    raisedOn: "2026-08-03",
    record: {
      kind: "deposition",
      description:
        "Deposition of the complainant recorded as PW-1 on the day of chief examination",
      dated: "2026-07-24",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 12,
    feeTendered: "₹36",
  },
  {
    id: "ca-281",
    applicationNumber: "CA/281/2026",
    caseNumber: "ST/1162/2026",
    parties: {
      complainant: "Fousiya Nazeer",
      accused: "Perumon Bridge Steel Traders",
    },
    counsel: [
      { name: "Adv. Fathima Nazar", side: "complainant" },
      { name: "Adv. Anwar Sadath", side: "accused" },
    ],
    applicant: {
      name: "Fousiya Nazeer",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-07-29",
    record: {
      kind: "order",
      description: "Order dispensing with the personal appearance of the accused",
      dated: "2026-07-21",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 3,
    feeTendered: "₹9",
  },
  {
    /* Counsel on record for the complainant only, and it is the accused applying — so
       this application is filed without counsel. */
    id: "ca-276",
    applicationNumber: "CA/276/2026",
    caseNumber: "ST/1157/2026",
    parties: {
      complainant: "Tony Vadakkan",
      accused: "Nedumpaikulam Coir Cooperative",
    },
    counsel: [{ name: "Adv. Arun Prakash", side: "complainant" }],
    applicant: {
      name: "Nedumpaikulam Coir Cooperative",
      side: "accused",
      capacity: "Accused, through its secretary",
    },
    raisedOn: "2026-07-23",
    record: {
      kind: "exhibit",
      description:
        "Exhibit P1, the dishonoured cheque, and Exhibit P2, the memo of return",
      dated: "2026-05-29",
    },
    copies: 2,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 6,
    feeTendered: "₹18",
  },
  {
    id: "ca-270",
    applicationNumber: "CA/270/2026",
    caseNumber: "ST/1149/2026",
    parties: {
      complainant: "Shabana Sulaiman",
      accused: "Chathannoor Agro Machinery",
    },
    counsel: [
      { name: "Adv. Deepa Chandran", side: "complainant" },
      { name: "Adv. Rajan Pillai", side: "accused" },
    ],
    applicant: {
      name: "Shabana Sulaiman",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-07-16",
    record: {
      kind: "judgement",
      description: "Judgement, together with the order on compensation passed under it",
      dated: "2026-07-09",
    },
    copies: 2,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 27,
    feeTendered: "₹81",
  },
  {
    id: "ca-264",
    applicationNumber: "CA/264/2026",
    caseNumber: "ST/1143/2026",
    parties: {
      complainant: "Preetha Gopakumar",
      accused: "Kalluvathukkal Granite Crushers",
    },
    counsel: [
      { name: "Adv. Sabu Varghese", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    applicant: {
      name: "Kalluvathukkal Granite Crushers",
      side: "accused",
      capacity: "Accused, through its partner",
    },
    raisedOn: "2026-07-09",
    record: {
      kind: "order",
      description: "Order framing the notice of accusation and the answer recorded on it",
      dated: "2026-06-30",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 5,
    feeTendered: "₹15",
  },
  {
    id: "ca-258",
    applicationNumber: "CA/258/2026",
    caseNumber: "CMP/3128/2026",
    parties: {
      complainant: "Jose Chirayil",
      accused: "Puthoor Aqua Farms",
    },
    counsel: [{ name: "Adv. Meera John", side: "complainant" }],
    applicant: {
      name: "Jose Chirayil",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-07-02",
    record: {
      kind: "complaint",
      description: "Complaint as presented, with the affidavit sworn in support of it",
      dated: "2026-05-18",
    },
    copies: 1,
    urgency: "urgent",
    purpose: "own-record",
    folios: 16,
    feeTendered: "₹48",
  },
  {
    id: "ca-251",
    applicationNumber: "CA/251/2026",
    caseNumber: "ST/1136/2026",
    parties: {
      complainant: "Sanal Kumar V",
      accused: "Vettikkavala Auto Finance",
    },
    counsel: [
      { name: "Adv. Leela Krishnan", side: "complainant" },
      { name: "Adv. Suresh Menon", side: "accused" },
    ],
    applicant: {
      name: "Vettikkavala Auto Finance",
      side: "accused",
      capacity: "Accused, through its manager",
    },
    raisedOn: "2026-06-25",
    record: {
      kind: "deposition",
      description:
        "Deposition of DW-1 recorded on the day the defence evidence was closed",
      dated: "2026-06-17",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 8,
    feeTendered: "₹24",
  },
  {
    id: "ca-245",
    applicationNumber: "CA/245/2026",
    caseNumber: "ST/1129/2026",
    parties: {
      complainant: "Thazhava Handloom Weavers Society",
      accused: "Jibin Xavier",
    },
    counsel: [
      { name: "Adv. Priya Raghavan", side: "complainant" },
      { name: "Adv. Elizabeth Kurian", side: "accused" },
    ],
    applicant: {
      name: "Thazhava Handloom Weavers Society",
      side: "complainant",
      capacity: "Complainant, through its president",
    },
    raisedOn: "2026-06-18",
    record: {
      kind: "judgement",
      description: "Judgement of acquittal and the reasons recorded for it",
      dated: "2026-06-11",
    },
    copies: 2,
    urgency: "urgent",
    purpose: "appeal",
    folios: 31,
    feeTendered: "₹93",
  },
  {
    id: "ca-238",
    applicationNumber: "CA/238/2026",
    caseNumber: "ST/1121/2026",
    parties: {
      complainant: "Bhagyalakshmi Menon",
      accused: "Sooranad North Plantations",
    },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    applicant: {
      name: "Bhagyalakshmi Menon",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-06-11",
    record: {
      kind: "exhibit",
      description: "Exhibit P5, the ledger extract produced to prove the debt",
      dated: "2026-04-22",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 7,
    feeTendered: "₹21",
  },
  {
    id: "ca-232",
    applicationNumber: "CA/232/2026",
    caseNumber: "ST/1114/2026",
    parties: {
      complainant: "Aravind Sasidharan",
      accused: "Neduvathoor Poultry Feeds",
    },
    counsel: [
      { name: "Adv. Anwar Sadath", side: "complainant" },
      { name: "Adv. Fathima Nazar", side: "accused" },
    ],
    applicant: {
      name: "Neduvathoor Poultry Feeds",
      side: "accused",
      capacity: "Accused, through its partner",
    },
    raisedOn: "2026-06-04",
    record: {
      kind: "order",
      description:
        "Order refusing to condone the delay in producing the bank's certificate",
      dated: "2026-05-26",
    },
    copies: 1,
    urgency: "urgent",
    purpose: "revision",
    folios: 4,
    feeTendered: "₹12",
  },
  {
    id: "ca-226",
    applicationNumber: "CA/226/2026",
    caseNumber: "ST/1107/2026",
    parties: {
      complainant: "Latheefa Kunju",
      accused: "Chirakkara Rubber Estates",
    },
    counsel: [
      { name: "Adv. Mohan Das", side: "complainant" },
      { name: "Adv. Haridas Nair", side: "accused" },
    ],
    applicant: {
      name: "Latheefa Kunju",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-05-28",
    record: {
      kind: "deposition",
      description:
        "Deposition of PW-3, the handwriting expert examined on the disputed signature",
      dated: "2026-05-14",
    },
    copies: 2,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 19,
    feeTendered: "₹57",
  },
  {
    /* Counsel on record for the complainant only, and it is the accused applying. */
    id: "ca-219",
    applicationNumber: "CA/219/2026",
    caseNumber: "CMP/3109/2026",
    parties: {
      complainant: "Manikandan Achuthan",
      accused: "Kadakkal Hill Produce Marketing Company",
    },
    counsel: [{ name: "Adv. Vinod Chandran", side: "complainant" }],
    applicant: {
      name: "Kadakkal Hill Produce Marketing Company",
      side: "accused",
      capacity: "Accused, through its managing director",
    },
    raisedOn: "2026-05-21",
    record: {
      kind: "complaint",
      description:
        "Complaint, the list of witnesses and the list of documents filed along with it",
      dated: "2026-03-30",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 21,
    feeTendered: "₹63",
  },
  {
    id: "ca-213",
    applicationNumber: "CA/213/2026",
    caseNumber: "ST/1099/2026",
    parties: {
      complainant: "Roselyn D'Cruz",
      accused: "Anchalummoodu Fabrication Works",
    },
    counsel: [
      { name: "Adv. Rajan Pillai", side: "complainant" },
      { name: "Adv. Deepa Chandran", side: "accused" },
    ],
    applicant: {
      name: "Roselyn D'Cruz",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-05-14",
    record: {
      kind: "judgement",
      description:
        "Judgement, and the order directing the fine to be paid as compensation",
      dated: "2026-05-07",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 25,
    feeTendered: "₹75",
  },
  {
    id: "ca-206",
    applicationNumber: "CA/206/2026",
    caseNumber: "ST/1092/2026",
    parties: {
      complainant: "Kottamkara Ply and Boards",
      accused: "Nazrin Muhammed",
    },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Arun Prakash", side: "accused" },
    ],
    applicant: {
      name: "Nazrin Muhammed",
      side: "accused",
      capacity: "Accused",
    },
    raisedOn: "2026-05-06",
    record: {
      kind: "order",
      description: "Order on the application to send the cheque for expert examination",
      dated: "2026-04-28",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "revision",
    folios: 6,
    feeTendered: "₹18",
  },
  {
    id: "ca-199",
    applicationNumber: "CA/199/2026",
    caseNumber: "ST/1085/2026",
    parties: {
      complainant: "Sujith Balagopal",
      accused: "Thevalappuram Marine Nets",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Sabu Varghese", side: "accused" },
    ],
    applicant: {
      name: "Sujith Balagopal",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-04-29",
    record: {
      kind: "exhibit",
      description:
        "Exhibit P7, the acknowledgement card returned after service of the statutory notice",
      dated: "2026-03-17",
    },
    copies: 2,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 3,
    feeTendered: "₹9",
  },
  {
    id: "ca-192",
    applicationNumber: "CA/192/2026",
    caseNumber: "ST/1077/2026",
    parties: {
      complainant: "Meharunnisa Rawther",
      accused: "Karimpinpuzha Tile Company",
    },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    applicant: {
      name: "Meharunnisa Rawther",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-04-22",
    record: {
      kind: "deposition",
      description:
        "Deposition of PW-1 and the cross-examination recorded on the following posting",
      dated: "2026-04-08",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 15,
    feeTendered: "₹45",
  },
  {
    id: "ca-185",
    applicationNumber: "CA/185/2026",
    caseNumber: "ST/1069/2026",
    parties: {
      complainant: "Ganeshkumar Thampi",
      accused: "Valakom Timber Kilns",
    },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Anitha George", side: "accused" },
    ],
    applicant: {
      name: "Valakom Timber Kilns",
      side: "accused",
      capacity: "Accused, through its proprietor",
    },
    raisedOn: "2026-04-15",
    record: {
      kind: "judgement",
      description:
        "Judgement of conviction, and the sentence and default term recorded with it",
      dated: "2026-04-08",
    },
    copies: 3,
    urgency: "urgent",
    purpose: "appeal",
    folios: 29,
    feeTendered: "₹87",
  },
  {
    id: "ca-178",
    applicationNumber: "CA/178/2026",
    caseNumber: "CMP/3096/2026",
    parties: {
      complainant: "Sarath Vasudevan",
      accused: "Edamon Estate Provisions",
    },
    counsel: [{ name: "Adv. Nisha Thomas", side: "complainant" }],
    applicant: {
      name: "Sarath Vasudevan",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-04-08",
    record: {
      kind: "complaint",
      description:
        "Complaint as numbered by the office, with the endorsement of presentation on it",
      dated: "2026-02-26",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 13,
    feeTendered: "₹39",
  },
  {
    id: "ca-171",
    applicationNumber: "CA/171/2026",
    caseNumber: "ST/1061/2026",
    parties: {
      complainant: "Jayalakshmi Sreedharan",
      accused: "Perayam Wire Products",
    },
    counsel: [
      { name: "Adv. Haridas Nair", side: "complainant" },
      { name: "Adv. Leela Krishnan", side: "accused" },
    ],
    applicant: {
      name: "Jayalakshmi Sreedharan",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-03-31",
    record: {
      kind: "order",
      description:
        "Order closing the evidence of the complainant and posting the case for the questioning of the accused",
      dated: "2026-03-24",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 4,
    feeTendered: "₹12",
  },
  {
    id: "ca-164",
    applicationNumber: "CA/164/2026",
    caseNumber: "ST/1054/2026",
    parties: {
      complainant: "Ashokan Damodaran",
      accused: "Kottarakkara Book Depot",
    },
    counsel: [
      { name: "Adv. Elizabeth Kurian", side: "complainant" },
      { name: "Adv. Priya Raghavan", side: "accused" },
    ],
    applicant: {
      name: "Kottarakkara Book Depot",
      side: "accused",
      capacity: "Accused, through its proprietor",
    },
    raisedOn: "2026-03-24",
    record: {
      kind: "exhibit",
      description:
        "Exhibit D2, the receipt relied on by the accused to prove part payment",
      dated: "2026-02-19",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 2,
    feeTendered: "₹6",
  },
  {
    id: "ca-149",
    applicationNumber: "CA/149/2026",
    caseNumber: "ST/1047/2026",
    parties: {
      complainant: "Beena Neelakantan",
      accused: "Thrikkovilvattom Poultry Traders",
    },
    counsel: [
      { name: "Adv. Vinod Chandran", side: "complainant" },
      { name: "Adv. Mohan Das", side: "accused" },
    ],
    applicant: {
      name: "Beena Neelakantan",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-03-10",
    record: {
      kind: "deposition",
      description:
        "Deposition of PW-4, the accountant who spoke to the entries in the ledger",
      dated: "2026-03-04",
    },
    copies: 2,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 11,
    feeTendered: "₹33",
  },
  {
    id: "ca-131",
    applicationNumber: "CA/131/2026",
    caseNumber: "ST/1039/2026",
    parties: {
      complainant: "Zakariya Pareed",
      accused: "Chadayamangalam Wood Industries",
    },
    counsel: [{ name: "Adv. Fathima Nazar", side: "complainant" }],
    applicant: {
      name: "Zakariya Pareed",
      side: "complainant",
      capacity: "Complainant",
    },
    raisedOn: "2026-02-17",
    record: {
      kind: "judgement",
      description:
        "Judgement of acquittal, and the finding recorded on the presumption raised by the complainant",
      dated: "2026-02-10",
    },
    copies: 2,
    urgency: "urgent",
    purpose: "appeal",
    folios: 33,
    feeTendered: "₹99",
  },
  {
    /* The one application raised in the previous year. Its serial is high because the
       counter's series resets in January — the reason the year is part of the number. */
    id: "ca-511",
    applicationNumber: "CA/511/2025",
    caseNumber: "ST/1032/2025",
    parties: {
      complainant: "Salini Mohandas",
      accused: "Alappad Marine Ropes",
    },
    counsel: [
      { name: "Adv. Arun Prakash", side: "complainant" },
      { name: "Adv. Rajan Pillai", side: "accused" },
    ],
    applicant: {
      name: "Alappad Marine Ropes",
      side: "accused",
      capacity: "Accused, through its partner",
    },
    raisedOn: "2025-12-15",
    record: {
      kind: "order",
      description: "Order taking the complaint on file and issuing process to the accused",
      dated: "2025-11-19",
    },
    copies: 1,
    urgency: "ordinary",
    purpose: "own-record",
    folios: 3,
    feeTendered: "₹9",
  },
];

/**
 * How many copy applications are waiting for approval — the number the rail carries
 * beside "Approve copy application".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `SIGN_FORM_QUEUE_COUNT` and `REGISTER_QUEUE_COUNT` are, so the rail and the screen
 * cannot disagree about the size of the queue. Every row in this queue is pending: a
 * decided application leaves it (see the module header), so the length *is* the pending
 * count.
 */
export const APPROVE_COPY_QUEUE_COUNT = COPY_APPLICATION_QUEUE.length;

export type CopyApplicationFilters = {
  /**
   * Free text over the application number, the case number, the petitioner, the rest of
   * the cause and counsel on record.
   *
   * The reference labels this box "Case number", which is narrower than what a counter
   * actually gets asked. A bench holding a slip of paper has the application number as
   * often as the case number, and the party's name more often than either — so the reach
   * is widened, the placeholder names all three, and the visible label is "Search
   * applications" so it does not promise less than it does.
   */
  query: string;
};

export const EMPTY_COPY_APPLICATION_FILTERS: CopyApplicationFilters = {
  query: "",
};

export function filterCopyApplications(
  rows: CopyApplication[],
  filters: CopyApplicationFilters,
): CopyApplication[] {
  const query = caseSearchKey(filters.query);
  if (!query) return rows;
  return rows.filter((application) => {
    const haystack = [
      application.applicationNumber,
      application.caseNumber,
      application.applicant.name,
      application.parties.complainant,
      application.parties.accused,
      application.record.description,
      ...application.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** "31 Aug 2026" — the same column register every other court-side list uses. */
export function formatCopyApplicationDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "15 September 2026" — a date named inside the application's prose, not in a column. */
export function formatCopyApplicationLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/**
 * Who actually put the application in — counsel on record for the applicant's side, or
 * the party themselves when that side has no vakalat.
 *
 * The reference's "Application filer" row. Derived rather than stored, so a row cannot
 * claim an advocate it does not have on record, and shared with the other court-side
 * review overlays (`applicationFiler`) so four screens cannot word it four ways.
 */
export function copyApplicationFiler(application: CopyApplication): string {
  return applicationFiler(application, application.applicant.side);
}

/** "2 copies · Urgent" — the two facts about scale that travel together. */
export function copiesLine(application: CopyApplication): string {
  const copies =
    application.copies === 1 ? "1 copy" : `${application.copies} copies`;
  return `${copies} · ${copyUrgencyLabel(application.urgency)}`;
}

/**
 * The application as a document: what the preview renders and what Download writes.
 *
 * Shaped like `ReschedulingDocument` — a court heading, recited particulars, numbered
 * paragraphs and a prayer — because that is what a copy application is: a party asking
 * the court for something, not a form the court has drawn up. The court-side facsimiles
 * then read as one product rather than four.
 */
export type CopyApplicationDocument = {
  court: string;
  applicationNumber: string;
  caseNumber: string;
  matter: string;
  /** The application's own name, e.g. "Application for a certified copy of the judgement". */
  title: string;
  /** The particulars the copying counter reads off the top of the form. */
  facts: { term: string; value: string }[];
  paragraphs: string[];
  prayer: string;
  dated: string;
  /** Where it was presented. The court's own seat, on every row. */
  place: string;
  applicant: { name: string; capacity: string };
  /** Counsel who presented it, or the party appearing without one. */
  filedBy: string;
};

const TITLES: Record<CopyRecordKind, string> = {
  judgement: "Application for a certified copy of the judgement",
  order: "Application for a certified copy of an order",
  deposition: "Application for a certified copy of a deposition",
  exhibit: "Application for a certified copy of a marked exhibit",
  complaint: "Application for a certified copy of the complaint",
};

/**
 * What each kind of copy application says.
 *
 * Five templates, filled from the row's own particulars — a party asking for a judgement
 * says something different from a party asking for one witness's deposition, and
 * previewing three rows of this queue should show three genuinely different documents
 * rather than one string with the names swapped. `paragraphsFor()` in `sign-forms.ts`
 * does the same job for the three sign-form templates.
 *
 * All five are demo text. See the module header: no rule, form number or fee schedule is
 * quoted, and the application describes what it wants without pretending to cite the
 * provision that entitles it.
 */
function paragraphsFor(application: CopyApplication): {
  paragraphs: string[];
  prayer: string;
} {
  const { applicant, record, parties } = application;
  const side = partySideLabel(applicant.side);
  const recordDay = formatCopyApplicationLongDate(record.dated);
  const purpose = copyPurposeLabel(application.purpose).toLowerCase();
  const copies =
    application.copies === 1
      ? "one certified copy"
      : `${application.copies} certified copies`;

  /* The last paragraph is the same job on every template — how much, how quickly, and
     what was paid at the counter — so it is written once. */
  const tender =
    `${copies} ${application.copies === 1 ? "is" : "are"} applied for, on the ` +
    `${copyUrgencyLabel(application.urgency).toLowerCase()} side. The record is ` +
    `estimated at ${application.folios} folios and ${application.feeTendered} has been ` +
    `tendered at the counter towards the copying charges. The applicant undertakes to ` +
    `pay whatever further amount the office assesses on checking the record.`;

  switch (record.kind) {
    case "judgement":
      return {
        paragraphs: [
          `I am the ${side} in the above case, arrayed as ${applicant.name}. The case was heard and judgement was pronounced by this court on ${recordDay}.`,
          `I require a certified copy of ${lowerFirst(record.description)}. The copy is required ${purpose}, and the time taken to obtain it will fall within the period I have to reckon.`,
          tender,
        ],
        prayer: `It is therefore prayed that this court may be pleased to order that a certified copy of the judgement pronounced on ${recordDay} be issued to the applicant.`,
      };
    case "order":
      return {
        paragraphs: [
          `I am the ${side} in the above case, arrayed as ${applicant.name}. On ${recordDay} this court passed the order now applied for — ${lowerFirst(record.description)}.`,
          `A certified copy of that order is required ${purpose}. No copy of it has been applied for by me earlier.`,
          tender,
        ],
        prayer: `It is therefore prayed that this court may be pleased to order that a certified copy of the order dated ${recordDay} be issued to the applicant.`,
      };
    case "deposition":
      return {
        paragraphs: [
          `I am the ${side} in the above case, arrayed as ${applicant.name}. The evidence now applied for was recorded by this court on ${recordDay} — ${lowerFirst(record.description)}.`,
          `A certified copy of that deposition is required ${purpose}, and to prepare for the remaining evidence in the case. The witness has been examined and the deposition is on the file of this court.`,
          tender,
        ],
        prayer: `It is therefore prayed that this court may be pleased to order that a certified copy of the deposition recorded on ${recordDay} be issued to the applicant.`,
      };
    case "exhibit":
      return {
        paragraphs: [
          `I am the ${side} in the above case, arrayed as ${applicant.name}. The document now applied for was marked and received in evidence on ${recordDay} — ${lowerFirst(record.description)} — and forms part of the record of this case.`,
          `A certified copy of it is required ${purpose}. The original is not asked to be released; a copy will serve the purpose.`,
          tender,
        ],
        prayer: `It is therefore prayed that this court may be pleased to order that a certified copy of the exhibit marked on ${recordDay} be issued to the applicant.`,
      };
    case "complaint":
      return {
        paragraphs: [
          `I am the ${side} in the above case, arrayed as ${applicant.name}. The complaint against ${parties.accused} was presented before this court on ${recordDay} and is on its file.`,
          `A certified copy of ${lowerFirst(record.description)} is required ${purpose}.`,
          tender,
        ],
        prayer: `It is therefore prayed that this court may be pleased to order that a certified copy of the complaint presented on ${recordDay} be issued to the applicant.`,
      };
  }
}

/** "Judgement of acquittal" → "judgement of acquittal", mid-sentence. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function buildCopyApplicationDocument(
  application: CopyApplication,
): CopyApplicationDocument {
  const { paragraphs, prayer } = paragraphsFor(application);

  return {
    court: COURT,
    applicationNumber: application.applicationNumber,
    caseNumber: application.caseNumber,
    matter: causeTitle(application),
    title: TITLES[application.record.kind],
    facts: [
      { term: "Applicant", value: application.applicant.capacity },
      { term: "Record sought", value: application.record.description },
      {
        term: "Date of the record",
        value: formatCopyApplicationLongDate(application.record.dated),
      },
      {
        term: "Copies required",
        value: String(application.copies),
      },
      {
        term: "Ordinary or urgent",
        value: copyUrgencyLabel(application.urgency),
      },
      { term: "Purpose", value: copyPurposeLabel(application.purpose) },
      { term: "Folios estimated", value: String(application.folios) },
      { term: "Fee tendered", value: application.feeTendered },
    ],
    paragraphs,
    prayer,
    dated: formatCopyApplicationLongDate(application.raisedOn),
    place: PLACE,
    applicant: {
      name: application.applicant.name,
      capacity: application.applicant.capacity,
    },
    filedBy: copyApplicationFiler(application),
  };
}

export function copyApplicationDocumentText(
  document: CopyApplicationDocument,
): string {
  return [
    document.court,
    `Copy application no. ${document.applicationNumber}`,
    `In case no. ${document.caseNumber}`,
    document.matter,
    "",
    document.title,
    "",
    ...document.facts.map((fact) => `${fact.term}: ${fact.value}`),
    "",
    ...document.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`,
    ),
    "",
    "Prayer",
    document.prayer,
    "",
    `Dated this ${document.dated}, at ${document.place}.`,
    "",
    "Applicant:",
    document.applicant.name,
    document.applicant.capacity,
    "",
    `Presented by: ${document.filedBy}`,
  ].join("\n");
}

export function copyApplicationDocumentFilename(
  application: CopyApplication,
): string {
  return `${application.applicationNumber.replace(/\//g, "-")}-copy-application.txt`;
}

export function downloadCopyApplicationDocument(
  application: CopyApplication,
): void {
  const document = buildCopyApplicationDocument(application);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(copyApplicationDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = copyApplicationDocumentFilename(voicedForDownload(application));
  anchor.click();
  URL.revokeObjectURL(url);
}
