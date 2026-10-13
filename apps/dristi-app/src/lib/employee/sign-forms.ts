/**
 * Forms waiting on this bench's signature — the signing queue, as data.
 *
 * The sibling of `register-cases.ts`, `schedule.ts` and `rescheduling-request.ts`.
 * Those queues are cases waiting for an act of judgment: to be taken on file, given a
 * date, or answered. This one is the act's *last step* — a form the court has already
 * drawn up, sitting unsigned until the magistrate puts a signature on it. It shares the
 * court-side vocabulary (counsel, sides, the cause title, the page sizes, the listing
 * date format) rather than restating it. Only the citizen side is off limits (see
 * `content.ts`).
 *
 * **There is no backend and nothing here is signed.** `SIGN_FORM_QUEUE` is demo data
 * shaped to exercise what the screen has to survive: all three process types, a
 * corporate accused long enough to wrap the cause title, a side with no vakalat, dates
 * spread across months so the date filter has something to cut on, and enough rows to
 * page at 10, 20 and 30. No row is read from a case, a court or a signing service.
 *
 * **Signing is a screen action, not a court record.** Neither the bulk path nor the
 * single-document path applies a signature, calls an e-sign provider, writes a
 * document, or notifies anyone. Both do exactly one thing: drop the row from this demo
 * queue, the way Approve and Reject already do on the rescheduling queue. The
 * confirmation copy describes what signing *means* so the control is not misread; the
 * build performs none of it.
 *
 * **The form wording is demo text, not a court-approved form.** It is modelled on the
 * affidavit the reference screens show and filled from each row's own particulars. No
 * §138 form template is defined in `docs/product/`, so this module writes one for the
 * preview to have something real-shaped to render and claims nothing more about it.
 *
 * Numbers are `ST/…` and `CMP/…` both: a form can be drawn up before cognizance (a
 * mediation reference on a complaint still numbered CMP) or after it. These rows do not
 * overlap today's cause list, the scheduling queue, the register queue or the
 * rescheduling queue.
 */

import { CURRENT_STAFF } from "./content";
import {
  causeTitle,
  formatListingDate,
  parseIsoDay,
  type CourtCounsel,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/**
 * Which process the form belongs to — the reference's "Process type" column.
 *
 * The three the reference enumerates, and only those: a filter that offers a process
 * no row can carry is a control that only ever returns nothing. Two of them name
 * hearing purposes the cause list already knows (`plea`,
 * `examination-of-accused-351`); they are restated here rather than imported because a
 * *form type* and a *hearing purpose* are different facts that happen to share words —
 * a mediation reference is a form with no listing purpose behind it at all.
 */
export type SignFormProcessId = "examination-of-accused" | "mediation" | "plea";

export const SIGN_FORM_PROCESSES: {
  id: SignFormProcessId;
  label: string;
}[] = [
  /* Sentence case, per the DS Laws — the reference's Title Case does not survive them. */
  { id: "examination-of-accused", label: "Examination of accused" },
  { id: "mediation", label: "Mediation" },
  { id: "plea", label: "Plea" },
];

export function signFormProcessLabel(id: SignFormProcessId): string {
  return SIGN_FORM_PROCESSES.find((entry) => entry.id === id)?.label ?? id;
}

/** The cheque the §138 case is about, as the form recites it. */
export type SignFormCheque = {
  number: string;
  /** Already grouped in the Indian convention — the screen renders, it does not format. */
  amount: string;
  /** Spelled out beside the figure, the way an affidavit writes a sum. */
  amountInWords: string;
  bank: string;
  /** ISO days. */
  issuedOn: string;
  dishonouredOn: string;
  /** The banker's endorsement, in the bank's words. */
  reason: string;
};

export type SignForm = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /** Counsel on record. A side may have none — no vakalat yet. */
  counsel: CourtCounsel[];
  process: SignFormProcessId;
  /** ISO day the form was drawn up and sent for signature. */
  createdOn: string;
  /**
   * Who swore or signed the form below, as written on it. A company complains through
   * an authorised representative, an individual in their own name — the capacity line
   * is what the affidavit's opening sentence needs and cannot derive.
   */
  deponent: { name: string; capacity: string };
  cheque: SignFormCheque;
};

/** The court whose forms these are. One bench, one signing queue. */
const COURT = CURRENT_STAFF.court;

/** Where the form is sworn. The court's own seat — not a per-row fact. */
const PLACE = "Sample District";

