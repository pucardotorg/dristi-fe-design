/**
 * Witness depositions waiting on this bench's signature — the evidence sheets, as data.
 *
 * The fifth row of the rail's Sign group, and the sibling of `sign-forms.ts`,
 * `sign-orders.ts` and `sign-a-diary.ts`. Those three are a paper a party swears, a
 * decision the court makes, and the register of the court's own day. This one is
 * **evidence**: what a witness said in the box, taken down as they said it. Until the
 * magistrate signs the sheet the evidence is not on record, which is why a queue of
 * unsigned depositions is a queue that stops trials.
 *
 * Two facts about depositions shape the module:
 *
 * 1. **A deposition belongs to a witness, not to a case.** One case yields as many
 *    sheets as it has witnesses, and a witness examined over two sittings yields two.
 *    So the row is the deposition and the case number repeats down the column — the
 *    reference's own list shows the same case twice, and the witness name is the column
 *    that tells the two rows apart.
 * 2. **The court numbers its witnesses.** `PW1` is the complainant's first witness,
 *    `DW4` the defence's fourth, and that tag is how the bench, the bar and the record
 *    all refer to the sheet. `witnessTag` derives it rather than storing it, so a row
 *    cannot carry a tag that disagrees with its own side.
 *
 * **There is no backend and nothing here is signed or published.** `WITNESS_DEPOSITION_QUEUE`
 * is demo data shaped to exercise what the screen has to survive: all five kinds of
 * witness the §138 box actually sees, both sides' numbering, two cases carrying two
 * sheets each, a corporate party long enough to wrap the cause title, a side with no
 * vakalat so the advocates cell has to answer for an empty side, a witness name long
 * enough to wrap its column, cross-examination completed, declined and deferred, and
 * enough rows to page at 10, 20 and 30. No row is read from a case, a court or a
 * register.
 *
 * **The deposition wording is demo text, not a court-approved form.** It is modelled on
 * the deposition sheet the reference screens show and filled from each row's own
 * particulars. `docs/product/` defines no §138 deposition template, so this module
 * writes one for the preview to have something real-shaped to render and claims nothing
 * more about it. The statutory citation in the heading is the reference's own.
 *
 * Every number is `ST/…`: evidence is recorded at trial, after a complaint has been
 * taken on file and given a summary-trial number, so a `CMP/…` deposition would be a
 * sheet from a stage the case has not reached. No number here appears in today's cause
 * list, the scheduling queue, the register queue, either review queue, or the signing
 * queues above it. The *parties* are a different matter: this court's queues share one
 * local cast, so the same firm or the same bar appears across them, and two §138 cases
 * between the same parties is the ordinary case rather than a fixture mistake — the
 * filing form asks about exactly that. What no row does is put one person in two
 * incompatible roles.
 */

import { CURRENT_STAFF } from "./content";
import {
  causeTitle,
  formatListingDate,
  parseIsoDay,
  type CounselSide,
  type CourtCounsel,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/**
 * Who is in the box.
 *
 * Five kinds, because a §138 trial calls five kinds of witness and each says a
 * different thing: the complainant proves the cheque and the notice, a bank official
 * proves the dishonour, an attesting witness proves the handing over, the accused
 * answers the case, and an accountant proves payment. The kind decides what the sheet
 * says — see `depositionFor` — so it is a fact about the row rather than prose stored
 * twenty-two times.
 */
export type WitnessKind =
  | "complainant"
  | "bank-official"
  | "attesting-witness"
  | "accused"
  | "accountant";

/**
 * What happened after the chief examination.
 *
 * Three states rather than a boolean, because "there was no cross-examination" and
 * "the cross-examination has not happened yet" are different facts about the same
 * sheet, and the bench signs both. The reference's queue shows only that a sheet is
 * unsigned; the sheet itself has to say which of the three it is.
 */
export type CrossExamination = "completed" | "declined" | "deferred";

/** The witness, as the sheet's own particulars name them. */
export type DepositionWitness = {
  name: string;
  /** Which side called them. Decides `PW` or `DW`. */
  side: CounselSide;
  /** Their number on that side — the `1` in `PW1`. */
  index: number;
  kind: WitnessKind;
  age: number;
  occupation: string;
  /** Where they live, as the sheet records it. */
  residence: string;
};

/** The cheque the §138 case is about, as the deposition recites it. */
export type DepositionCheque = {
  number: string;
  /** Already grouped in the Indian convention — the screen renders, it does not format. */
  amount: string;
  bank: string;
  /** ISO day the cheque came back. */
  dishonouredOn: string;
};

export type WitnessDeposition = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /** Counsel on record. A side may have none — no vakalat yet. */
  counsel: CourtCounsel[];
  witness: DepositionWitness;
  /** ISO day the evidence was recorded — the reference's "Date of deposition". */
  depositionOn: string;
  cross: CrossExamination;
  cheque: DepositionCheque;
};

