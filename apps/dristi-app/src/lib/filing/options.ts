/**
 * Option lists and template copy for the e-filing flow.
 *
 * Copy is sentence case (DS Law) except legal abbreviations and proper nouns. Live
 * lookups (IFSC, PIN) live in lookups.ts; there are no mock registries here.
 */

import type { CourtId } from "@/lib/court/profiles";

import type { PaperFallbackReason } from "./types";

export type Option = { value: string; label: string };

export const CASE_TYPE = {
  code: "s138",
  short: "S-138, NI Act",
  /** The case-type column's label (owner, 2026-10-08). */
  label: "S138 of NIA",
  title: "Section 138 of Negotiable Instruments Act",
  offence: "Section 138, Negotiable Instruments Act, 1881",
  /** "Complaint under …" — the screen-length form of the proceeding's title. */
  proceedingTitleShort: "Complaint under S-138, NI Act",
  /** "Complaint under …" — the full statutory form, for PDFs (the complaint document's heading). */
  proceedingTitleLong: "Complaint under Section 138 of the Negotiable Instruments Act, 1881",
} as const;

/**
 * Dishonour of an electronic funds transfer (Section 25, Payment and Settlement Systems
 * Act, 2007). Listed on Start a new filing, but there is no filing flow for it yet — the
 * row opens a placeholder page (owner, 2026-10-08).
 */
export const PSS_CASE_TYPE = {
  code: "pss25",
  short: "S-25, PSS Act",
  /** The case-type column's label (owner, 2026-10-08). */
  label: "S25 of PSA",
  title: "Section 25 of Payment and Settlement Systems Act",
  offence: "Section 25, Payment and Settlement Systems Act, 2007",
} as const;

export const COURT = {
  name: "24×7 ON Court",
  brand: "24x7 ON Courts",
} as const;

/* ───────────────────────────── Geography ───────────────────────────── */

/** States and union territories, for the address selects. District comes from the PIN. */
export const STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

/* ───────────────────────────── Complainant ─────────────────────────── */

/** Optional — asked for the complainant (individual) and the legal representative. */
export const GENDER_OPTIONS: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export const ENTITY_TYPES: Option[] = [
  { value: "proprietorship", label: "Proprietorship" },
  { value: "partnership", label: "Partnership firm" },
  { value: "private-limited", label: "Private limited company" },
  { value: "public-limited", label: "Public limited company" },
  { value: "society-trust", label: "Society / trust" },
  { value: "llp", label: "LLP" },
];

export const AFFIDAVIT_PIP_TEMPLATE = [
  "<p>Request permission to appear and argue in person, as a party in person.</p>",
  "<p>I have not engaged any advocate for this case.</p>",
  "<p>I give an undertaking that I will maintain decorum of the Court and will not use or express objectionable and unparliamentary language or behaviour during the course of hearing in the Court premises or in any pleadings.</p>",
  "<p>Kindly grant me permission to appear in person and conduct the proceedings.</p>",
].join("");

/* ───────────────────────────── Accused ─────────────────────────────── */

export const ACCUSED_TYPES: Option[] = [
  { value: "individual", label: "Individual" },
  { value: "institution", label: "Institution" },
];

/** Legal form, asked only once the accused is an institution. */
export const ACCUSED_ENTITY_TYPES: Option[] = [
  { value: "proprietorship", label: "Proprietorship" },
  { value: "partnership", label: "Partnership firm" },
  { value: "private-limited", label: "Private limited company" },
  { value: "public-limited", label: "Public limited company" },
  { value: "society-trust", label: "Society / trust" },
  { value: "llp", label: "LLP" },
  { value: "other", label: "Other entity" },
];

/* ───────────────────────────── Cheque & return memo ────────────────── */

export const RETURN_REASONS: Option[] = [
  { value: "funds-insufficient", label: "Funds insufficient" },
  { value: "exceeds-arrangement", label: "Exceeds arrangement" },
  { value: "account-closed", label: "Account closed" },
  { value: "payment-stopped", label: "Payment stopped by drawer" },
  { value: "signature-differs", label: "Drawer's signature differs / incomplete" },
  { value: "amount-mismatch", label: "Amount in words and figures differ" },
  { value: "refer-to-drawer", label: "Refer to drawer" },
  { value: "stale-cheque", label: "Cheque post-dated / stale" },
];

