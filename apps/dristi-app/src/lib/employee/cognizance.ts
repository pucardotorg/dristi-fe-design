/**
 * Complaints on the register waiting for the magistrate to take cognizance — the queue,
 * and the sheet of facts behind each row.
 *
 * The sibling of `register-cases.ts`, one step later in a complaint's life. That module
 * is complaints not yet on the register, and the question its screen asks is *is this
 * file right* — the magistrate reading behind the scrutiny officer, with a send-back at
 * the end of it. This one is complaints already registered, and the question is a
 * different one: *should this case go ahead*. Same court, same vocabulary, same
 * furniture; a different act, hours later (owner, 2026-09-14).
 *
 * Registering is **not** taking cognizance. Registering puts a complaint on the register
 * and gives it a number; cognizance is the judicial act that follows, and it is what
 * turns a `CMP/…` into an `ST/…` (`schedule.ts`, `other-applications.ts`). The register
 * screen used to say otherwise in as many words; it no longer does.
 *
 * **There is no backend.** `COGNIZANCE_QUEUE` is demo data, and every date on a file is
 * *derived from its row* rather than transcribed — the same bargain `case-review.ts`
 * strikes, for the same three reasons: every row has to open a file, the §138 chain has
 * to hold together backwards from one anchor, and thirty files sharing one cheque date
 * is the first thing a clerk would spot. Nothing here is read from a case or a court.
 *
 * **One knob per fact that matters.** A row carries `filedAfterCauseDays`, and the delay
 * the queue's column shows and the delay the file's block shows are both read off it —
 * so the list and the screen it opens cannot disagree about whether a complaint was
 * late. Same for the notice window and the branch: the check and the fact it is read
 * from come from one value, never from two that have to be kept in step.
 *
 * **The notice check counts from the date on the return memo** (cheat sheet v4), which the
 * filing carries (`CHQ-9`). The *date of receipt of information about return* the check
 * used to run from was dropped from the PRD in v3, and from this module with it.
 *
 * Terms are the PRD's own field names, in sentence case because the DS Laws do not keep
 * Title Case. The limitation and notice checks are the PRD's, and their sentences are
 * quoted from it rather than rewritten.
 */

