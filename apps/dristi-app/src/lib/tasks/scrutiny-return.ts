/**
 * SANDBOX DATA — the one scrutiny return the correction screen is demonstrated on.
 *
 * Eight defects across the S-138 complaint of `c-sainaba` (Sainaba K. v. Riyas M., still
 * pre-filing, so scrutiny is the step it is actually at): two cheques — including a
 * Cheque 2 instance — the complainant, the demand notice, and one whole document. The
 * officer's remark is a note on each — no proposed value, voice note or marked page.
 *
 * Nothing here has been sent to a real court. The officer's remarks are written the way
 * `ke-scrutiny-officer-2026-07` describes registry remarks — terse, and about the paper.
 */

import type { Defect, StoredFileRef } from "./types";

/** The e-filing draft this return corrects; seeded by `lib/filing/scrutiny-demo.ts`. */
export const SCRUTINY_DRAFT_ID = "draft-scrutiny-sainaba";

/** Intake slot keys the seeded draft uses — the officer's boxes are drawn on these. */
export const SCRUTINY_FILES = {
  cheque1: { id: "sc-f-c1f", name: "cheque-1-front.svg", size: 48_120, type: "image/svg+xml", ext: "SVG" },
  cheque2: { id: "sc-f-c2f", name: "cheque-2-front.svg", size: 47_640, type: "image/svg+xml", ext: "SVG" },
  adCard: { id: "sc-f-c1ad", name: "ad-card-scan.svg", size: 62_300, type: "image/svg+xml", ext: "SVG" },
  ifscEvidence: { id: "sc-f-ifsc", name: "bank-branch-certificate.svg", size: 39_880, type: "image/svg+xml", ext: "SVG" },
  memo2: { id: "sc-f-c2m", name: "cheque-2-return-memo.svg", size: 41_200, type: "image/svg+xml", ext: "SVG" },
} as const satisfies Record<string, StoredFileRef>;

/**
 * The eight defects, numbered as the officer numbered them.
 *
 * `valueAtReturn` is what scrutiny actually saw in the filing — the baseline the screen
 * measures "has this changed?" against. It must match the seeded draft; if the two drift,
 * a defect looks resolved before anyone has touched it.
 */
export const SCRUTINY_DEFECTS: Defect[] = [
  {
    n: 1,
    target: {
      kind: "field",
      step: "cheque",
      instance: 0,
      field: "ifsc",
      label: "IFSC code",
      sectionLabel: "Case details",
      instanceLabel: "Cheque 1",
    },
    note: "The IFSC does not belong to the branch named in the complaint. The branch certificate produced with the complaint reads KLGB0040213.",
    valueAtReturn: "KLGB0040231",
  },
  {
    n: 2,
    target: {
      kind: "field",
      step: "cheque",
      instance: 0,
      field: "chequeNumber",
      label: "Cheque number",
      sectionLabel: "Case details",
      instanceLabel: "Cheque 1",
    },
    note: "Cheque number is stated in four digits. The number printed on the cheque leaf is six digits — state it in full.",
    valueAtReturn: "4471",
  },
  {
    n: 3,
    target: {
      kind: "field",
      step: "cheque",
      instance: 1,
      field: "bankBranch",
      label: "Bank branch",
      sectionLabel: "Case details",
      instanceLabel: "Cheque 2",
    },
    note: "Branch for the second cheque is stated as “Main”. The cheque leaf names the branch — state it as printed.",
    valueAtReturn: "Main",
  },
  {
    n: 4,
    target: {
      kind: "field",
      step: "cheque",
      instance: 1,
      field: "amount",
      label: "Amount",
      sectionLabel: "Case details",
      instanceLabel: "Cheque 2",
    },
    note: "Amount of the second cheque does not agree with the return memo. The memo reads ₹1,85,000.",
    valueAtReturn: "85000",
  },
  {
    n: 5,
    target: {
      kind: "field",
      step: "complainant",
      instance: 0,
      field: "age",
      label: "Age",
      sectionLabel: "Parties",
      instanceLabel: "Complainant 1",
    },
    note: "Age of the complainant is not stated. It is required in the cause title.",
    valueAtReturn: "",
  },
  {
    n: 6,
    target: {
      kind: "field",
      step: "complainant",
      instance: 0,
      field: "email",
      label: "Email address",
      sectionLabel: "Parties",
      instanceLabel: "Complainant 1",
    },
    note: "The email address carries an evident typographical error and notice cannot be served on it.",
    valueAtReturn: "sainaba.k@gmial.com",
  },
  {
    n: 7,
    target: {
      kind: "field",
      step: "demand-notice",
      instance: 0,
      field: "tracking",
      label: "Tracking number",
      sectionLabel: "Case details",
      instanceLabel: "Demand notice 1",
    },
    note: "Tracking number of the registered post is not stated, though the postal receipt is produced. Enter it from the receipt.",
    valueAtReturn: "",
  },
  {
    n: 8,
    target: {
      kind: "doc",
      step: "upload",
      slotKey: "n1ad",
      label: "Proof of delivery of demand notice (AD card)",
      sectionLabel: "Documents",
    },
    /* The scan scrutiny saw; replacing the file in that slot is what clears this. */
    valueAtReturn: SCRUTINY_FILES.adCard.id,
    note: "The acknowledgement card is scanned at an angle and the date of delivery and the signature are cut off at the fold. Produce a clean scan of the whole card.",
  },
];