/** Reasons that squarely attract S-138 — anything else shows the check-applicability warning. */
export const S138_SAFE_REASONS = new Set(["funds-insufficient", "exceeds-arrangement"]);

/* ───────────────────────────── Demand notice & debt ────────────────── */

export const NATURE_OF_DEBT: Option[] = [
  { value: "loan", label: "Loan / advance repayment" },
  { value: "goods", label: "Payment for goods supplied" },
  { value: "services", label: "Payment for services rendered" },
  { value: "business", label: "Business / trade transaction" },
  { value: "borrowed", label: "Repayment of borrowed money" },
  { value: "other", label: "Other liability" },
];

export const WHY_ISSUED: Option[] = [
  { value: "loan-repay", label: "Towards repayment of a loan" },
  { value: "goods-pay", label: "Towards payment for goods" },
  { value: "services-pay", label: "Towards payment for services" },
  { value: "security", label: "As security, subsequently enforced" },
  { value: "discharge", label: "Discharge of an existing debt" },
  { value: "other", label: "Other" },
];

export const MODE_OF_SERVICE: Option[] = [
  { value: "rpad", label: "Registered post (RPAD)" },
  { value: "speed", label: "Speed post" },
  { value: "courier", label: "Courier" },
  { value: "email", label: "Email" },
  { value: "hand", label: "Hand delivery" },
  { value: "fax", label: "Fax" },
];

export const NON_DELIVERY_REASONS: Option[] = [
  { value: "not-available", label: "Addressee not available" },
  { value: "refused", label: "Refused to accept" },
  { value: "incomplete", label: "Address incomplete / incorrect" },
  { value: "left", label: "Left without instructions" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "lost", label: "Item lost in transit" },
  { value: "other", label: "Other" },
];

export const PAYMENT_STATUS: Option[] = [
  { value: "none", label: "No payment made" },
  { value: "part", label: "Part payment made" },
];

/* ───────────────────────────── ADR & prayer ────────────────────────── */

export const INTERIM_RELIEF_TEMPLATE = [
  "<p>It is, therefore, most respectfully prayed that this Hon'ble Court may be pleased to:</p>",
  "<p>Direct the Accused to pay interim compensation to the Complainant under Section 143A of the Negotiable Instruments Act, 1881, during the pendency of the trial, of a sum not exceeding 20% of the cheque amount, within 60 days of the order or such further period not exceeding 30 days as this Hon'ble Court may allow for sufficient cause shown.</p>",
].join("");

export const FINAL_RELIEF_TEMPLATE = [
  "<p>It is most respectfully prayed that this Hon'ble Court may be pleased to:</p>",
  "<p>(a) Take cognizance of the offence committed by the Accused under Section 138 of the Negotiable Instruments Act, 1881;</p>",
  "<p>(b) Issue process / summons against the Accused and direct him/her to appear before this Hon'ble Court;</p>",
  "<p>(c) Upon trial, convict and sentence the Accused under Section 138 of the Negotiable Instruments Act, 1881, to imprisonment for a term which may extend to two years, or with fine which may extend to twice the amount of the cheque, or with both;</p>",
  "<p>(d) Direct the Accused to pay compensation to the Complainant under Section 395 of the Bharatiya Nagarik Suraksha Sanhita, 2023, equivalent to the cheque amount along with interest @ 6% per annum from the date of dishonour;</p>",
  "<p>(e) Grant such other and further relief(s) as this Hon'ble Court may deem fit and proper in the facts and circumstances of the case.</p>",
].join("");

/* ───────────────────────────── Sign & pay ──────────────────────────── */

/**
 * There is one channel, so there is no choice to offer: summons goes by e-post
 * (owner, 2026-09-03). It is still recorded on the draft, because the filing has to say
 * how the accused was served.
 */
export const DELIVERY_CHANNEL = "E-post";

/* ───────────────────────────── Signing ───────────────────────────── */