import type { CaseRecord } from "@/lib/cases/types";
import { COURT_DISTRICT, CURRENT_STAFF } from "./content";
import {
  formatListingDate,
  isoDay,
  parseIsoDay,
  type CourtCounsel,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";

/* ────────────────────────────────── the row ─────────────────────────────────── */

export type CognizanceCase = {
  id: string;
  /** `CMP/…`. Cognizance is what renumbers it; every row here is before that. */
  caseNumber: string;
  /** What the e-filing was called before the register gave it a number. */
  filingNumber: string;
  parties: { complainant: string; accused: string };
  /** Counsel on record. A complaint may still have none. */
  counsel: CourtCounsel[];
  /**
   * How long the complaint has been on the register waiting for this act, in whole
   * days. The anchor the whole date chain is derived backwards from, and stored as a
   * count rather than a date so the demo does not drift as the fixture sits.
   */
  daysSinceRegistered: number;
  /**
   * Days from the cause of action to the day the complaint was filed.
   *
   * §142(b) allows a month. Past that the complaint is late and a condonation
   * application comes with it, so this one number decides the queue's Delay column, the
   * file's delay block, the limitation check and which action the footer offers.
   */
  filedAfterCauseDays: number;
  /** Grounds pleaded in the condonation application. Only a late complaint has one. */
  grounds: string | null;
  /**
   * Days from the date on the (earliest) return memo to the dispatch of the demand notice.
   * The PRD counts the thirty days from the return memo (cheat sheet v4); past that the
   * complaint is bad on its face.
   */
  noticeAfterDays: number;
  /** Whether the demand notice reached the drawer. */
  noticeDelivered: boolean;
  /** Why it did not, when it did not. */
  nonDeliveryReason: string | null;
  /**
   * Whether the cheque went into the complainant's own account.
   *
   * Decides which branch the file prints, and therefore which branch the jurisdiction
   * check reads — §142(2)(a) puts a §138 complaint where the payee's branch lies.
   */
  depositedByComplainant: boolean;
  /** The branch that matters, and the place it stands in. */
  branch: { bank: string; branch: string; place: string };
  /**
   * The cheques the complaint is on — one, usually. The PRD repeats the cheque's facts and
   * files per cheque (cheat sheet §4–§5), so each carries its own. The first is the one
   * whose memo came back earliest, which is the memo the notice check counts from.
   */
  cheques: CognizanceCheque[];
};

export type CognizanceCheque = {
  /** Days between the date on the cheque and its presentation. Within the three months. */
  presentedAfterDays: number;
  /** What the bank wrote on the return memo. */
  returnReason: string;
  /** Days after the first cheque's memo this one's came back. The first is 0. */
  returnedAfterFirstDays: number;
};

/**
 * The place this court sits, read off the one constant that already names it rather
 * than written down a second time — a second copy is a second thing to get wrong.
 */
export const COURT_PLACE = COURT_DISTRICT;

/** The month §142(b) allows for filing, in days. */
export const LIMITATION_DAYS = 30;

/** The days the PRD allows for the demand notice, from the date on the return memo. */
export const NOTICE_WINDOW_DAYS = 30;

/** The days §138(c) gives the drawer to pay, from service of the notice. */
export const NOTICE_PERIOD_DAYS = 15;

/**
 * How long registration takes after filing, and how long service takes after dispatch.
 *
 * Both are demo constants and both are named rather than inlined, because a reader
 * checking the arithmetic on a file should be able to find the two numbers that are not
 * a row's own.
 */
const FILING_TO_REGISTER_DAYS = 3;
const DISPATCH_TO_SERVICE_DAYS = 3;

/** Days a cheque sat in clearing before it came back. */
const PRESENTED_TO_RETURN_DAYS = 2;

/* ───────────────────────────────── the queue ────────────────────────────────── */

/**
 * The complaints on this court's register that have not been taken cognizance of.
 *
 * Ordered longest wait first. Names are local parties and the same bar as the rest of
 * the court side — one court, one set of advocates practising in it — and none of these
 * matters appears in another queue.
 *
 * The list is shaped to exercise what the screens have to survive: complaints in time
 * and complaints late, a branch outside this court's place, a notice sent past the
 * thirty days, a notice that never arrived, a corporate accused long enough to wrap a
 * cause title, a side with several counsel, a complaint with no vakalat at all, and
 * enough rows to page at 10, 20 and 30.
 */
export const COGNIZANCE_QUEUE: CognizanceCase[] = [
  {
    /* The worst-case complaint, first in the queue on purpose: it trips every check a
       magistrate makes before cognizance at once — filed late (with a condonation
       application), the demand notice sent past the thirty days, and the payee's branch in
       another district — so the file carries all three findings and the fullest set of
       rows. It is the density the layout has to hold, not a typical matter (owner,
       2026-09-16). */
    id: "c-2041",
    caseNumber: "CMP/2041/2025",
    filingNumber: "KL-001629-2025",
    parties: { complainant: "Sainaba Beevi", accused: "Thangasseri Marine Exports" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    daysSinceRegistered: 46,
    filedAfterCauseDays: 50,
    grounds:
      "The complainant was admitted to hospital for a month from 20 February and could not instruct counsel in that time.",
    /* Past the thirty days §138(b) allows — the notice-window check fires against the
       dispatch date. */
    noticeAfterDays: 42,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    /* The payee's branch is in Ernakulam, not this court's district — §142(2)(a) puts the
       complaint where that branch lies, so the jurisdiction check fires. */
    branch: { bank: "South Indian Bank", branch: "Ernakulam South", place: "Ernakulam" },
    cheques: [{ presentedAfterDays: 21, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-2038",
    caseNumber: "CMP/2038/2025",
    filingNumber: "KL-001604-2025",
    parties: { complainant: "Benny Mathew", accused: "Kadappakada Motors" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceRegistered: 43,
    filedAfterCauseDays: 18,
    grounds: null,
    noticeAfterDays: 9,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Federal Bank", branch: "Kadappakada", place: "Sample District" },
    /* Two cheques on one complaint, so the per-cheque facts and files have a file to be
       judged on (cheat sheet §4–§5). The second came back four days after the first. */
    cheques: [
      { presentedAfterDays: 14, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 },
      { presentedAfterDays: 9, returnReason: "Exceeds arrangement", returnedAfterFirstDays: 4 },
    ],
  },
  {
    id: "c-2030",
    caseNumber: "CMP/2030/2025",
    filingNumber: "KL-001588-2025",
    parties: {
      complainant: "Vijayamma",
      accused: "Paravur Rice Mills and General Trading Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Nisha Thomas", side: "complainant" },
    ],
    daysSinceRegistered: 41,
    filedAfterCauseDays: 26,
    grounds: null,
    /* Past the thirty days §138(b) allows — the check the file carries against the
       dispatch date. */
    noticeAfterDays: 38,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "State Bank of India", branch: "Asramam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 33, returnReason: "Exceeds arrangement", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-2022",
    caseNumber: "CMP/2022/2025",
    filingNumber: "KL-001571-2025",
    parties: { complainant: "Rahim Kunju", accused: "Mundakkal Auto Parts" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    daysSinceRegistered: 38,
    filedAfterCauseDays: 11,
    grounds: null,
    noticeAfterDays: 20,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Canara Bank", branch: "Kottiyam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 8, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-2015",
    caseNumber: "CMP/2015/2025",
    filingNumber: "KL-001552-2025",
    parties: { complainant: "Girija Devi", accused: "Bandra Fine Chemicals" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    daysSinceRegistered: 35,
    filedAfterCauseDays: 22,
    grounds: null,
    noticeAfterDays: 14,
    noticeDelivered: true,
    nonDeliveryReason: null,
    /* Deposited in the drawer's branch, and that branch is not in this court's place —
       the jurisdiction check the file carries against the branch. */
    depositedByComplainant: false,
    branch: { bank: "IDFC First Bank", branch: "Bandra West", place: "Mumbai" },
    cheques: [{ presentedAfterDays: 19, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-2009",
    caseNumber: "CMP/2009/2025",
    filingNumber: "KL-001530-2025",
    parties: { complainant: "Noushad", accused: "Perinad Agro Mills" },
    counsel: [],
    daysSinceRegistered: 33,
    filedAfterCauseDays: 44,
    grounds:
      "The complainant was away from the State on work and learnt of the return only after he came back.",
    noticeAfterDays: 7,
    noticeDelivered: false,
    nonDeliveryReason: "Addressee moved from the address on record",
    depositedByComplainant: true,
    branch: { bank: "Union Bank of India", branch: "Punalur", place: "Sample District" },
    cheques: [{ presentedAfterDays: 27, returnReason: "Account closed", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1998",
    caseNumber: "CMP/1998/2025",
    filingNumber: "KL-001512-2025",
    parties: { complainant: "Sulekha", accused: "Chathannoor Tiles" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    daysSinceRegistered: 30,
    filedAfterCauseDays: 9,
    grounds: null,
    noticeAfterDays: 16,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "South Indian Bank", branch: "Karunagappally", place: "Sample District" },
    cheques: [{ presentedAfterDays: 12, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1987",
    caseNumber: "CMP/1987/2025",
    filingNumber: "KL-001498-2025",
    parties: { complainant: "Thankamani", accused: "Eravipuram Cement Store" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    daysSinceRegistered: 28,
    filedAfterCauseDays: 37,
    grounds:
      "The papers were with the complainant's previous counsel, who returned the file only in the last week of March.",
    noticeAfterDays: 11,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Federal Bank", branch: "Chinnakada", place: "Sample District" },
    cheques: [{ presentedAfterDays: 16, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1975",
    caseNumber: "CMP/1975/2025",
    filingNumber: "KL-001476-2025",
    parties: { complainant: "Pradeep Kumar", accused: "Kilikolloor Hardware" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceRegistered: 26,
    filedAfterCauseDays: 5,
    grounds: null,
    noticeAfterDays: 24,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Canara Bank", branch: "Kottiyam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 41, returnReason: "Exceeds arrangement", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1966",
    caseNumber: "CMP/1966/2025",
    filingNumber: "KL-001455-2025",
    parties: { complainant: "Zainaba", accused: "Sasthamkotta Rice Traders" },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "complainant" },
    ],
    daysSinceRegistered: 24,
    filedAfterCauseDays: 29,
    grounds: null,
    noticeAfterDays: 18,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "State Bank of India", branch: "Asramam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 23, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1954",
    caseNumber: "CMP/1954/2025",
    filingNumber: "KL-001431-2025",
    parties: { complainant: "Jayaprakash", accused: "Ernakulam Packaging Works" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    daysSinceRegistered: 22,
    filedAfterCauseDays: 41,
    grounds:
      "The complainant's mother died on 3 March and the family was in mourning for the month that followed.",
    noticeAfterDays: 13,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: false,
    branch: { bank: "Bank of Baroda", branch: "Kaloor", place: "Ernakulam" },
    cheques: [{ presentedAfterDays: 17, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1943",
    caseNumber: "CMP/1943/2025",
    filingNumber: "KL-001417-2025",
    parties: { complainant: "Omana", accused: "Mayyanad Fisheries" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    daysSinceRegistered: 20,
    filedAfterCauseDays: 15,
    grounds: null,
    noticeAfterDays: 6,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "South Indian Bank", branch: "Mundakkal", place: "Sample District" },
    cheques: [{ presentedAfterDays: 9, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1931",
    caseNumber: "CMP/1931/2025",
    filingNumber: "KL-001402-2025",
    parties: { complainant: "Abdul Salam", accused: "Anchal Timber Depot" },
    counsel: [],
    daysSinceRegistered: 18,
    filedAfterCauseDays: 33,
    grounds:
      "The complainant was under treatment after a road accident on 12 February and could not travel to the court.",
    noticeAfterDays: 21,
    noticeDelivered: false,
    nonDeliveryReason: "Refused to accept",
    depositedByComplainant: true,
    branch: { bank: "Federal Bank", branch: "Punalur", place: "Sample District" },
    cheques: [{ presentedAfterDays: 30, returnReason: "Payment stopped by drawer", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1920",
    caseNumber: "CMP/1920/2025",
    filingNumber: "KL-001388-2025",
    parties: { complainant: "Remani", accused: "Kavanad Super Bazaar" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    daysSinceRegistered: 16,
    filedAfterCauseDays: 24,
    grounds: null,
    noticeAfterDays: 10,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Canara Bank", branch: "Chinnakada", place: "Sample District" },
    cheques: [{ presentedAfterDays: 11, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1912",
    caseNumber: "CMP/1912/2025",
    filingNumber: "KL-001370-2025",
    parties: { complainant: "Hari Kumar", accused: "Kureepuzha Builders" },
    counsel: [{ name: "Adv. Nisha Thomas", side: "complainant" }],
    daysSinceRegistered: 14,
    filedAfterCauseDays: 7,
    grounds: null,
    /* Well past the thirty days — the second file in the queue that carries the
       notice check, so the screen can be judged on more than one. */
    noticeAfterDays: 45,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Union Bank of India", branch: "Kottiyam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 25, returnReason: "Exceeds arrangement", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1904",
    caseNumber: "CMP/1904/2025",
    filingNumber: "KL-001354-2025",
    parties: { complainant: "Beena", accused: "Polayathode Cold Storage" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceRegistered: 12,
    filedAfterCauseDays: 20,
    grounds: null,
    noticeAfterDays: 8,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "South Indian Bank", branch: "Karunagappally", place: "Sample District" },
    cheques: [{ presentedAfterDays: 6, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1893",
    caseNumber: "CMP/1893/2025",
    filingNumber: "KL-001339-2025",
    parties: { complainant: "Sudheer", accused: "Oachira Handlooms" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    daysSinceRegistered: 10,
    filedAfterCauseDays: 48,
    grounds:
      "The complainant was abroad on a work visa and returned only on 8 April, when he instructed counsel.",
    noticeAfterDays: 15,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Federal Bank", branch: "Asramam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 13, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1885",
    caseNumber: "CMP/1885/2025",
    filingNumber: "KL-001322-2025",
    parties: { complainant: "Lekha", accused: "Kottarakkara Spices" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    daysSinceRegistered: 9,
    filedAfterCauseDays: 13,
    grounds: null,
    noticeAfterDays: 25,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "State Bank of India", branch: "Chathannoor", place: "Sample District" },
    cheques: [{ presentedAfterDays: 20, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1877",
    caseNumber: "CMP/1877/2025",
    filingNumber: "KL-001308-2025",
    parties: { complainant: "Muhammed Ali", accused: "Parippally Feeds" },
    counsel: [],
    daysSinceRegistered: 7,
    filedAfterCauseDays: 28,
    grounds: null,
    noticeAfterDays: 19,
    noticeDelivered: false,
    nonDeliveryReason: "Door locked on three attempts",
    depositedByComplainant: true,
    branch: { bank: "Canara Bank", branch: "Mundakkal", place: "Sample District" },
    cheques: [{ presentedAfterDays: 15, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1866",
    caseNumber: "CMP/1866/2025",
    filingNumber: "KL-001291-2025",
    parties: { complainant: "Prasanna", accused: "Adichanalloor Traders" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    daysSinceRegistered: 6,
    filedAfterCauseDays: 39,
    grounds:
      "The complainant's counsel was on leave through March and the papers could not be settled before he returned.",
    noticeAfterDays: 12,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Union Bank of India", branch: "Chinnakada", place: "Sample District" },
    cheques: [{ presentedAfterDays: 18, returnReason: "Exceeds arrangement", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1858",
    caseNumber: "CMP/1858/2025",
    filingNumber: "KL-001277-2025",
    parties: { complainant: "Radhakrishnan", accused: "Thevally Boat Yard" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    daysSinceRegistered: 5,
    filedAfterCauseDays: 3,
    grounds: null,
    noticeAfterDays: 27,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "South Indian Bank", branch: "Kottiyam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 7, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1847",
    caseNumber: "CMP/1847/2025",
    filingNumber: "KL-001260-2025",
    parties: { complainant: "Salma", accused: "Thiruvananthapuram Steel Traders" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "complainant" },
    ],
    daysSinceRegistered: 4,
    filedAfterCauseDays: 17,
    grounds: null,
    noticeAfterDays: 22,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: false,
    branch: { bank: "Indian Bank", branch: "Vazhuthacaud", place: "Thiruvananthapuram" },
    cheques: [{ presentedAfterDays: 10, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1836",
    caseNumber: "CMP/1836/2025",
    filingNumber: "KL-001244-2025",
    parties: { complainant: "Anilkumar", accused: "Kundara Clay Works" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceRegistered: 3,
    filedAfterCauseDays: 35,
    grounds:
      "The complainant was in judicial custody in another matter until 14 March and could not file in time.",
    noticeAfterDays: 9,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Federal Bank", branch: "Kadappakada", place: "Sample District" },
    cheques: [{ presentedAfterDays: 24, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
  {
    id: "c-1825",
    caseNumber: "CMP/1825/2025",
    filingNumber: "KL-001228-2025",
    parties: { complainant: "Vasanthi", accused: "Mevaram Furniture" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    daysSinceRegistered: 1,
    filedAfterCauseDays: 8,
    grounds: null,
    noticeAfterDays: 11,
    noticeDelivered: true,
    nonDeliveryReason: null,
    depositedByComplainant: true,
    branch: { bank: "Canara Bank", branch: "Asramam", place: "Sample District" },
    cheques: [{ presentedAfterDays: 5, returnReason: "Funds insufficient", returnedAfterFirstDays: 0 }],
  },
];

/**
 * How many complaints are waiting for cognizance — the number the rail carries.
 * Derived from the list so the rail and the screen cannot disagree.
 */
export const COGNIZANCE_QUEUE_COUNT = COGNIZANCE_QUEUE.length;

/** One waiting complaint, or nothing. Asked by the screen and by the trail. */
export function cognizanceCaseById(id: string): CognizanceCase | undefined {
  return COGNIZANCE_QUEUE.find((entry) => entry.id === id);
}

/**
 * The row after this one, for the file's own "Next complaint". Nothing at the end.
 *
 * **On the same tab.** Since the queue split in two, the complaint after a late one is
 * the next late one — walking into the other tab would hand the bench a different act
 * on a complaint they had not chosen to look at.
 */
export function nextCognizanceCase(id: string): CognizanceCase | undefined {
  const matter = cognizanceCaseById(id);
  if (!matter) return undefined;
  const siblings = casesOnTab(COGNIZANCE_QUEUE, tabFor(matter));
  return siblings[siblings.findIndex((entry) => entry.id === id) + 1];
}

/* ───────────────────────────────── the delay ────────────────────────────────── */

/**
 * Days past the month §142(b) allows, or `null` when the complaint was filed in time.
 *
 * Derived, never stored: the column, the file's delay block, the limitation check and
 * the footer's own action all read this one function, so they cannot fall out of step.
 */
export function delayDays(matter: CognizanceCase): number | null {
  const over = matter.filedAfterCauseDays - LIMITATION_DAYS;
  return over > 0 ? over : null;
}

/** Whether this complaint came late. The queue's column, in one word. */
export function hasDelay(matter: CognizanceCase): boolean {
  return delayDays(matter) !== null;
}

/* ───────────────────────────────── the chain ────────────────────────────────── */

/**
 * The §138 chain behind one complaint, worked backwards from the day it was registered.
 *
 * Backwards, because the row's one anchor is a wait, and a chain derived forwards from a
 * fixed date would drift as the fixture sits. Every date below is a consequence of the
 * row and the statutory windows — nothing is transcribed, and nothing can contradict the
 * check that reads it.
 */
export type CognizanceChain = {
  /** One per cheque, in the row's order. The first memo is the earliest. */
  cheques: CognizanceChequeChain[];
  noticeDispatchedOn: string;
  /** The day it reached the drawer, or `null` when it never did. */
  noticeDeliveredOn: string | null;
  /** The day it came back undelivered, or `null` when it was delivered. */
  noticeReturnedOn: string | null;
  /** Delivery or return — the day the fifteen days start running from either way. */
  deemedServedOn: string;
  /** The fifteen days are up; the offence is complete and the cause of action accrues. */
  causeOfActionOn: string;
  filedOn: string;
  registeredOn: string;
};

export type CognizanceChequeChain = {
  chequeDatedOn: string;
  presentedOn: string;
  /** The date on the return memo. The first cheque's is what the notice check counts from. */
  returnedOn: string;
};

function plus(day: string, days: number): string {
  return minus(day, -days);
}

function minus(day: string, days: number): string {
  const date = parseIsoDay(day);
  date.setDate(date.getDate() - days);
  return isoDay(date);
}

export function chainFor(matter: CognizanceCase, today: string): CognizanceChain {
  const registeredOn = minus(today, matter.daysSinceRegistered);
  const filedOn = minus(registeredOn, FILING_TO_REGISTER_DAYS);
  const causeOfActionOn = minus(filedOn, matter.filedAfterCauseDays);
  const deemedServedOn = minus(causeOfActionOn, NOTICE_PERIOD_DAYS);
  const noticeDispatchedOn = minus(deemedServedOn, DISPATCH_TO_SERVICE_DAYS);
  const firstReturnedOn = minus(noticeDispatchedOn, matter.noticeAfterDays);
  const cheques = matter.cheques.map((cheque) => {
    const returnedOn = plus(firstReturnedOn, cheque.returnedAfterFirstDays);
    const presentedOn = minus(returnedOn, PRESENTED_TO_RETURN_DAYS);
    const chequeDatedOn = minus(presentedOn, cheque.presentedAfterDays);
    return { chequeDatedOn, presentedOn, returnedOn };
  });

  return {
    cheques,
    noticeDispatchedOn,
    noticeDeliveredOn: matter.noticeDelivered ? deemedServedOn : null,
    noticeReturnedOn: matter.noticeDelivered ? null : deemedServedOn,
    deemedServedOn,
    causeOfActionOn,
    filedOn,
    registeredOn,
  };
}

/* ──────────────────────────────── the findings ──────────────────────────────── */

export type CognizanceFindingId = "limitation" | "notice-window" | "jurisdiction";

/**
 * How much a finding matters.
 *
 * Two, and the difference is the whole point. `critical` is a defect in the complaint
 * itself — something that can end it. `note` is a fact the magistrate has to decide
 * about, and deciding it is ordinary work: a complaint filed late with a condonation
 * application on record is exactly what §142(b)'s proviso contemplates, and painting it
 * the same colour as a bad notice would tell the bench that the normal path is an error
 * (owner, 2026-09-14).
 */
export type CognizanceFindingWeight = "critical" | "note";

export type CognizanceFinding = {
  id: CognizanceFindingId;
  weight: CognizanceFindingWeight;
  /** The sentence the PRD gives this check, quoted rather than rewritten. */
  statement: string;
  /** What follows from it, where the PRD's sentence leaves the consequence unsaid. */
  consequence: string;
  /** The term on the file this was read from, so the arithmetic can be checked. */
  term: string;
};

/** The term each check reads. Named once, so the finding and the fact cannot drift. */
export const FILED_ON_TERM = "Date of complaint filing";
export const NOTICE_DISPATCHED_TERM = "Date of dispatch of demand notice";

/** The branch term changes with whose account the cheque went into. */
export function branchTerm(matter: CognizanceCase): string {
  return matter.depositedByComplainant
    ? "Bank branch (complainant)"
    : "Bank branch (accused)";
}

/**
 * What the checks say about one complaint, worst first.
 *
 * Critical before note, because the order is the reading order: a bench that has to
 * decide three things should meet the one that can end the case before the one that is
 * ordinary work.
 */
export function findingsFor(matter: CognizanceCase): CognizanceFinding[] {
  const findings: CognizanceFinding[] = [];

  if (matter.noticeAfterDays > NOTICE_WINDOW_DAYS) {
    findings.push({
      id: "notice-window",
      weight: "critical",
      statement:
        "Demand notice not issued within 30 days of the return of the cheque as unpaid.",
      consequence: `The notice went out ${matter.noticeAfterDays} days after the date on the return memo.`,
      term: NOTICE_DISPATCHED_TERM,
    });
  }

  if (matter.branch.place !== COURT_PLACE) {
    findings.push({
      id: "jurisdiction",
      weight: "critical",
      statement: "The complaint is likely outside the jurisdiction of this court.",
      consequence: `The branch that matters stands at ${matter.branch.place}, not ${COURT_PLACE}.`,
      term: branchTerm(matter),
    });
  }

  const late = delayDays(matter);
  if (late !== null) {
    findings.push({
      id: "limitation",
      weight: "note",
      statement: "The complaint is outside the limitation period.",
      consequence: `Filed ${late} ${late === 1 ? "day" : "days"} beyond the month, with an application to condone the delay awaiting your decision.`,
      term: FILED_ON_TERM,
    });
  }

  return findings;
}

/** The finding that belongs against one term, when a check read it. */
export function findingForTerm(
  findings: CognizanceFinding[],
  term: string,
): CognizanceFinding | undefined {
  return findings.find((finding) => finding.term === term);
}

/* ───────────────────────────── the case summary ─────────────────────────────── */

/**
 * The court's registration number (CNR) for a registered complaint.
 *
 * Derived from the filing number so it stays stable for the demo — a real CNR is assigned
 * at registration and is not computable from anything, but this is fixture data and must
 * not drift as the fixture sits. The shape follows the CIS convention: state and
 * district-establishment, the six-figure filing serial, then the year.
 */
export function cnrFor(matter: CognizanceCase): string {
  const digits = matter.filingNumber.replace(/\D/g, "");
  const serial = digits.slice(0, 6).padStart(6, "0");
  const year = matter.filingNumber.slice(-4);
  return `KLKM01${serial}${year}`;
}

/**
 * One row of the case summary — a labelled field of the reference's left column.
 *
 * `source` is the document the value is read off (a `cognizanceDocumentsFor` key); the screen
 * turns it into the region the scroller marks when the row is clicked. `note` is a quiet
 * second line (a branch's place). The findings are not carried here — they are matched to a
 * row by term on the screen and shown inline beneath it (`findingsFor`).
 */
export type CognizanceField = {
  id: string;
  term: string;
  value: string;
  note?: string;
  source?: string;
  /** The PRD's tooltip for the term, where it gives one (cheat sheet §4). */
  tooltip?: string;
};

/**
 * One chunk of the case summary — a head and its fields, all single column.
 *
 * The summary is grouped, not one flat run of rows (owner, 2026-09-14: chunk it, and keep
 * every chunk the same shape). The chunks are the §138 chain's own stages, the vocabulary
 * `case-review.ts` already uses — the complaint, the cheque, its dishonour, the demand
 * notice, the jurisdiction — so a reader lands on the part they want instead of scanning
 * eleven undifferentiated rows.
 */
export type CognizanceChunk = {
  id: string;
  label: string;
  /**
   * A caption the screen prints over the chunk. The chunks are otherwise unnamed (owner,
   * 2026-09-15); only a complaint on several cheques needs to say which cheque a run of
   * dates belongs to, so only there does the first chunk of each cheque carry one.
   */
  caption?: string;
  fields: CognizanceField[];
};

/**
 * The case summary, in chunks, in the reference's order (owner, 2026-09-14).
 *
 * A late complaint opens with the Complaint chunk — the filing date and the two delay rows;
 * a timely one omits it and opens on the cheque, the way the reference's With-Delay and
 * Without-Delay frames differ. Then the cheque, its dishonour, the demand notice, and — last
 * — the branch that founds jurisdiction. Dates are shown directly, with no statutory-window
 * annotations: the reference lists the dates, and the three checks that matter surface as
 * the findings inline (`findingsFor`), not as a note on every ordinary row.
 */
export function summaryChunksFor(
  matter: CognizanceCase,
  chain: CognizanceChain,
): CognizanceChunk[] {
  const chunks: CognizanceChunk[] = [];
  const late = delayDays(matter);

  /* The filing date is on both tabs (cheat sheet §4, field 1); the two delay rows are the
     With Delay tab's alone (fields 11–12). */
  const complaint: CognizanceField[] = [
    { id: "filed", term: FILED_ON_TERM, value: formatListingDate(chain.filedOn) },
  ];
  if (late !== null) {
    complaint.push({
      id: "delay-duration",
      term: "Duration of delay",
      value: `${late} ${late === 1 ? "day" : "days"}`,
    });
    if (matter.grounds) {
      complaint.push({
        id: "delay-grounds",
        term: "Reason for praying condonation of delay",
        value: matter.grounds,
      });
    }
  }
  chunks.push({ id: "complaint", label: "Complaint", fields: complaint });

  /* Fields 2–5 repeat per cheque (cheat sheet §4). One cheque keeps the plain "Cheque" and
     "Dishonour"; several are numbered, each cheque followed by its own dishonour. */
  const several = matter.cheques.length > 1;
  matter.cheques.forEach((cheque, index) => {
    const dates = chain.cheques[index];
    const n = several ? ` ${index + 1}` : "";
    const docs = chequeDocumentKeys(index);
    chunks.push({
      id: several ? `cheque-${index + 1}` : "cheque",
      label: `Cheque${n}`,
      caption: several ? `Cheque ${index + 1} of ${matter.cheques.length}` : undefined,
      fields: [
        {
          id: `cheque-dated${several ? `-${index + 1}` : ""}`,
          term: "Date on cheque",
          value: formatListingDate(dates.chequeDatedOn),
          source: docs.cheque,
        },
        {
          id: `presented${several ? `-${index + 1}` : ""}`,
          term: "Date of presentation or deposit of cheque",
          value: formatListingDate(dates.presentedOn),
          source: docs.memo,
        },
      ],
    });
    chunks.push({
      id: `dishonour${several ? `-${index + 1}` : ""}`,
      label: `Dishonour${n}`,
      fields: [
        {
          id: `return-memo-date${several ? `-${index + 1}` : ""}`,
          term: "Date on return memo",
          value: formatListingDate(dates.returnedOn),
          source: docs.memo,
        },
        {
          id: `return-reason${several ? `-${index + 1}` : ""}`,
          term: "Reason for return of cheque",
          value: cheque.returnReason,
          source: docs.memo,
        },
      ],
    });
  });

  const notice: CognizanceField[] = [
    {
      id: "dispatched",
      term: NOTICE_DISPATCHED_TERM,
      value: formatListingDate(chain.noticeDispatchedOn),
      source: "demand-notice",
    },
  ];
  if (matter.noticeDelivered && chain.noticeDeliveredOn) {
    notice.push({
      id: "delivered",
      term: "Date of delivery of demand notice",
      value: formatListingDate(chain.noticeDeliveredOn),
      source: "demand-notice",
    });
  } else if (chain.noticeReturnedOn) {
    notice.push({
      id: "returned-notice",
      term: "Date of return of demand notice",
      value: formatListingDate(chain.noticeReturnedOn),
      source: "demand-notice",
      tooltip:
        "Date on which the demand notice was returned to the post office as undelivered.",
    });
    if (matter.nonDeliveryReason) {
      notice.push({
        id: "non-delivery",
        term: "Reason for non-delivery of demand notice",
        value: matter.nonDeliveryReason,
        source: "demand-notice",
      });
    }
  }
  chunks.push({ id: "notice", label: "Demand notice", fields: notice });

  chunks.push({
    id: "jurisdiction",
    label: "Jurisdiction",
    fields: [
      {
        id: "branch",
        term: branchTerm(matter),
        value: `${matter.branch.bank}, ${matter.branch.branch}`,
        note: matter.branch.place,
        source: "cheque",
      },
    ],
  });

  return chunks;
}

/* ──────────────────────────────── the documents ─────────────────────────────── */

/**
 * The documents the PRD makes reachable from this screen, and the facsimile each wears.
 *
 * The cheque, the return memo and the demand notice, and only those: a complaint's whole
 * bundle is the case file's business (`register-case-file.tsx`). These are the ones a
 * cognizance decision turns on. They carry a running number like the case file's bundle,
 * so the docked panel reads the same.
 */
export type CognizanceDocument = {
  key: string;
  no: number;
  title: string;
  kind: "cheque" | "memo" | "letter";
};

/**
 * The document keys for one cheque. The first keeps the plain keys, so a one-cheque file
 * — nearly every file — reads exactly as it always has.
 */
export function chequeDocumentKeys(index: number): { cheque: string; memo: string } {
  return index === 0
    ? { cheque: "cheque", memo: "return-memo" }
    : { cheque: `cheque-${index + 1}`, memo: `return-memo-${index + 1}` };
}

/**
 * The documents for one complaint: a cheque and a return memo per cheque, then the one
 * demand notice (cheat sheet §5). Several cheques are numbered; one is not.
 */
export function cognizanceDocumentsFor(matter: CognizanceCase): CognizanceDocument[] {
  const several = matter.cheques.length > 1;
  const docs: CognizanceDocument[] = [];
  matter.cheques.forEach((_, index) => {
    const keys = chequeDocumentKeys(index);
    const n = several ? ` ${index + 1}` : "";
    docs.push({ key: keys.cheque, no: 0, title: `Cheque${n}`, kind: "cheque" });
    docs.push({ key: keys.memo, no: 0, title: `Return memo${n}`, kind: "memo" });
  });
  docs.push({ key: "demand-notice", no: 0, title: "Demand notice", kind: "letter" });
  return docs.map((doc, index) => ({ ...doc, no: index + 1 }));
}

/* ─────────────────────────────────── the tabs ───────────────────────────────── */

/**
 * Delay splits the queue in two, and the split is what carries the act.
 *
 * This was one list with a delay filter until the PRD (v6, §2) made the two tabs load
 * bearing: the positive action is configured **per tab**, and a state may swap Take
 * cognizance for Issue notice on either one. A filter narrows a list without changing
 * what you can do at the end of it; a tab here decides that, so it is a tab.
 *
 * Both tabs stay inside the one *Take cognizance* row in the rail — the reference's two
 * counted rail rows opening two near-identical screens is still the wrong shape, and the
 * PRD does not ask for it either.
 */
export type CognizanceTab = "without-delay" | "with-delay";

/**
 * The two tabs, and the one act that moves a complaint forward on each.
 *
 * **The positive action is per-state configuration, not a property of the complaint**
 * (PRD §6). The values here are the defaults — Kerala's — and a state may replace either
 * one with the other; `dismiss` is the negative action on both tabs and is never
 * configurable, so it is not in this table.
 *
 * Reading the act off the tab rather than off `hasDelay` is the whole point: when a state
 * swaps one, everything downstream — the file's own bar, the order it would draw up —
 * follows from this one line.
 */
export const COGNIZANCE_TABS: {
  id: CognizanceTab;
  label: string;
  positiveAct: Exclude<CognizanceAct, "dismiss">;
}[] = [
  { id: "without-delay", label: "Without delay", positiveAct: "cognizance" },
  { id: "with-delay", label: "With delay", positiveAct: "notice" },
];

/** Which tab a complaint stands on. The one fact the split is made of. */
export function tabFor(matter: CognizanceCase): CognizanceTab {
  return hasDelay(matter) ? "with-delay" : "without-delay";
}

/** The complaints on one tab, in queue order. */
export function casesOnTab(
  rows: CognizanceCase[],
  tab: CognizanceTab,
): CognizanceCase[] {
  return rows.filter((entry) => tabFor(entry) === tab);
}

/**
 * How many complaints stand on one tab.
 *
 * Counted over the whole queue and never over what the search box has left, so the
 * number beside a tab's name does not move as the bench types.
 */
export function cognizanceTabCount(tab: CognizanceTab): number {
  return casesOnTab(COGNIZANCE_QUEUE, tab).length;
}

/* ───────────────────────────────── the filters ──────────────────────────────── */

export type CognizanceNoticeFilter = "all" | "delivered" | "returned";

export type CognizanceFilters = {
  /** Free text over the cause title, both numbers and counsel. */
  query: string;
  /** Whether the statutory demand notice reached the accused or came back. */
  notice?: CognizanceNoticeFilter;
};

export const EMPTY_COGNIZANCE_FILTERS: CognizanceFilters = {
  query: "",
  notice: "all",
};

export const COGNIZANCE_NOTICE_OPTIONS: { value: Exclude<CognizanceNoticeFilter, "all">; label: string }[] = [
  { value: "delivered", label: "Notice delivered" },
  { value: "returned", label: "Notice returned" },
];

export function filterCognizanceCases(
  rows: CognizanceCase[],
  filters: CognizanceFilters,
): CognizanceCase[] {
  const query = caseSearchKey(filters.query);
  const notice = filters.notice ?? "all";
  return rows.filter((entry) => {
    if (notice === "delivered" && !entry.noticeDelivered) return false;
    if (notice === "returned" && entry.noticeDelivered) return false;
    if (!query) return true;
    const haystack = [
      entry.parties.complainant,
      entry.parties.accused,
      entry.caseNumber,
      entry.filingNumber,
      ...entry.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/* ─────────────────────────────────── the act ────────────────────────────────── */

/**
 * What the file's own bar offers on one complaint.
 *
 * Exactly two, never three (PRD §6): one positive action that moves the complaint on,
 * and `dismiss`, which ends it. Which positive action is the **tab's**, not the
 * complaint's — `COGNIZANCE_TABS` holds it, and a state may swap it on either tab. The
 * defaults are Kerala's: Take cognizance on a complaint filed in time, and on a late one
 * Issue notice, so the accused is heard on the delay before the court decides it (BNSS
 * §223 proviso, and the notice this court already writes in `sign-process.ts`).
 *
 * This build performs none of them. Each opens a confirmation that names the order it
 * would draft and settles in place — the same bargain every other act on the court side
 * strikes. Drafting into the order composer is the next step and is not wired: that
 * composer is bound to a hearing today (`/employee/hearings/<id>/order`) and a complaint
 * at cognizance has no hearing, so pointing at it would be a link that could not resolve.
 */
export type CognizanceAct = "cognizance" | "notice" | "dismiss";

/** Whether a string off a URL names one of the three acts. */
export function isCognizanceAct(value: string | undefined): value is CognizanceAct {
  return value === "cognizance" || value === "notice" || value === "dismiss";
}

/** The positive action configured for one tab. */
export function positiveActForTab(tab: CognizanceTab): CognizanceAct {
  return COGNIZANCE_TABS.find((entry) => entry.id === tab)!.positiveAct;
}

/** The positive action a complaint meets, by way of the tab it stands on. */
export function primaryActFor(matter: CognizanceCase): CognizanceAct {
  return positiveActForTab(tabFor(matter));
}

/** What the complaint's state is called before any of the three acts is taken. */
export const COGNIZANCE_PENDING_LABEL = "Awaiting cognizance";

/**
 * What each act is called, what it draws up, and the pair its outcome wears.
 *
 * Three different outcomes, so three different pairs — the chip carries the words as
 * well as the colour, so the state is never colour alone. Cognizance is a conclusion and
 * takes the success pair; a notice is a step on the way to one and takes the
 * informational pair; a dismissal ends the complaint and takes the destructive one.
 *
 * `items` are the register's own order-item names (`order-items.ts`), so the bench meets
 * the same words again in the composer. One of them has no catalogue entry yet: an order
 * accepting or rejecting a condonation application exists as an order type on the case
 * side (`lib/cases/orders.ts`) but is missing from `ORDER_ITEM_GROUPS`, so a delay
 * decided here would have nothing to draft from. It is not listed below for that reason.
 *
 * `settled` is the **state** and `outcome` is **what follows from it** — two different
 * facts, so two lines rather than one said twice. A chip and a heading carrying the same
 * three words is the defect the register's own overlay comment warns about, and the
 * settled header had exactly it until this pair was split.
 */
export const COGNIZANCE_ACTS: Record<
  CognizanceAct,
  {
    label: string;
    asking: string;
    /** The state, on the chip. */
    settled: string;
    /** What follows from it, as the heading. Never the chip's words again. */
    outcome: string;
    badge: "success" | "info" | "destructive";
    items: string[];
  }
> = {
  cognizance: {
    label: "Take cognizance",
    asking: "Take cognizance of this complaint?",
    settled: "Cognizance taken",
    outcome: "The case will proceed to summons",
    badge: "success",
    items: ["Order for taking cognizance", "Summons"],
  },
  notice: {
    label: "Issue notice",
    asking: "Issue notice to the accused?",
    settled: "Notice issued",
    outcome: "The accused will be heard on the delay",
    badge: "info",
    items: ["Notice"],
  },
  dismiss: {
    label: "Dismiss case",
    asking: "Dismiss this complaint?",
    settled: "Dismissed",
    outcome: "This complaint ends here",
    badge: "destructive",
    items: ["Order to dismiss case"],
  },
};

/* ──────────────────────────────── the case view ─────────────────────────────── */

/**
 * A complaint in this queue as the case view reads a case (`components/cases/case-detail.tsx`),
 * for the screen's View case.
 *
 * The queue keeps its own rows, so the case view's record is made from one rather than
 * looked up: the numbers, the parties, the counsel and the filing date are this row's, and
 * the stage is the one every row here is at. Nothing is added that the row does not carry —
 * no hearing, no disposal, no update beyond waiting for this act.
 */
export function cognizanceCaseRecord(
  matter: CognizanceCase,
  today: string,
): CaseRecord {
  const { filedOn } = chainFor(matter, today);
  const counselOf = (side: CourtCounsel["side"]) =>
    matter.counsel.filter((entry) => entry.side === side).map((entry) => entry.name);
  const complainant = counselOf("complainant");
  const accused = counselOf("accused");
  return {
    id: matter.id,
    caseNumber: matter.caseNumber,
    parties: matter.parties,
    counsel:
      complainant.length || accused.length
        ? {
            ...(complainant.length ? { complainant } : {}),
            ...(accused.length ? { accused } : {}),
          }
        : undefined,
    court: CURRENT_STAFF.court,
    filedOn,
    updatedOn: minus(today, matter.daysSinceRegistered),
    latestUpdate: "Registered, awaiting cognizance",
    stage: "cognizance",
    longPending: false,
    bookmarked: false,
  };
}
