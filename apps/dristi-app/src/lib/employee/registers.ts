/**
 * The court's registers — what each one is, not what is in it.
 *
 * Eighteen registers from the owner's "Note On Dashboard, Reports And Registers",
 * section B. This module holds only their names, numbers, groups and descriptions, so
 * the rail and the trail can name a register without loading the generated court
 * behind it (`register-rows.ts` holds the rows and columns).
 *
 * **Registers 11–18 carry `sourceToConfirm`.** The note lists their columns, but where
 * DRISTI would get that data has not been confirmed (batta, warrants in execution, fines,
 * attendance of witnesses, calendar and committal). They are listed, with the note's
 * columns, and they hold no rows: inventing entries for them would claim the product
 * keeps records it does not.
 *
 * The names are Kerala's (CMP, ST, LPR) — the designed baseline. Another state's court
 * re-voices identifiers at display time; a register's own name is not re-voiced yet.
 */

export const REGISTERS_PAGE = { href: "/employee/registers", label: "Registers" } as const;

export type RegisterGroup =
  | "Cases and hearings"
  | "Statements"
  | "Applications and copies"
  | "Bail and evidence"
  | "Fees"
  | "Witnesses"
  | "Fines and warrants";

export const REGISTER_GROUPS: RegisterGroup[] = [
  "Cases and hearings",
  "Statements",
  "Applications and copies",
  "Bail and evidence",
  "Fees",
  "Witnesses",
  "Fines and warrants",
];

export type RegisterId =
  | "calendar"
  | "hearing-book"
  | "statements"
  | "cmp-apps"
  | "disposed"
  | "pending"
  | "bails"
  | "depositions"
  | "fees"
  | "ctc"
  | "batta"
  | "warrants"
  | "refunds"
  | "fine-statement"
  | "fine-register"
  | "attendance"
  | "committal"
  | "batta-orders";

export type RegisterView = { id: string; label: string };

export type RegisterMeta = {
  id: RegisterId;
  no: number;
  group: RegisterGroup;
  name: string;
  description: string;
  /** Sub-views, first is the default. */
  views?: RegisterView[];
  /** Listed with the note's columns; no source for its data is confirmed yet. */
  sourceToConfirm?: string[];
};