/* ───────────────────────── Two more returns ───────────────────────── */

/**
 * Two smaller returns, so there is more than one returned filing to fix and submit.
 * Each has its own seeded draft (`lib/filing/scrutiny-demo.ts`); as above, every
 * `valueAtReturn` must match what that draft holds.
 */
export const SCRUTINY_DRAFT_ID_LAKSHMI = "draft-scrutiny-lakshmi";
export const SCRUTINY_DRAFT_ID_RAFI = "draft-scrutiny-rafi";

/** Lakshmi Devi v. Thomas Kurian — three field defects, one cheque. */
export const SCRUTINY_DEFECTS_LAKSHMI: Defect[] = [
  {
    n: 1,
    target: {
      kind: "field",
      step: "cheque",
      instance: 0,
      field: "chequeNumber",
      label: "Cheque number",
      sectionLabel: "Case details",
      instanceLabel: "Cheque 1",
    },
    note: "Cheque number is stated in five digits. State the full six-digit number printed on the leaf.",
    valueAtReturn: "30918",
  },
  {
    n: 2,
    target: {
      kind: "field",
      step: "complainant",
      instance: 0,
      field: "age",
      label: "Age",
      sectionLabel: "Parties",
      instanceLabel: "Complainant 1",
    },
    note: "Age of the complainant is not stated. It is required in the cause title.",
    valueAtReturn: "",
  },
  {
    n: 3,
    target: {
      kind: "field",
      step: "demand-notice",
      instance: 0,
      field: "tracking",
      label: "Tracking number",
      sectionLabel: "Case details",
      instanceLabel: "Demand notice 1",
    },
    note: "Tracking number of the registered post is not stated. Enter it from the postal receipt.",
    valueAtReturn: "",
  },
];

/** Mohammed Rafi v. Suresh Babu — one field defect and one document to replace. */
export const SCRUTINY_DEFECTS_RAFI: Defect[] = [
  {
    n: 1,
    target: {
      kind: "field",
      step: "cheque",
      instance: 0,
      field: "bankBranch",
      label: "Bank branch",
      sectionLabel: "Case details",
      instanceLabel: "Cheque 1",
    },
    note: "Branch is stated as “Main”. The cheque leaf names the branch — state it as printed.",
    valueAtReturn: "Main",
  },
  {
    n: 2,
    target: {
      kind: "doc",
      step: "upload",
      slotKey: "n1ad",
      label: "Proof of delivery of demand notice (AD card)",
      sectionLabel: "Documents",
    },
    valueAtReturn: SCRUTINY_FILES.adCard.id,
    note: "The acknowledgement card is cut off at the fold; the date of delivery cannot be read. Produce a clean scan of the whole card.",
  },
];


/* ───────────────────────── more returns for the demo ───────────────────────── */

/**
 * More returned filings, so the "Returned from scrutiny" list has enough to show and to
 * practise on (owner, 2026-10-13). Each reuses one of the three seeded filings under its
 * own parties and draft id, with that filing's defects: the flagged values are the same,
 * so nothing reads as corrected before it is touched. Sandbox data.
 */
export type ExtraReturn = {
  id: string;
  caseId: string;
  draftId: string;
  base: "sainaba" | "lakshmi" | "rafi";
  complainant: string;
  accused: string;
  /** Days since scrutiny returned it. Due five days after the return (O7, as assumed). */
  returnedAgo: number;
};

export const EXTRA_RETURNS: ExtraReturn[] = [
  { id: "t-retharsha", caseId: "c-harsha", draftId: "draft-scrutiny-harsha", base: "rafi", complainant: "Harsha Patel", accused: "Dinesh Solanki", returnedAgo: 1 },
  { id: "t-retfarida", caseId: "c-farida", draftId: "draft-scrutiny-farida", base: "lakshmi", complainant: "Farida Sheikh", accused: "Kamal Traders", returnedAgo: 2 },
  { id: "t-retvikram", caseId: "c-vikram", draftId: "draft-scrutiny-vikram", base: "sainaba", complainant: "Vikram Desai", accused: "Om Sai Logistics", returnedAgo: 1 },
  { id: "t-retpriya", caseId: "c-priya", draftId: "draft-scrutiny-priya", base: "rafi", complainant: "Priya Mehta", accused: "Rajesh Bhatt", returnedAgo: 4 },
  { id: "t-retimran", caseId: "c-imran", draftId: "draft-scrutiny-imran", base: "lakshmi", complainant: "Imran Qureshi", accused: "Shreeji Textiles", returnedAgo: 0 },
  { id: "t-retgeeta", caseId: "c-geeta", draftId: "draft-scrutiny-geeta", base: "sainaba", complainant: "Geeta Rathod", accused: "Narmada Agro", returnedAgo: 3 },
];

export const DEFECTS_BY_BASE: Record<ExtraReturn["base"], Defect[]> = {
  sainaba: SCRUTINY_DEFECTS,
  lakshmi: SCRUTINY_DEFECTS_LAKSHMI,
  rafi: SCRUTINY_DEFECTS_RAFI,
};