/**
 * What stopped e-signing, in plain words rather than legal ones — one reason per way
 * e-signing can fail here: each instrument (Aadhaar OTP, DSC), another signer, and the
 * e-sign service itself (owner, 2026-10-07). A slow party is not on the list: paper
 * still needs their signature by hand, so it is a party who *cannot* e-sign. Not yet
 * confirmed against what filers actually hit. Every signing window that offers paper
 * asks this; a window with one signer has nobody else, so it passes a subset rather
 * than keeping a second list.
 */
export const PAPER_FALLBACK_REASONS: readonly {
  id: PaperFallbackReason;
  label: string;
}[] = [
  { id: "otp-not-received", label: "The OTP didn't arrive" },
  { id: "dsc-not-working", label: "My DSC isn't working" },
  { id: "party-cannot-esign", label: "Another party can't e-sign" },
  { id: "server-not-responding", label: "The e-sign service isn't responding" },
  { id: "other", label: "Something else" },
];

/**
 * The processes collectable upfront, and the court's rule for each (handover §19.3).
 *
 * Two things make this more than a price list. First, **none of it is a blanket
 * opt-out**: one round of summons is mandatory, and it is mandatory *per accused* —
 * three accused carry at least three rounds. Second, the notice default is not a
 * constant: it follows the Delay Condonation section, evaluated when the bill is drawn
 * rather than cached (`PAY-11`), because a correction cycle can attract the DCA weeks
 * after the draft was started.
 *
 * Everything here is chosen per accused, independently — see `processPlan()`.
 */
export type ProcessOption = {
  key: string;
  label: string;
  /** What this process is, in the words the filer needs to choose by. */
  note: string;
  /** The same, cut to what it is for — the bill, where the choosing is already done. */
  billNote: string;
  /** Rounds the court insists on, for each accused — the choice never falls below this. */
  minRounds: number;
  /** The most rounds collectable upfront. */
  maxRounds: number;
  /** Charged for every address summons is served at, each round. */
  perAddress: boolean;
  /**
   * The nominal court fee per round (× addresses when `perAddress`) — §19.3's "small
   * court fee". It is not the delivery charge; that is `CHANNEL_FEE`, billed apart.
   */
  fee: number;
};

export const PROCESS_OPTIONS: ProcessOption[] = [
  {
    key: "summons",
    label: "Summons",
    note: "The court's call to the accused to appear. One round is required, delivered to every address you choose.",
    billNote: "The court's call to the accused to appear.",
    minRounds: 1,
    maxRounds: 4,
    perAddress: true,
    fee: 12.5,
  },
  {
    key: "warrants",
    label: "Warrants",
    note: "Issued if the accused does not appear after summons.",
    billNote: "Issued only if the accused does not appear after summons.",
    minRounds: 0,
    maxRounds: 4,
    perAddress: false,
    fee: 12.5,
  },
  {
    key: "notice",
    label: "Notice",
    note: "Issued on the application to condone the delay in filing.",
    billNote: "Issued on the application to condone the delay in filing.",
    minRounds: 0,
    maxRounds: 1,
    perAddress: false,
    fee: 12.5,
  },
];

/**
 * What one accused starts with, before the filer touches anything (`PAY-11`).
 *
 * `delayed` is the only input, and it is passed rather than stored: the notice round is
 * opted in when a Delay Condonation application applies and not otherwise, and that can
 * change under a draft that sat through a correction cycle.
 */
export function defaultProcessRounds(delayed: boolean): Record<string, number> {
  return { summons: 1, warrants: 1, notice: delayed ? 1 : 0 };
}

/**
 * What the court charges for an S-138 complaint.
 *
 * Two kinds of line, and the difference matters to the person paying. **Court fees** are
 * due before the complaint is registered at all. **Process fees** buy the delivery of
 * notice, summons and warrants to the accused — chosen round by round in
 * `PROCESS_OPTIONS` above, with the one summons round the court will not file without.
 *
 * Amounts are the sandbox's schedule: fee computation belongs to the court, not to this
 * app, and every total here is derived from these lines rather than typed in anywhere.
 *
 * ENGINEERING SEAM — a live deployment reads this schedule from the court's fee master.
 * Keep the shape: the screen needs to know which lines the filer may decline and which
 * scale with addresses and rounds, or it cannot state a truthful total.
 */