/**
 * The forms this bench has not yet signed.
 *
 * Ordered newest first — a signing queue is worked from what was just drawn up, and
 * that is the order the reference showed. Names follow the fixtures the rest of the
 * court side uses: local parties and the same bar practising in this court.
 */
export const SIGN_FORM_QUEUE: SignForm[] = [
  {
    id: "sf-252",
    caseNumber: "ST/252/2026",
    parties: {
      complainant: "Mustanki Cooperative Co.",
      accused: "Rajesh Varma",
    },
    counsel: [
      { name: "Adv. Meera John", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    process: "examination-of-accused",
    createdOn: "2026-08-11",
    deponent: {
      name: "Tahera Mustanki",
      capacity: "Authorised representative, Mustanki Cooperative Co.",
    },
    cheque: {
      number: "123456",
      amount: "10,00,000",
      amountInWords: "Ten lakh rupees",
      bank: "Union Bank, Ernakulam branch",
      issuedOn: "2025-09-15",
      dishonouredOn: "2025-09-25",
      reason: "account closed",
    },
  },
  {
    id: "sf-757",
    caseNumber: "CMP/757/2026",
    parties: {
      complainant: "Saurabh Nandakumar",
      accused: "Thangasseri Marine Stores and Ship Chandling",
    },
    counsel: [{ name: "Adv. Nisha Thomas", side: "complainant" }],
    process: "mediation",
    createdOn: "2026-07-24",
    deponent: {
      name: "Saurabh Nandakumar",
      capacity: "Complainant",
    },
    cheque: {
      number: "884210",
      amount: "4,75,000",
      amountInWords: "Four lakh seventy-five thousand rupees",
      bank: "South Indian Bank, main branch",
      issuedOn: "2025-11-02",
      dishonouredOn: "2025-11-14",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-589",
    caseNumber: "CMP/589/2026",
    parties: { complainant: "Guruprasad Iyer", accused: "Kavitha Kaur" },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    process: "plea",
    createdOn: "2026-05-12",
    deponent: { name: "Guruprasad Iyer", capacity: "Complainant" },
    cheque: {
      number: "301994",
      amount: "2,20,000",
      amountInWords: "Two lakh twenty thousand rupees",
      bank: "Federal Bank, Chinnakada branch",
      issuedOn: "2025-08-19",
      dishonouredOn: "2025-08-29",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-143",
    caseNumber: "ST/143/2026",
    parties: { complainant: "Guru Lakshmanan", accused: "Khusboo Menon" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    process: "plea",
    createdOn: "2026-04-23",
    deponent: { name: "Guru Lakshmanan", capacity: "Complainant" },
    cheque: {
      number: "556012",
      amount: "1,15,000",
      amountInWords: "One lakh fifteen thousand rupees",
      bank: "Canara Bank, Kadappakada branch",
      issuedOn: "2025-07-04",
      dishonouredOn: "2025-07-15",
      reason: "payment stopped by drawer",
    },
  },
  {
    id: "sf-450",
    caseNumber: "CMP/450/2026",
    parties: { complainant: "Guruvayoor Traders", accused: "Bail Junior Ltd" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Anitha George", side: "accused" },
    ],
    process: "plea",
    createdOn: "2026-03-11",
    deponent: {
      name: "Devika Menon",
      capacity: "Managing partner, Guruvayoor Traders",
    },
    cheque: {
      number: "770233",
      amount: "8,40,000",
      amountInWords: "Eight lakh forty thousand rupees",
      bank: "HDFC Bank, main branch",
      issuedOn: "2025-06-21",
      dishonouredOn: "2025-07-02",
      reason: "account closed",
    },
  },
  {
    id: "sf-417",
    caseNumber: "CMP/417/2026",
    parties: { complainant: "Bindu Gurusamy", accused: "Automation Kerala" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    process: "plea",
    createdOn: "2026-02-25",
    deponent: { name: "Bindu Gurusamy", capacity: "Complainant" },
    cheque: {
      number: "119875",
      amount: "3,60,000",
      amountInWords: "Three lakh sixty thousand rupees",
      bank: "State Bank of India, Chavara branch",
      issuedOn: "2025-05-30",
      dishonouredOn: "2025-06-10",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-100",
    caseNumber: "ST/100/2026",
    parties: { complainant: "Aniket Soni", accused: "Kumar Akash" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    process: "plea",
    createdOn: "2026-02-23",
    deponent: { name: "Aniket Soni", capacity: "Complainant" },
    cheque: {
      number: "642180",
      amount: "95,000",
      amountInWords: "Ninety-five thousand rupees",
      bank: "Bank of Baroda, Mundakkal branch",
      issuedOn: "2025-04-17",
      dishonouredOn: "2025-04-28",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-74",
    caseNumber: "ST/74/2026",
    parties: {
      complainant: "Sadaf Rahman",
      accused: "Paravur Rice Mills and General Trading Pvt Ltd",
    },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    process: "examination-of-accused",
    createdOn: "2026-02-23",
    deponent: { name: "Sadaf Rahman", capacity: "Complainant" },
    cheque: {
      number: "208746",
      amount: "12,50,000",
      amountInWords: "Twelve lakh fifty thousand rupees",
      bank: "Union Bank, Paravur branch",
      issuedOn: "2025-03-12",
      dishonouredOn: "2025-03-24",
      reason: "account closed",
    },
  },
  {
    id: "sf-812",
    caseNumber: "ST/812/2025",
    parties: { complainant: "Rajan Krishnan", accused: "Quilon Cashew Exports" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    process: "examination-of-accused",
    createdOn: "2026-02-09",
    deponent: { name: "Rajan Krishnan", capacity: "Complainant" },
    cheque: {
      number: "445901",
      amount: "6,80,000",
      amountInWords: "Six lakh eighty thousand rupees",
      bank: "Indian Bank, main branch",
      issuedOn: "2025-02-05",
      dishonouredOn: "2025-02-17",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-798",
    caseNumber: "CMP/798/2025",
    parties: { complainant: "Shiny Varghese", accused: "Thevally Boat Yard" },
    counsel: [],
    process: "mediation",
    createdOn: "2026-01-28",
    deponent: { name: "Shiny Varghese", capacity: "Complainant, in person" },
    cheque: {
      number: "667312",
      amount: "1,90,000",
      amountInWords: "One lakh ninety thousand rupees",
      bank: "Federal Bank, Thevally branch",
      issuedOn: "2025-01-22",
      dishonouredOn: "2025-02-03",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-765",
    caseNumber: "ST/765/2025",
    parties: { complainant: "Ajith Kumar", accused: "Punalur Paper Depot" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    process: "plea",
    createdOn: "2026-01-16",
    deponent: { name: "Ajith Kumar", capacity: "Complainant" },
    cheque: {
      number: "903455",
      amount: "2,45,000",
      amountInWords: "Two lakh forty-five thousand rupees",
      bank: "Canara Bank, Punalur branch",
      issuedOn: "2024-12-11",
      dishonouredOn: "2024-12-23",
      reason: "payment stopped by drawer",
    },
  },
  {
    id: "sf-731",
    caseNumber: "ST/731/2025",
    parties: {
      complainant: "Leela Kumari",
      accused: "Asramam Dairy Products",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    process: "examination-of-accused",
    createdOn: "2025-12-30",
    deponent: { name: "Leela Kumari", capacity: "Complainant" },
    cheque: {
      number: "512088",
      amount: "5,25,000",
      amountInWords: "Five lakh twenty-five thousand rupees",
      bank: "South Indian Bank, Asramam branch",
      issuedOn: "2024-11-08",
      dishonouredOn: "2024-11-20",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-704",
    caseNumber: "CMP/704/2025",
    parties: { complainant: "Shihabudeen", accused: "Kottiyam Steel House" },
    counsel: [],
    process: "mediation",
    createdOn: "2025-12-18",
    deponent: { name: "Shihabudeen", capacity: "Complainant, in person" },
    cheque: {
      number: "338117",
      amount: "3,10,000",
      amountInWords: "Three lakh ten thousand rupees",
      bank: "Bank of Baroda, Kottiyam branch",
      issuedOn: "2024-10-14",
      dishonouredOn: "2024-10-26",
      reason: "account closed",
    },
  },
  {
    id: "sf-688",
    caseNumber: "ST/688/2025",
    parties: { complainant: "Geetha Nair", accused: "Chavara Minerals" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    process: "plea",
    createdOn: "2025-12-04",
    deponent: { name: "Geetha Nair", capacity: "Complainant" },
    cheque: {
      number: "774920",
      amount: "7,15,000",
      amountInWords: "Seven lakh fifteen thousand rupees",
      bank: "HDFC Bank, Chavara branch",
      issuedOn: "2024-09-19",
      dishonouredOn: "2024-10-01",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-651",
    caseNumber: "ST/651/2025",
    parties: { complainant: "Mathew Philip", accused: "Ochira Furniture Mart" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    process: "examination-of-accused",
    createdOn: "2025-11-21",
    deponent: { name: "Mathew Philip", capacity: "Complainant" },
    cheque: {
      number: "160374",
      amount: "1,35,000",
      amountInWords: "One lakh thirty-five thousand rupees",
      bank: "Indian Bank, Ochira branch",
      issuedOn: "2024-08-27",
      dishonouredOn: "2024-09-08",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-629",
    caseNumber: "CMP/629/2025",
    parties: { complainant: "Ramla Beevi", accused: "Mayyanad Fisheries" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    process: "mediation",
    createdOn: "2025-11-06",
    deponent: { name: "Ramla Beevi", capacity: "Complainant" },
    cheque: {
      number: "489261",
      amount: "2,80,000",
      amountInWords: "Two lakh eighty thousand rupees",
      bank: "Union Bank, Mayyanad branch",
      issuedOn: "2024-07-30",
      dishonouredOn: "2024-08-12",
      reason: "payment stopped by drawer",
    },
  },
  {
    id: "sf-604",
    caseNumber: "ST/604/2025",
    parties: { complainant: "Vijayakumar", accused: "Kundara Clay Works" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    process: "plea",
    createdOn: "2025-10-24",
    deponent: { name: "Vijayakumar", capacity: "Complainant" },
    cheque: {
      number: "915008",
      amount: "4,05,000",
      amountInWords: "Four lakh five thousand rupees",
      bank: "Federal Bank, Kundara branch",
      issuedOn: "2024-06-18",
      dishonouredOn: "2024-06-29",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-577",
    caseNumber: "ST/577/2025",
    parties: {
      complainant: "Soumya Rajan",
      accused: "Harbour Line Logistics Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    process: "examination-of-accused",
    createdOn: "2025-10-09",
    deponent: {
      name: "Soumya Rajan",
      capacity: "Proprietor, Rajan Marine Supplies",
    },
    cheque: {
      number: "254613",
      amount: "9,60,000",
      amountInWords: "Nine lakh sixty thousand rupees",
      bank: "State Bank of India, Neendakara branch",
      issuedOn: "2024-05-22",
      dishonouredOn: "2024-06-03",
      reason: "account closed",
    },
  },
  {
    id: "sf-548",
    caseNumber: "CMP/548/2025",
    parties: { complainant: "Haridasan", accused: "Lakeside Coir Exports" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    process: "mediation",
    createdOn: "2025-09-26",
    deponent: { name: "Haridasan", capacity: "Complainant" },
    cheque: {
      number: "607841",
      amount: "1,70,000",
      amountInWords: "One lakh seventy thousand rupees",
      bank: "Canara Bank, main branch",
      issuedOn: "2024-04-15",
      dishonouredOn: "2024-04-26",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-521",
    caseNumber: "ST/521/2025",
    parties: { complainant: "Jameela", accused: "Oachira Handlooms" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    process: "plea",
    createdOn: "2025-09-12",
    deponent: { name: "Jameela", capacity: "Complainant" },
    cheque: {
      number: "382057",
      amount: "88,000",
      amountInWords: "Eighty-eight thousand rupees",
      bank: "South Indian Bank, Oachira branch",
      issuedOn: "2024-03-08",
      dishonouredOn: "2024-03-19",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-496",
    caseNumber: "ST/496/2025",
    parties: {
      complainant: "Sreejith",
      accused: "Sasthamkotta Rice Traders",
    },
    counsel: [],
    process: "examination-of-accused",
    createdOn: "2025-08-29",
    deponent: { name: "Sreejith", capacity: "Complainant, in person" },
    cheque: {
      number: "741290",
      amount: "2,05,000",
      amountInWords: "Two lakh five thousand rupees",
      bank: "Bank of Baroda, Sasthamkotta branch",
      issuedOn: "2024-02-14",
      dishonouredOn: "2024-02-26",
      reason: "payment stopped by drawer",
    },
  },
  {
    id: "sf-470",
    caseNumber: "ST/470/2025",
    parties: { complainant: "Amina", accused: "Anchal Timber Depot" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    process: "plea",
    createdOn: "2025-08-14",
    deponent: { name: "Amina", capacity: "Complainant" },
    cheque: {
      number: "128643",
      amount: "3,45,000",
      amountInWords: "Three lakh forty-five thousand rupees",
      bank: "Indian Bank, Anchal branch",
      issuedOn: "2024-01-09",
      dishonouredOn: "2024-01-22",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-443",
    caseNumber: "CMP/443/2025",
    parties: { complainant: "Gopalakrishnan", accused: "Kilikolloor Hardware" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    process: "mediation",
    createdOn: "2025-07-31",
    deponent: { name: "Gopalakrishnan", capacity: "Complainant" },
    cheque: {
      number: "590127",
      amount: "1,25,000",
      amountInWords: "One lakh twenty-five thousand rupees",
      bank: "Union Bank, Kilikolloor branch",
      issuedOn: "2023-12-05",
      dishonouredOn: "2023-12-18",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-418",
    caseNumber: "ST/418/2025",
    parties: { complainant: "Fathima Beevi", accused: "Kadappakada Motors" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    process: "examination-of-accused",
    createdOn: "2025-07-17",
    deponent: { name: "Fathima Beevi", capacity: "Complainant" },
    cheque: {
      number: "836714",
      amount: "5,90,000",
      amountInWords: "Five lakh ninety thousand rupees",
      bank: "HDFC Bank, Kadappakada branch",
      issuedOn: "2023-11-11",
      dishonouredOn: "2023-11-23",
      reason: "account closed",
    },
  },
  {
    id: "sf-392",
    caseNumber: "ST/392/2025",
    parties: { complainant: "Yousaf", accused: "Eravipuram Cement Store" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    process: "plea",
    createdOn: "2025-07-02",
    deponent: { name: "Yousaf", capacity: "Complainant" },
    cheque: {
      number: "204558",
      amount: "1,55,000",
      amountInWords: "One lakh fifty-five thousand rupees",
      bank: "Federal Bank, Eravipuram branch",
      issuedOn: "2023-10-16",
      dishonouredOn: "2023-10-27",
      reason: "funds insufficient",
    },
  },
  {
    id: "sf-361",
    caseNumber: "ST/361/2025",
    parties: { complainant: "Kavitha", accused: "Kottarakkara Spices" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Nisha Thomas", side: "accused" },
    ],
    process: "examination-of-accused",
    createdOn: "2025-06-19",
    deponent: { name: "Kavitha", capacity: "Complainant" },
    cheque: {
      number: "659032",
      amount: "4,30,000",
      amountInWords: "Four lakh thirty thousand rupees",
      bank: "State Bank of India, Kottarakkara branch",
      issuedOn: "2023-09-04",
      dishonouredOn: "2023-09-15",
      reason: "payment stopped by drawer",
    },
  },
];

/**
 * How many forms are waiting for signature — the number the rail carries beside
 * "Sign forms".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `REGISTER_QUEUE_COUNT` is, so the rail and the screen cannot disagree about the size
 * of the queue.
 */
export const SIGN_FORM_QUEUE_COUNT = SIGN_FORM_QUEUE.length;

export type SignFormFilters = {
  process: SignFormProcessId | "all";
  /** ISO day the form was created, or `""` for any day. */
  createdOn: string;
  /**
   * Free text over the cause title, the case number and counsel — the same reach the
   * other court-side queues use. The reference labelled the box "Case Name or Number".
   */
  query: string;
};

export const EMPTY_SIGN_FORM_FILTERS: SignFormFilters = {
  process: "all",
  createdOn: "",
  query: "",
};

export function filterSignForms(
  rows: SignForm[],
  filters: SignFormFilters,
): SignForm[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((form) => {
    if (filters.process !== "all" && form.process !== filters.process) {
      return false;
    }
    if (filters.createdOn && form.createdOn !== filters.createdOn) return false;
    if (!query) return true;
    const haystack = [
      form.parties.complainant,
      form.parties.accused,
      form.caseNumber,
      ...form.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** "31 Aug 2026" — the same column register every other court-side list uses. */
export function formatSignFormDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "15 September 2025" — a date named inside the form's prose, not in a column. */
export function formatSignFormLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/**
 * The form as a document: what the preview renders and what Download writes.
 *
 * Shaped like `ReschedulingDocument` — a heading, recited particulars, numbered
 * paragraphs, and the block that signs it — so the two court-side facsimiles read as
 * one product rather than two.
 */
export type SignFormDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  /** The form's own name, e.g. "Affidavit in lieu of sworn statement". */
  title: string;
  paragraphs: string[];
  closing: string;
  dated: string;
  deponent: { name: string; capacity: string };
  /** Counsel who settled the form. Empty when the party appears in person. */
  advocate: string;
  /** The attestation line under the deponent's block. */
  attestation: string;
};

/**
 * What each process type's form says.
 *
 * Three templates, filled from the row's own particulars. The affidavit is the one the
 * reference screens show; the other two are written to the same shape so the queue has
 * three genuinely different documents to preview. All three are demo text — see the
 * module header.
 */
function paragraphsFor(form: SignForm): { title: string; body: string[] } {
  const { parties, cheque } = form;
  const recital =
    `The cheque was issued by the accused, ${parties.accused}, for the discharge of a ` +
    `legally enforceable debt vide cheque bearing no. ${cheque.number}, dated ` +
    `${formatSignFormLongDate(cheque.issuedOn)}, drawn on ${cheque.bank}, in favour of ` +
    `the complainant for ₹${cheque.amount}/- (${cheque.amountInWords}). It was ` +
    `dishonoured and returned with the endorsement "${cheque.reason}" by memo dated ` +
    `${formatSignFormLongDate(cheque.dishonouredOn)}.`;

  switch (form.process) {
    case "examination-of-accused":
      return {
        title: "Affidavit in lieu of sworn statement",
        body: [
          `I am the complainant in the above case. I know the facts of the case and I am competent to swear this affidavit. ${recital} The statutory notice issued by the complainant was served, and no payment has been made to this date.`,
          "I have produced true copies of the original documents to substantiate my claim, and the interest of justice requires that this court may be pleased to take cognizance of the offence and proceed against the accused according to law.",
        ],
      };
    case "plea":
      return {
        title: "Form for recording the plea of the accused",
        body: [
          `The substance of the accusation in this case was stated to the accused, ${parties.accused}, in a language understood by them. ${recital}`,
          "The accused was asked whether they plead guilty to the accusation or claim to be tried, and the answer given was recorded in the accused's own words in the presence of this court.",
        ],
      };
    case "mediation":
      return {
        title: "Reference of the case to mediation",
        body: [
          `On a reading of the complaint it appears to this court that there exist elements of a settlement which the parties may find acceptable. ${recital}`,
          `The case is referred to the mediation centre attached to this court, and the parties, ${parties.complainant} and ${parties.accused}, are directed to appear before the mediator on the date the centre appoints.`,
        ],
      };
  }
}

export function buildSignFormDocument(form: SignForm): SignFormDocument {
  const { title, body } = paragraphsFor(form);
  const complainantCounsel = form.counsel.find(
    (counsel) => counsel.side === "complainant",
  );
  const dated = formatSignFormLongDate(form.createdOn);

  return {
    court: COURT,
    caseNumber: form.caseNumber,
    matter: causeTitle(form),
    title,
    paragraphs: body,
    closing: "All the facts stated above are true and correct.",
    dated,
    deponent: form.deponent,
    advocate: complainantCounsel?.name ?? "",
    attestation:
      form.process === "examination-of-accused"
        ? `Solemnly affirmed and signed before me by the deponent, personally known to me, on this the ${dated}, at ${PLACE}.`
        : `Read over and signed in the presence of this court on this the ${dated}, at ${PLACE}.`,
  };
}

export function signFormDocumentText(document: SignFormDocument): string {
  return [
    document.court,
    `Case no. ${document.caseNumber}`,
    document.matter,
    "",
    document.title,
    "",
    ...document.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`,
    ),
    "",
    document.closing,
    `Dated this the ${document.dated}.`,
    "",
    "Deponent:",
    document.deponent.name,
    document.deponent.capacity,
    "",
    document.attestation,
    ...(document.advocate ? ["", `Advocate: ${document.advocate}`] : []),
  ].join("\n");
}

export function signFormDocumentFilename(form: SignForm): string {
  return `${form.caseNumber.replace(/\//g, "-")}-${form.process}.txt`;
}

export function downloadSignFormDocument(form: SignForm): void {
  const document = buildSignFormDocument(form);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(signFormDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = signFormDocumentFilename(voicedForDownload(form));
  anchor.click();
  URL.revokeObjectURL(url);
}