export const REGISTERS: RegisterMeta[] = [
  {
    id: "calendar",
    no: 1,
    group: "Cases and hearings",
    name: "Calendar of cases",
    description:
      "One row for every case on the file: numbers, dates, stage, status, disposal and next hearing.",
  },
  {
    id: "hearing-book",
    no: 2,
    group: "Cases and hearings",
    name: "Hearing book",
    description: "Every pending case with its proceedings so far and its previous and next posting.",
  },
  {
    id: "statements",
    no: 3,
    group: "Statements",
    name: "Statements of filing, disposal and pendency",
    description:
      "Opening pendency, cases filed, disposals, cases moved to long pending, and closing pendency.",
    views: [
      { id: "monthly", label: "Monthly (24 months)" },
      { id: "quarterly", label: "Quarterly" },
      { id: "annual", label: "Annual (financial year)" },
    ],
  },
  {
    id: "cmp-apps",
    no: 4,
    group: "Applications and copies",
    name: "Register of CMP applications",
    description: "Every application filed in a case, with its type, status, filer and dates.",
  },
  {
    id: "disposed",
    no: 5,
    group: "Cases and hearings",
    name: "Disposed cases",
    description: "Cases disposed after numbering as ST, and cases disposed at the CMP stage.",
    views: [
      { id: "st", label: "ST cases" },
      { id: "cmp", label: "CMP cases" },
    ],
  },
  {
    id: "pending",
    no: 6,
    group: "Cases and hearings",
    name: "Pending cases",
    description: "Pending ST and CMP cases, counted by the year they were numbered.",
    views: [
      { id: "st", label: "ST pending" },
      { id: "cmp", label: "CMP pending" },
    ],
  },
  {
    id: "bails",
    no: 7,
    group: "Bail and evidence",
    name: "Bails granted",
    description: "The ST number and date of each bail granted.",
  },
  {
    id: "depositions",
    no: 8,
    group: "Bail and evidence",
    name: "Witness depositions",
    description:
      "Each deposition recorded, with the witness, the party and whether it was marked as evidence.",
    views: [
      { id: "list", label: "Each deposition" },
      { id: "month", label: "Month-wise" },
    ],
  },
  {
    id: "fees",
    no: 9,
    group: "Fees",
    name: "Fees collected",
    description: "Month-wise vakalaths filed and every fee collected.",
  },
  {
    id: "ctc",
    no: 10,
    group: "Applications and copies",
    name: "Certified copy register",
    description: "Every copy application, the sheets issued and the fee collected.",
  },
  {
    id: "batta",
    no: 11,
    group: "Witnesses",
    name: "Batta and travelling allowance to witnesses",
    description:
      "Witness class, travel, fare or mileage, days, per diem and total batta, with certificate and receipt.",
    sourceToConfirm: ["Witness", "Class", "Rail / road", "Fare or mileage", "Carriage hire", "Days", "Per diem", "Total batta", "Certificate of comparison", "Receipt"],
  },
  {
    id: "warrants",
    no: 12,
    group: "Fines and warrants",
    name: "Warrants in execution of sentences",
    description:
      "Warrants issued to execute sentences, including fines, and how each was executed or why not.",
    sourceToConfirm: ["Warrant no.", "Case no. and year", "Issued against", "Particulars of requisition", "Warrant dated", "Delivered", "Returned", "Addressee", "Executed, or reason not"],
  },
  {
    id: "refunds",
    no: 13,
    group: "Fines and warrants",
    name: "Refund certificates and deposit vouchers",
    description: "Each certificate or voucher, the fine and case, the payee and the amount.",
    sourceToConfirm: ["Date", "Court imposing fine", "Case no.", "Court sanctioning refund", "Payee", "Amount", "Delivered on", "Acknowledgement"],
  },
  {
    id: "fine-statement",
    no: 14,
    group: "Fines and warrants",
    name: "Statement of fines imposed, collected and refunded",
    description: "Monthly statement of fines and compensation by case and party.",
    sourceToConfirm: ["Case and party", "Uncollected balance", "Imposed this month", "Collected this month", "Compensation (S. 250, 357)", "To local bodies", "To Government", "Written off", "Cancelled on appeal", "Refunded", "Uncollected over 3 months"],
  },
  {
    id: "fine-register",
    no: 15,
    group: "Fines and warrants",
    name: "Register of fines imposed, levied and refunded",
    description: "Each fine from imposition to treasury credit, write-off or refund.",
    sourceToConfirm: ["Imposed on", "Case no.", "Accused", "Demand", "Collected", "Collected on", "Credit to Govt / local bodies", "Compensation (S. 250, 357, 358)", "Treasury credit", "Written off", "Balance", "Refunds"],
  },
  {
    id: "attendance",
    no: 16,
    group: "Witnesses",
    name: "Attendance of witnesses",
    description: "Each witness present on a date, how they came, and what was done.",
    sourceToConfirm: ["Date", "Case", "Witness present", "By party or on summons", "Occupation", "Previous attendance", "Examined / dispensed / re-summoned", "Reason for adjournment", "Next date"],
  },
  {
    id: "committal",
    no: 17,
    group: "Cases and hearings",
    name: "Calendar and committal proceedings",
    description: "Calendar case number to result, sentence and transfer to the record room.",
    sourceToConfirm: ["Calendar case no.", "Complainant or police station", "Accused", "Offence and section", "Complaint received", "Appearance", "Trial began", "Decision", "Result", "Sentence implemented", "To record room"],
  },
  {
    id: "batta-orders",
    no: 18,
    group: "Witnesses",
    name: "Orders on witnesses’ batta and travelling allowance",
    description:
      "Attendance on each day, class, days of batta and mileage allowed, initialled by the Judge.",
    sourceToConfirm: ["Case", "Witness", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Class", "Days of batta", "Distance for mileage", "Judge’s initials"],
  },
];

export function registerById(id: string): RegisterMeta | undefined {
  return REGISTERS.find((register) => register.id === id);
}

export function registerHref(id: RegisterId, view?: string): string {
  return `${REGISTERS_PAGE.href}/${id}${view ? `?view=${encodeURIComponent(view)}` : ""}`;
}

/** The trail's name for a register: its number, which no heading on the page restates. */
export function registerCrumb(register: RegisterMeta): string {
  return `Register ${register.no}`;
}