export type FeeLine = {
  key: string;
  label: string;
  /** Rupees per unit — per filing, or per address when `perAddress`. */
  amount: number;
  /** Charged once for every address process is served at. */
  perAddress?: boolean;
  /**
   * Charged once for every advocate on record, or every affidavit filed. Other states'
   * schedules (`lib/court/fees.ts`) price lines this way; Kerala's do not.
   */
  per?: "advocate" | "affidavit";
  /** Only charged when at least one advocate is on record. */
  needsAdvocate?: boolean;
  note?: string;
};

/** Due before the complaint is registered. */
export const COURT_FEE_LINES: FeeLine[] = [
  { key: "complaint", label: "Complaint fee", amount: 25 },
  { key: "legal-benefit", label: "Legal Benefit Fund", amount: 25 },
  { key: "advocate-welfare", label: "Advocate Welfare Fund", amount: 25 },
  { key: "clerk-welfare", label: "Advocate Clerk Welfare Fund", amount: 25 },
  { key: "delay-notice", label: "Court fee: delay notice", amount: 1 },
];

/** Charged only when the complaint is filed after the one-month limitation period. */
export const CONDONATION_FEE: FeeLine = {
  key: "condonation",
  label: "Application fee: condonation of delay",
  amount: 25,
  note: "Charged because this complaint is being filed after the limitation period.",
};

/**
 * What the delivery channel itself charges — not a court fee at all, which is why it is
 * billed as its own group rather than folded in with them. It rides with the summons,
 * one article per address each round, and the mandatory summons round carries it just as
 * it carries its court fee.
 *
 * Unlike the nominal court fees this one is substantial: e-post is the case the schedule
 * has to survive. ₹100 stands in for it until the real per-channel logic arrives
 * (handover §19.3 / `Q-1`) — a single placeholder rate, not a rate per channel, because
 * the others are not known.
 */
export const CHANNEL_FEE: FeeLine = {
  key: "channel",
  label: `${DELIVERY_CHANNEL} delivery of summons`,
  amount: 100,
  perAddress: true,
  note: "Placeholder e-post rate. The real charge is still to come.",
};

/**
 * Delivery is chosen separately from the summons court fee, round by round (`PAY-15`) —
 * an accused with three summons rounds prepaid may prepay delivery for one, two or
 * three of them. The floor is the mandatory first round, whose e-post is collected with
 * it, so the count runs 1 … summons rounds and never reaches zero.
 */
export const DELIVERY_MIN_ROUNDS = 1;


/* ───────────────────────────── Police stations ─────────────────────── */

/**
 * Stations in the districts this court serves. A real deployment reads these from the
 * state police directory; the list is here so the field can be searched rather than
 * typed from memory, and it stays open — an address outside it is still accepted.
 */
export const POLICE_STATIONS: string[] = [
  "Town East Police Station",
  "Town West Police Station",
  "Town Beach Police Station",
  "Kilikolloor Police Station",
  "Sakthikulangara Police Station",
  "Chinnakada Police Station",
  "Eravipuram Police Station",
  "Karunagappally Police Station",
  "Chavara Police Station",
  "Kottarakkara Police Station",
  "Punalur Police Station",
  "Pathanapuram Police Station",
  "Anchal Police Station",
  "Kunnathur Police Station",
  "Chathannoor Police Station",
  "Paravur Police Station",
  "Oachira Police Station",
  "Kadakkal Police Station",
  "Chadayamangalam Police Station",
  "Pooyappally Police Station",
];

/**
 * Stations only a Punjab and Haryana court lists — the two states share one High Court
 * (owner, 2026-10-12: "keep Panchkula for Punjab and Haryana, not for Gujarat and
 * Kerala").
 */
const PUNJAB_AND_HARYANA_STATIONS: string[] = ["Panchkula Police Station"];

/** The police stations a court's dropdowns offer. */
export function policeStationsFor(court: CourtId): string[] {
  return court === "punjab" || court === "haryana"
    ? [...POLICE_STATIONS, ...PUNJAB_AND_HARYANA_STATIONS]
    : POLICE_STATIONS;
}