/** The court whose evidence this is. One bench, one queue of sheets. */
const COURT = CURRENT_STAFF.court;

/** Where the evidence is recorded. The court's own seat — not a per-row fact. */
const PLACE = "Sample District";

/**
 * The depositions this bench has not yet signed.
 *
 * Ordered newest first — evidence is signed from the most recent sitting backwards, and
 * that is the order the reference showed. Names follow the fixtures the rest of the
 * court side uses: local parties and the same bar practising in this court.
 */
export const WITNESS_DEPOSITION_QUEUE: WitnessDeposition[] = [
  {
    id: "wd-901-pw1",
    caseNumber: "ST/901/2026",
    parties: { complainant: "Sajeev Kumar", accused: "Thevally Auto Works" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Arun Prakash", side: "accused" },
    ],
    witness: {
      name: "Sajeev Kumar",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 48,
      occupation: "Proprietor, Sajeev Motors",
      residence: "Thevally",
    },
    depositionOn: "2026-08-21",
    cross: "deferred",
    cheque: {
      number: "123456",
      amount: "10,00,000",
      bank: "Union Bank, Ernakulam branch",
      dishonouredOn: "2025-09-25",
    },
  },
  {
    id: "wd-901-pw2",
    caseNumber: "ST/901/2026",
    parties: { complainant: "Sajeev Kumar", accused: "Thevally Auto Works" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Arun Prakash", side: "accused" },
    ],
    witness: {
      name: "Beena Chandrasekhar",
      side: "complainant",
      index: 2,
      kind: "bank-official",
      age: 41,
      occupation: "Branch manager, Union Bank",
      residence: "Ernakulam",
    },
    depositionOn: "2026-08-21",
    cross: "completed",
    cheque: {
      number: "123456",
      amount: "10,00,000",
      bank: "Union Bank, Ernakulam branch",
      dishonouredOn: "2025-09-25",
    },
  },
  {
    id: "wd-904-pw1",
    caseNumber: "ST/904/2026",
    parties: {
      complainant: "Ashramam Hardware and Sanitary Wares",
      accused: "Sabu Chellappan",
    },
    counsel: [{ name: "Adv. Mohan Das", side: "complainant" }],
    witness: {
      name: "Sarala Devi",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 53,
      occupation: "Managing partner, Ashramam Hardware and Sanitary Wares",
      residence: "Ashramam",
    },
    depositionOn: "2026-08-12",
    cross: "completed",
    cheque: {
      number: "884210",
      amount: "4,75,000",
      bank: "South Indian Bank, main branch",
      dishonouredOn: "2025-11-14",
    },
  },
  {
    id: "wd-908-dw1",
    caseNumber: "ST/908/2026",
    parties: { complainant: "Jomon Jacob", accused: "Sheela Ravindran" },
    counsel: [
      { name: "Adv. Priya Raghavan", side: "complainant" },
      { name: "Adv. Haridas Nair", side: "accused" },
    ],
    witness: {
      name: "Sheela Ravindran",
      side: "accused",
      index: 1,
      kind: "accused",
      age: 39,
      occupation: "Tailor",
      residence: "Kadappakada",
    },
    depositionOn: "2026-08-06",
    cross: "completed",
    cheque: {
      number: "301994",
      amount: "2,20,000",
      bank: "Federal Bank, Chinnakada branch",
      dishonouredOn: "2025-08-29",
    },
  },
  {
    id: "wd-912-pw1",
    caseNumber: "ST/912/2026",
    parties: { complainant: "Shanavas Ali", accused: "Kadappakada Motors" },
    counsel: [
      { name: "Adv. Elizabeth Kurian", side: "complainant" },
      { name: "Adv. Rajan Pillai", side: "accused" },
    ],
    witness: {
      name: "Shanavas Ali",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 45,
      occupation: "Cashew trader",
      residence: "Mundakkal",
    },
    depositionOn: "2026-07-30",
    cross: "declined",
    cheque: {
      number: "556012",
      amount: "1,15,000",
      bank: "Canara Bank, Kadappakada branch",
      dishonouredOn: "2025-07-15",
    },
  },
  {
    id: "wd-915-pw2",
    caseNumber: "ST/915/2026",
    parties: { complainant: "Girija Amma", accused: "Nowfal Rawther" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Deepa Chandran", side: "accused" },
    ],
    witness: {
      name: "Thankamani Vasudevan",
      side: "complainant",
      index: 2,
      kind: "attesting-witness",
      age: 62,
      occupation: "Retired schoolteacher",
      residence: "Kilikolloor",
    },
    depositionOn: "2026-07-23",
    cross: "completed",
    cheque: {
      number: "770233",
      amount: "8,40,000",
      bank: "HDFC Bank, main branch",
      dishonouredOn: "2025-07-02",
    },
  },
  {
    id: "wd-919-dw2",
    caseNumber: "ST/919/2026",
    parties: {
      complainant: "Kilikolloor Rubber Traders",
      accused: "Anilkumar Sivadasan",
    },
    counsel: [
      { name: "Adv. Fathima Nazar", side: "complainant" },
      { name: "Adv. Sabu Varghese", side: "accused" },
    ],
    witness: {
      name: "Prasanth Balakrishnan",
      side: "accused",
      index: 2,
      kind: "accountant",
      age: 36,
      occupation: "Accountant",
      residence: "Punalur",
    },
    depositionOn: "2026-07-16",
    cross: "completed",
    cheque: {
      number: "119875",
      amount: "3,60,000",
      bank: "State Bank of India, Chavara branch",
      dishonouredOn: "2025-06-10",
    },
  },
  {
    id: "wd-922-pw1",
    caseNumber: "ST/922/2026",
    parties: { complainant: "Vijayan Pillai", accused: "Susan Mathew" },
    counsel: [{ name: "Adv. Anwar Sadath", side: "complainant" }],
    witness: {
      name: "Vijayan Pillai",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 57,
      occupation: "Contractor",
      residence: "Eravipuram",
    },
    depositionOn: "2026-07-09",
    cross: "deferred",
    cheque: {
      number: "642180",
      amount: "95,000",
      bank: "Bank of Baroda, Mundakkal branch",
      dishonouredOn: "2025-04-28",
    },
  },
  {
    id: "wd-926-pw1",
    caseNumber: "ST/926/2026",
    parties: {
      complainant: "Sadaf Rahman",
      accused: "Paravur Rice Mills and General Trading Pvt Ltd",
    },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    witness: {
      name: "Sadaf Rahman",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 34,
      occupation: "Wholesale grocer",
      residence: "Paravur",
    },
    depositionOn: "2026-06-25",
    cross: "completed",
    cheque: {
      number: "208746",
      amount: "12,50,000",
      bank: "Union Bank, Paravur branch",
      dishonouredOn: "2025-03-24",
    },
  },
  {
    id: "wd-930-pw2",
    caseNumber: "ST/930/2026",
    parties: { complainant: "Rajan Krishnan", accused: "Quilon Cashew Exports" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    witness: {
      name: "Mohammed Yousaf",
      side: "complainant",
      index: 2,
      kind: "bank-official",
      age: 44,
      occupation: "Senior manager, Indian Bank",
      residence: "Sample District",
    },
    depositionOn: "2026-06-18",
    cross: "completed",
    cheque: {
      number: "445901",
      amount: "6,80,000",
      bank: "Indian Bank, main branch",
      dishonouredOn: "2025-02-17",
    },
  },
  {
    id: "wd-933-pw1",
    caseNumber: "ST/933/2026",
    parties: { complainant: "Shiny Varghese", accused: "Thevally Boat Yard" },
    counsel: [],
    witness: {
      name: "Shiny Varghese",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 50,
      occupation: "Fish merchant",
      residence: "Thevally",
    },
    depositionOn: "2026-06-11",
    cross: "declined",
    cheque: {
      number: "667312",
      amount: "1,90,000",
      bank: "Federal Bank, Thevally branch",
      dishonouredOn: "2025-02-03",
    },
  },
  {
    id: "wd-937-dw1",
    caseNumber: "ST/937/2026",
    parties: { complainant: "Ajith Kumar", accused: "Punalur Paper Depot" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Anitha George", side: "accused" },
    ],
    witness: {
      name: "Gopalakrishnan Nair",
      side: "accused",
      index: 1,
      kind: "accused",
      age: 61,
      occupation: "Managing partner, Punalur Paper Depot",
      residence: "Punalur",
    },
    depositionOn: "2026-06-04",
    cross: "completed",
    cheque: {
      number: "903455",
      amount: "2,45,000",
      bank: "Canara Bank, Punalur branch",
      dishonouredOn: "2024-12-23",
    },
  },
  {
    id: "wd-941-pw1",
    caseNumber: "ST/941/2026",
    parties: { complainant: "Leela Kumari", accused: "Asramam Dairy Products" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    witness: {
      name: "Leela Kumari",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 55,
      occupation: "Dairy supplier",
      residence: "Asramam",
    },
    depositionOn: "2026-05-28",
    cross: "completed",
    cheque: {
      number: "512088",
      amount: "5,25,000",
      bank: "South Indian Bank, Asramam branch",
      dishonouredOn: "2024-11-20",
    },
  },
  {
    id: "wd-944-pw2",
    caseNumber: "ST/944/2026",
    parties: { complainant: "Shihabudeen", accused: "Kottiyam Steel House" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    witness: {
      name: "Ravindran Kesavan",
      side: "complainant",
      index: 2,
      kind: "attesting-witness",
      age: 47,
      occupation: "Lorry owner",
      residence: "Kottiyam",
    },
    depositionOn: "2026-05-21",
    cross: "deferred",
    cheque: {
      number: "338117",
      amount: "3,10,000",
      bank: "Bank of Baroda, Kottiyam branch",
      dishonouredOn: "2024-10-26",
    },
  },
  {
    id: "wd-948-pw1",
    caseNumber: "ST/948/2026",
    parties: { complainant: "Geetha Nair", accused: "Chavara Minerals" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    witness: {
      name: "Geetha Nair",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 43,
      occupation: "Proprietor, Nair Traders",
      residence: "Chavara",
    },
    depositionOn: "2026-05-14",
    cross: "completed",
    cheque: {
      number: "774920",
      amount: "7,15,000",
      bank: "HDFC Bank, Chavara branch",
      dishonouredOn: "2024-10-01",
    },
  },
  {
    id: "wd-952-dw3",
    caseNumber: "ST/952/2026",
    parties: { complainant: "Mathew Philip", accused: "Ochira Furniture Mart" },
    counsel: [
      { name: "Adv. Feroz Hameed", side: "complainant" },
      { name: "Adv. Deepa Chandran", side: "accused" },
    ],
    witness: {
      name: "Sainudheen Kunju",
      side: "accused",
      index: 3,
      kind: "accountant",
      age: 38,
      occupation: "Accountant, Ochira Furniture Mart",
      residence: "Ochira",
    },
    depositionOn: "2026-05-07",
    cross: "completed",
    cheque: {
      number: "160374",
      amount: "1,35,000",
      bank: "Indian Bank, Ochira branch",
      dishonouredOn: "2024-09-08",
    },
  },
  {
    id: "wd-955-pw1",
    caseNumber: "ST/955/2026",
    parties: { complainant: "Ramla Beevi", accused: "Mayyanad Fisheries" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    witness: {
      name: "Ramla Beevi",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 36,
      occupation: "Fish exporter",
      residence: "Mayyanad",
    },
    depositionOn: "2026-04-30",
    cross: "completed",
    cheque: {
      number: "489261",
      amount: "2,80,000",
      bank: "Union Bank, Mayyanad branch",
      dishonouredOn: "2024-08-12",
    },
  },
  {
    id: "wd-959-pw2",
    caseNumber: "ST/959/2026",
    parties: { complainant: "Vijayakumar", accused: "Kundara Clay Works" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    witness: {
      name: "Elizabeth Chandy",
      side: "complainant",
      index: 2,
      kind: "bank-official",
      age: 40,
      occupation: "Assistant manager, Federal Bank",
      residence: "Kundara",
    },
    depositionOn: "2026-04-23",
    cross: "declined",
    cheque: {
      number: "915008",
      amount: "4,05,000",
      bank: "Federal Bank, Kundara branch",
      dishonouredOn: "2024-06-29",
    },
  },
  {
    id: "wd-963-pw1",
    caseNumber: "ST/963/2026",
    parties: {
      complainant: "Soumya Rajan",
      accused: "Harbour Line Logistics Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    witness: {
      name: "Soumya Rajan",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 42,
      occupation: "Proprietor, Rajan Marine Supplies",
      residence: "Neendakara",
    },
    depositionOn: "2026-04-16",
    cross: "completed",
    cheque: {
      number: "254613",
      amount: "9,60,000",
      bank: "State Bank of India, Neendakara branch",
      dishonouredOn: "2024-06-03",
    },
  },
  {
    id: "wd-966-dw1",
    caseNumber: "ST/966/2026",
    parties: { complainant: "Haridasan", accused: "Lakeside Coir Exports" },
    counsel: [
      { name: "Adv. Rekha Pillai", side: "complainant" },
      { name: "Adv. Arun Prakash", side: "accused" },
    ],
    witness: {
      name: "Aboobacker Sidhique",
      side: "accused",
      index: 1,
      kind: "accused",
      age: 58,
      occupation: "Director, Lakeside Coir Exports",
      residence: "Sample District",
    },
    depositionOn: "2026-04-09",
    cross: "deferred",
    cheque: {
      number: "607841",
      amount: "1,70,000",
      bank: "Canara Bank, main branch",
      dishonouredOn: "2024-04-26",
    },
  },
  {
    id: "wd-970-pw1",
    caseNumber: "ST/970/2026",
    parties: { complainant: "Jameela", accused: "Oachira Handlooms" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    witness: {
      name: "Jameela",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 49,
      occupation: "Handloom weaver",
      residence: "Oachira",
    },
    depositionOn: "2026-04-02",
    cross: "completed",
    cheque: {
      number: "382057",
      amount: "88,000",
      bank: "South Indian Bank, Oachira branch",
      dishonouredOn: "2024-03-19",
    },
  },
  {
    id: "wd-974-pw2",
    caseNumber: "ST/974/2026",
    parties: { complainant: "Sreejith", accused: "Sasthamkotta Rice Traders" },
    counsel: [],
    witness: {
      name: "Krishnankutty Panicker",
      side: "complainant",
      index: 2,
      kind: "attesting-witness",
      age: 66,
      occupation: "Retired bank clerk",
      residence: "Sasthamkotta",
    },
    depositionOn: "2026-03-26",
    cross: "completed",
    cheque: {
      number: "741290",
      amount: "2,05,000",
      bank: "Bank of Baroda, Sasthamkotta branch",
      dishonouredOn: "2024-02-26",
    },
  },
  {
    id: "wd-978-pw1",
    caseNumber: "ST/978/2026",
    parties: { complainant: "Amina", accused: "Anchal Timber Depot" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    witness: {
      name: "Amina",
      side: "complainant",
      index: 1,
      kind: "complainant",
      age: 52,
      occupation: "Timber merchant",
      residence: "Anchal",
    },
    depositionOn: "2026-03-19",
    cross: "completed",
    cheque: {
      number: "128643",
      amount: "3,45,000",
      bank: "Indian Bank, Anchal branch",
      dishonouredOn: "2024-01-22",
    },
  },
];

/**
 * How many depositions are waiting for signature — the number the rail carries beside
 * "Sign witness deposition".
 *
 * Derived from the list rather than typed in beside the label, the way every other
 * built row's count is, so the rail and the screen cannot disagree about the size of
 * the queue.
 */
export const WITNESS_DEPOSITION_QUEUE_COUNT = WITNESS_DEPOSITION_QUEUE.length;

/**
 * `PW1`, `DW4` — how the court refers to this sheet.
 *
 * Derived from the side and the index rather than stored, so a row cannot carry a tag
 * that contradicts the side that called the witness.
 */
export function witnessTag(deposition: WitnessDeposition): string {
  const prefix = deposition.witness.side === "complainant" ? "PW" : "DW";
  return `${prefix}${deposition.witness.index}`;
}

/** "witness of the complainant" — the sheet's own words for which side called them. */
export function witnessRoleLabel(deposition: WitnessDeposition): string {
  return deposition.witness.side === "complainant"
    ? "witness of the complainant"
    : "witness of the defence";
}

/** The dialog's title, and the name the download carries: "Witness deposition (PW1)". */
export function depositionTitle(deposition: WitnessDeposition): string {
  return `Witness deposition (${witnessTag(deposition)})`;
}

export type WitnessDepositionFilters = {
  /**
   * Free text over the cause title, the case number, the witness and counsel. The
   * reference gives this screen one control and labels it "Case Name or Number"; the
   * witness is in the reach too, because a bench looking for one sheet in a case with
   * four of them is looking for the witness.
   */
  query: string;
};

export const EMPTY_WITNESS_DEPOSITION_FILTERS: WitnessDepositionFilters = {
  query: "",
};

export function filterWitnessDepositions(
  rows: WitnessDeposition[],
  filters: WitnessDepositionFilters,
): WitnessDeposition[] {
  const query = caseSearchKey(filters.query);
  if (!query) return rows;
  return rows.filter((deposition) => {
    const haystack = [
      deposition.parties.complainant,
      deposition.parties.accused,
      deposition.caseNumber,
      deposition.witness.name,
      witnessTag(deposition),
      ...deposition.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** "31 Aug 2026" — the same column register every other court-side list uses. */
export function formatDepositionDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "15 September 2025" — a date named inside the sheet's prose, not in a column. */
export function formatDepositionLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/**
 * The deposition as a document: what the preview renders and what Download writes.
 *
 * Shaped like the three other court-side facsimiles — a court heading, the cause, the
 * body, and the block that signs it — so the court side's papers read as one product.
 * What the deposition sheet adds is the **witness's own particulars**, which is the
 * part of the record that says who was in the box, and the split between chief and
 * cross-examination, which is the part that says how the evidence was tested.
 */
export type WitnessDepositionDocument = {
  court: string;
  /** The bench's §138 jurisdiction, as the sheet's heading recites it. */
  jurisdiction: string;
  /** The statutory citation under the heading. The reference's own. */
  citation: string;
  title: string;
  caseNumber: string;
  matter: string;
  /** "Deposition of PW1, witness of the complainant". */
  subject: string;
  /** The witness's particulars: a label and a value, in the order the sheet draws them. */
  particulars: { label: string; value: string }[];
  chief: string[];
  /** The cross-examination, when there was one. */
  cross: string[];
  /** Why there is no cross-examination above. Empty when there is one. */
  crossNote: string;
  /** "21 August 2026" — the day the evidence was recorded, named in full. */
  dated: string;
  attestation: string;
  /** The signature block. Nothing in this build ever signs it. */
  signature: string;
};

/**
 * The witness's role, fit to sit mid-sentence.
 *
 * An occupation is stored as the sheet prints it — "Managing partner, Punalur Paper
 * Depot" — which is a capital and a proper noun the prose cannot swallow whole.
 * Lower-casing the whole string would give "punalur paper depot"; the part before the
 * comma is the role on its own, and only its first letter needs to drop.
 */
function witnessRole(occupation: string): string {
  const role = occupation.split(",")[0].trim();
  return role.charAt(0).toLowerCase() + role.slice(1);
}

/**
 * What each kind of witness said.
 *
 * Five templates, filled from the row's own particulars, because a bank official and an
 * accused do not give the same evidence and a queue whose twenty-two previews read
 * identically cannot be judged. All of it is demo text — see the module header.
 */
function depositionFor(deposition: WitnessDeposition): {
  chief: string[];
  cross: string[];
} {
  const { parties, cheque, witness } = deposition;
  const recital =
    `cheque bearing no. ${cheque.number} for Rs. ${cheque.amount}/-, drawn on ` +
    `${cheque.bank}, returned unpaid by memo dated ` +
    `${formatDepositionLongDate(cheque.dishonouredOn)}`;

  switch (witness.kind) {
    case "complainant":
      return {
        chief: [
          `I am the complainant in this case. I know ${parties.accused} in the course of my business and there were dealings between us. In discharge of the amount due to me, the accused issued the ${recital}.`,
          "I presented the cheque through my bank within its validity and it was returned unpaid. The memo of the bank is produced and marked.",
          `I caused a notice of demand to be issued to the accused within thirty days of the return of the cheque. The notice was served and no payment has been made to me till this date. The copy of the notice and the acknowledgement are produced and marked.`,
        ],
        cross: [
          "It is not correct to say that the cheque was given as a security and not in discharge of a debt. I deny the suggestion that the amount had been settled in cash before the cheque was presented.",
          "I do not maintain a separate ledger for these dealings. I am unable to say on which date the cheque was handed over to me, but it was received at my shop.",
        ],
      };
    case "bank-official":
      return {
        chief: [
          `I am the ${witnessRole(witness.occupation)} of ${cheque.bank} and I am in charge of the records of the branch. I depose from the records maintained in the ordinary course of business.`,
          `The ${recital} was drawn on an account maintained at my branch. The cheque was returned with the endorsement recorded in the memo, which was issued by the branch under my authority.`,
          "The account statement and the return memo are produced from the records of the bank and are marked through me.",
        ],
        cross: [
          "It is correct that I was not personally present when the cheque was presented for collection. My evidence is on the basis of the records of the branch.",
          "I cannot say from the records whether the account holder was informed of the return of the cheque by telephone.",
        ],
      };
    case "attesting-witness":
      return {
        chief: [
          `I know both ${parties.complainant} and ${parties.accused}. I was present when the accused handed over to the complainant the ${recital}.`,
          "I signed no document at that time. What I say is what I saw and heard on that occasion.",
        ],
        cross: [
          "It is correct that I have no dealings of my own with either party. I went to the shop that day on my own business and not to witness any transaction.",
          "I am unable to state the exact date on which the cheque was handed over. I remember the occasion because the accused had come to the shop in the evening.",
        ],
      };
    case "accused":
      return {
        chief: [
          /* An individual accused deposes in their own name; a firm deposes through the
             partner or director who answers for it, and a sheet that made a firm say "I am
             the accused" would be a document no court would sign. */
          `${
            witness.name === parties.accused
              ? "I am the accused in this case."
              : `I am the ${witnessRole(witness.occupation)} of the accused firm, ${parties.accused}, and I answer this case on its behalf.`
          } It is not correct to say that the ${recital} was issued in discharge of any legally enforceable debt.`,
          "The cheque was given as a blank security at the beginning of the dealings between the parties and was misused after the accounts were settled. The amount claimed is not due.",
          "No notice of demand was received at the address claimed by the complainant.",
        ],
        cross: [
          "It is correct that the signature on the cheque is mine. I did not report the loss or misuse of the cheque to the bank or to the police.",
          "I have not produced any receipt for the payment I claim to have made in settlement of the accounts.",
        ],
      };
    case "accountant":
      return {
        chief: [
          `I am the ${witnessRole(witness.occupation)} of the accused, ${parties.accused}, and I maintain the books of account. I depose from those books.`,
          `The amount covered by the ${recital} stands settled in the books, and the entries showing the payment are produced and marked through me.`,
        ],
        cross: [
          "It is correct that the books are written by me and that there is no counter-signature of the complainant against the entries I have spoken about.",
          "I am not able to produce a bank record of the payment. The entries show a cash payment.",
        ],
      };
  }
}

/** Why the sheet has no cross-examination on it, in the court's own words. */
function crossNoteFor(deposition: WitnessDeposition): string {
  switch (deposition.cross) {
    case "declined":
      return "The witness was not cross-examined. Counsel for the other side reported that no cross-examination is required.";
    case "deferred":
      return "Cross-examination could not be taken up for want of time and is deferred to the next hearing.";
    case "completed":
      return "";
  }
}

export function buildWitnessDepositionDocument(
  deposition: WitnessDeposition,
): WitnessDepositionDocument {
  const { witness } = deposition;
  const { chief, cross } = depositionFor(deposition);
  const completed = deposition.cross === "completed";
  const dated = formatDepositionLongDate(deposition.depositionOn);

  return {
    court: `Before the ${COURT}`,
    /* The reference's own heading recites the bench's §138 jurisdiction under the court
       name. The Act is named in full here, as the rest of the repo names it, rather than
       in the reference's "NIA Act" shorthand. */
    jurisdiction:
      "Special Court for the trial of cases under Section 138 of the Negotiable Instruments Act, 1881",
    /* The reference prints this citation on the sheet. `docs/product/` does not define a
       §138 deposition form, so it is reproduced as the reference has it and nothing more
       is claimed about it — note that the court-side purposes elsewhere in this app cite
       the BNSS, which is the tension to resolve with the court and not in this file. */
    citation: "Chapter XXII, Criminal Procedure Code",
    title: "Deposition of witnesses",
    caseNumber: deposition.caseNumber,
    matter: causeTitle(deposition),
    subject: `Deposition of ${witnessTag(deposition)}, ${witnessRoleLabel(deposition)}`,
    /* The customary particulars of a deposition sheet: who the witness is, and enough
       of them to identify the same person if they are recalled. The reference's own
       preview is cut off after the name; these are the lines that follow it on the
       paper. */
    particulars: [
      { label: "Name", value: witness.name },
      { label: "Age", value: `${witness.age} years` },
      { label: "Occupation", value: witness.occupation },
      { label: "Residence", value: witness.residence },
    ],
    chief,
    cross: completed ? cross : [],
    crossNote: crossNoteFor(deposition),
    dated,
    attestation: `Recorded in open court on ${dated}, at ${PLACE}. The deposition was read over to the witness, who admitted it to be correct.`,
    signature: "Pending the signature of the magistrate.",
  };
}

export function witnessDepositionDocumentText(
  document: WitnessDepositionDocument,
): string {
  return [
    document.court,
    document.jurisdiction,
    `(${document.citation})`,
    "",
    document.title,
    `Case no. ${document.caseNumber}`,
    document.matter,
    "",
    document.subject,
    ...document.particulars.map(({ label, value }) => `${label}: ${value}`),
    "",
    "Examination-in-chief",
    ...document.chief.map((paragraph, index) => `${index + 1}. ${paragraph}`),
    "",
    "Cross-examination",
    ...(document.cross.length > 0
      ? document.cross.map((paragraph, index) => `${index + 1}. ${paragraph}`)
      : [document.crossNote]),
    "",
    document.attestation,
    document.signature,
  ].join("\n");
}

export function witnessDepositionDocumentFilename(
  deposition: WitnessDeposition,
): string {
  return `${deposition.caseNumber.replace(/\//g, "-")}-deposition-${witnessTag(
    deposition,
  ).toLowerCase()}.txt`;
}

export function downloadWitnessDepositionDocument(
  deposition: WitnessDeposition,
): void {
  const document = buildWitnessDepositionDocument(deposition);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(witnessDepositionDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = witnessDepositionDocumentFilename(voicedForDownload(deposition));
  anchor.click();
  URL.revokeObjectURL(url);
}
