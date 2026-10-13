/**
 * Delay-condonation applications waiting on the bench — the review queue, as data.
 *
 * The sibling of `register-cases.ts`, `schedule.ts` and `rescheduling-request.ts`:
 * those modules are complaints not yet on the register, matters not yet given a
 * date, and listed matters asking to move that date. This one is applications
 * asking the court to condone delay — at filing (Registration / `CMP/…`) and,
 * later, on a matter already on file. They share the court-side vocabulary —
 * counsel, sides, the cause title, the page sizes, the stage labels — rather
 * than restating it. Only the citizen side is off limits (see `content.ts`).
 *
 * **There is no backend.** `DELAY_CONDONATION_QUEUE` is demo data shaped to
 * exercise what the screen has to survive: every stage the filter offers, a
 * corporate accused long enough to wrap the cause title, a side with several
 * counsel, and a complaint with no vakalat on record at all. No row is read
 * from a case, a court or a queue.
 *
 * **Nothing here condones anything.** Accepting or rejecting delay is a real
 * judicial act (`order-for-acceptance-rejection-of-delay-condonation`) and this
 * build performs none, so the table carries no row actions at all (see
 * `DelayCondonationTable`) — not even disabled ones. The list is honest about
 * what is waiting; the act is simply not offered yet.
 *
 * Registration is a stage *here* and not on Schedule hearing. `CASE_STAGES`
 * starts at cognizance because those are hearings to date; a complaint still
 * at filing is the registry's queue. This filter has to name what the
 * screenshot showed, so Registration is prepended and left off `CASE_STAGES`.
 * Numbers follow the stage: `CMP/…` before cognizance is taken, `ST/…` after.
 * These rows do not overlap today's cause list, the scheduling queue, the
 * register queue, or the rescheduling queue.
 */

import { CURRENT_STAFF } from "./content";
import {
  applicationFiler,
  causeTitle,
  counselFor,
  formatListingDate,
  parseIsoDay,
  partySideLabel,
  type CounselSide,
  type CourtCounsel,
} from "./hearings";
import { CASE_STAGES, type CaseStage } from "./schedule";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

export type DelayCondonationStage = "registration" | CaseStage;

export const DELAY_CONDONATION_STAGES: {
  id: DelayCondonationStage;
  label: string;
}[] = [{ id: "registration", label: "Registration" }, ...CASE_STAGES];

export function delayCondonationStageLabel(
  stage: DelayCondonationStage,
): string {
  return (
    DELAY_CONDONATION_STAGES.find((entry) => entry.id === stage)?.label ??
    stage
  );
}

export type DelayCondonationCase = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /**
   * Counsel on record. A complaint at Registration may have none — it has been
   * submitted, not yet numbered, and a vakalat is not a given. The cell then
   * shows nothing rather than a dash: an empty advocates column on the
   * reference was an absence, not a missing value.
   */
  counsel: CourtCounsel[];
  stage: DelayCondonationStage;
  /** ISO day the application reached the court. */
  appliedOn: string;
  /**
   * The side asking for the delay to be condoned. At Registration that is
   * always the complainant — the delay is in filing the complaint itself — but
   * once a case is on file either side can be late with something.
   */
  filedFor: CounselSide;
  /** The length of the delay in days, as the application itself puts it. */
  delayDays: number;
  /**
   * What the delay attaches to, as a phrase the prayer can carry: "filing the
   * complaint" before cognizance, and whatever was actually late after it.
   * Stored rather than derived from the stage, because two applications at the
   * same stage are not late with the same thing.
   */
  delayIn: string;
  /** The sufficient cause pleaded, in the filer's words. */
  reason: string;
};

/**
 * Applications waiting for the bench to condone delay.
 *
 * Ordered Registration first so the opening page matches the reference
 * (every visible row there was at Registration), then the later stages the
 * filter also offers. Names follow the fixtures the rest of the court side
 * uses: local parties and the same bar, but not the same matters as
 * `CAUSE_LIST`, `SCHEDULING_QUEUE`, `REGISTER_QUEUE` or `RESCHEDULING_QUEUE`.
 */
export const DELAY_CONDONATION_QUEUE: DelayCondonationCase[] = [
  {
    id: "dc-1213",
    caseNumber: "CMP/1213/2025",
    parties: { complainant: "Thankamani", accused: "Thenmala Timber Depot" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-10-08",
    filedFor: "complainant",
    delayDays: 27,
    delayIn: "filing the complaint",
    reason:
      "The complainant was admitted to hospital at Punalur for most of the month in which the complaint fell due.",
  },
  {
    id: "dc-1214",
    caseNumber: "CMP/1214/2025",
    parties: { complainant: "Pradeep Kumar", accused: "Kadakkal Spices" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-10-15",
    filedFor: "complainant",
    delayDays: 19,
    delayIn: "filing the complaint",
    reason:
      "The demand notice was returned unserved and a second notice had to be sent to the drawer's registered address.",
  },
  {
    id: "dc-1220",
    caseNumber: "CMP/1220/2025",
    parties: {
      complainant: "Omana",
      accused: "Kulathupuzha Forest Stores and General Trading",
    },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "complainant" },
    ],
    stage: "registration",
    appliedOn: "2025-10-22",
    filedFor: "complainant",
    delayDays: 41,
    delayIn: "filing the complaint",
    reason:
      "The complainant firm could authorise the complaint only after the resolution was passed at the quarterly meeting.",
  },
  {
    id: "dc-1228",
    caseNumber: "CMP/1228/2025",
    parties: { complainant: "Sudheesh", accused: "Aryankavu Coffee Works" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-10-29",
    filedFor: "complainant",
    delayDays: 12,
    delayIn: "filing the complaint",
    reason:
      "The dishonour memo reached the complainant late, the bank branch having posted it to a former address.",
  },
  {
    id: "dc-1235",
    caseNumber: "CMP/1235/2025",
    parties: { complainant: "Nabeesa", accused: "Pathanapuram Feeds" },
    counsel: [],
    stage: "registration",
    appliedOn: "2025-11-05",
    filedFor: "complainant",
    delayDays: 63,
    delayIn: "filing the complaint",
    reason:
      "The complaint was presented twice at the counter without counsel and returned as incomplete on both occasions.",
  },
  {
    id: "dc-1241",
    caseNumber: "CMP/1241/2025",
    parties: { complainant: "Girija", accused: "Punalur Rubber Depot" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-11-08",
    filedFor: "complainant",
    delayDays: 8,
    delayIn: "filing the complaint",
    reason:
      "The certified copy of the bank statement was issued only after the fifteen-day notice period had run.",
  },
  {
    id: "dc-1251",
    caseNumber: "CMP/1251/2025",
    parties: { complainant: "Manoj", accused: "Anchalumoodu Quarry" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-11-12",
    filedFor: "complainant",
    delayDays: 35,
    delayIn: "filing the complaint",
    reason:
      "The complainant was in employment outside the country and could return to sign the complaint only the following month.",
  },
  {
    id: "dc-1258",
    caseNumber: "CMP/1258/2025",
    parties: { complainant: "Sabeena", accused: "Mayyanad Ice Plant" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-11-17",
    filedFor: "complainant",
    delayDays: 21,
    delayIn: "filing the complaint",
    reason:
      "The notice period was mis-counted in counsel's office and the complaint was presented after the month had expired.",
  },
  {
    id: "dc-1266",
    caseNumber: "CMP/1266/2025",
    parties: { complainant: "Radhakrishnan", accused: "Kundara Cables" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "complainant" },
    ],
    stage: "registration",
    appliedOn: "2025-11-21",
    filedFor: "complainant",
    delayDays: 54,
    delayIn: "filing the complaint",
    reason:
      "The cheque and the dishonour memo were with the advocate earlier on record, whose vakalat was withdrawn.",
  },
  {
    id: "dc-1274",
    caseNumber: "CMP/1274/2025",
    parties: { complainant: "Pushpa", accused: "Sakthikulangara Nets" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-11-26",
    filedFor: "complainant",
    delayDays: 16,
    delayIn: "filing the complaint",
    reason:
      "There was a death in the complainant's family and the papers could not be attended to during the mourning.",
  },
  {
    id: "dc-1281",
    caseNumber: "CMP/1281/2025",
    parties: { complainant: "Fazil", accused: "Tenkasi Road Traders" },
    counsel: [],
    stage: "registration",
    appliedOn: "2025-12-01",
    filedFor: "complainant",
    delayDays: 74,
    delayIn: "filing the complaint",
    reason:
      "The complainant, appearing without counsel, did not know that the complaint had to be filed within a month of the notice period.",
  },
  {
    id: "dc-1290",
    caseNumber: "CMP/1290/2025",
    parties: { complainant: "Indira", accused: "Karunagappally Cashews" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-12-04",
    filedFor: "complainant",
    delayDays: 30,
    delayIn: "filing the complaint",
    reason:
      "The drawer had promised payment in instalments and the complaint was held back while two instalments were awaited.",
  },
  {
    id: "dc-1298",
    caseNumber: "CMP/1298/2025",
    parties: { complainant: "Soman", accused: "Chavara Salt Works" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-12-09",
    filedFor: "complainant",
    delayDays: 44,
    delayIn: "filing the complaint",
    reason:
      "The complainant was under treatment after a road accident and could not instruct counsel in time.",
  },
  {
    id: "dc-1305",
    caseNumber: "CMP/1305/2025",
    parties: { complainant: "Naseema", accused: "Kottarakkara Oil Mill" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-12-12",
    filedFor: "complainant",
    delayDays: 11,
    delayIn: "filing the complaint",
    reason:
      "Heavy rain closed the taluk office for several days in the week the complaint fell due.",
  },
  {
    id: "dc-1312",
    caseNumber: "CMP/1312/2025",
    parties: { complainant: "Biju", accused: "Paravur Boat Jetty Stores" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-12-16",
    filedFor: "complainant",
    delayDays: 26,
    delayIn: "filing the complaint",
    reason:
      "A second cheque of the same drawer was also dishonoured and the complainant awaited that memo before filing.",
  },
  {
    id: "dc-1320",
    caseNumber: "CMP/1320/2025",
    parties: { complainant: "Vanaja", accused: "Ochira Oil Traders" },
    counsel: [],
    stage: "registration",
    appliedOn: "2025-12-19",
    filedFor: "complainant",
    delayDays: 88,
    delayIn: "filing the complaint",
    reason:
      "The complainant went first to the police and came to this court only on being told that the matter is a private complaint.",
  },
  {
    id: "dc-1328",
    caseNumber: "CMP/1328/2025",
    parties: { complainant: "Shamsudeen", accused: "Kadakkal Hardware" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-12-23",
    filedFor: "complainant",
    delayDays: 18,
    delayIn: "filing the complaint",
    reason:
      "The authorised representative of the complainant was on leave and the vakalat could not be signed.",
  },
  {
    id: "dc-1344",
    caseNumber: "CMP/1344/2025",
    parties: { complainant: "Gracy", accused: "Pathanapuram Tiles" },
    counsel: [{ name: "Adv. Nisha Thomas", side: "complainant" }],
    stage: "registration",
    appliedOn: "2025-12-29",
    filedFor: "complainant",
    delayDays: 33,
    delayIn: "filing the complaint",
    reason:
      "The bank took a month to issue the certificate of the account holder's signature filed with the complaint.",
  },
  {
    id: "dc-1352",
    caseNumber: "CMP/1352/2025",
    parties: { complainant: "Aneesh", accused: "Kulathupuzha Saw Mill" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "complainant" },
    ],
    stage: "registration",
    appliedOn: "2026-01-06",
    filedFor: "complainant",
    delayDays: 49,
    delayIn: "filing the complaint",
    reason:
      "The complainant was attending to a family member admitted in the medical college hospital at Thiruvananthapuram.",
  },
  {
    id: "dc-1361",
    caseNumber: "CMP/1361/2025",
    parties: { complainant: "Rejitha", accused: "Aryankavu Provisions" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "registration",
    appliedOn: "2026-01-13",
    filedFor: "complainant",
    delayDays: 14,
    delayIn: "filing the complaint",
    reason:
      "The complaint was presented in time before a court without jurisdiction and returned for presentation here.",
  },
  {
    id: "dc-1370",
    caseNumber: "CMP/1370/2025",
    parties: { complainant: "Musthafa", accused: "Thenmala Hill Produce" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "registration",
    appliedOn: "2026-01-20",
    filedFor: "complainant",
    delayDays: 57,
    delayIn: "filing the complaint",
    reason:
      "The complainant's business records were damaged by water and the papers had to be reconstructed from the bank's copies.",
  },
  {
    id: "dc-1378",
    caseNumber: "CMP/1378/2025",
    parties: { complainant: "Molly", accused: "Tenkasi Road Cold Storage" },
    counsel: [],
    stage: "registration",
    appliedOn: "2026-01-27",
    filedFor: "complainant",
    delayDays: 96,
    delayIn: "filing the complaint",
    reason:
      "The complainant, appearing without counsel, learnt that the notice was returned undelivered only when the postal enquiry was answered.",
  },
  {
    id: "dc-890",
    caseNumber: "CMP/890/2026",
    parties: { complainant: "Santhosh", accused: "Nedumangad Copra Traders" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "cognizance",
    appliedOn: "2026-02-10",
    filedFor: "complainant",
    delayDays: 22,
    delayIn: "filing the complaint",
    reason:
      "The demand notice was served at the drawer's godown and the acknowledgement reached the complainant a month later.",
  },
  {
    id: "dc-891",
    caseNumber: "CMP/891/2026",
    parties: { complainant: "Zainaba", accused: "Varkala Beach Stores" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    stage: "cognizance",
    appliedOn: "2026-02-17",
    filedFor: "complainant",
    delayDays: 37,
    delayIn: "filing the complaint",
    reason:
      "The complainant fell ill during the notice period; the medical certificate is filed with this application.",
  },
  {
    id: "dc-892",
    caseNumber: "CMP/892/2026",
    parties: { complainant: "Vineeth", accused: "Attingal Grain Market" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Anitha George", side: "accused" },
    ],
    stage: "cognizance",
    appliedOn: "2026-02-24",
    filedFor: "complainant",
    delayDays: 15,
    delayIn: "filing the complaint",
    reason:
      "The complainant awaited the drawer's reply to the demand notice, which came after the month had run.",
  },
  {
    id: "dc-401",
    caseNumber: "ST/401/2026",
    parties: { complainant: "Leelamma", accused: "Kilimanoor Motors" },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "appearance",
    appliedOn: "2026-04-07",
    filedFor: "accused",
    delayDays: 24,
    delayIn: "entering appearance after service of summons",
    reason:
      "Summons was served at an address the accused had left, and the accused learnt of the case from the surety.",
  },
  {
    id: "dc-402",
    caseNumber: "ST/402/2026",
    parties: { complainant: "Hashim", accused: "Venjaramoodu Electricals" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "appearance",
    appliedOn: "2026-04-14",
    filedFor: "complainant",
    delayDays: 19,
    delayIn: "paying process fee for fresh summons",
    reason:
      "The complainant awaited the postal endorsement on the first summons before paying process fee afresh.",
  },
  {
    id: "dc-403",
    caseNumber: "ST/403/2026",
    parties: { complainant: "Thankachi", accused: "Nedumangad Furniture" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    stage: "plea",
    appliedOn: "2026-04-28",
    filedFor: "accused",
    delayDays: 12,
    delayIn: "appearing on the date fixed for the plea",
    reason:
      "The accused was under treatment on the date fixed and produces the discharge summary with this application.",
  },
  {
    id: "dc-404",
    caseNumber: "ST/404/2026",
    parties: { complainant: "Rajesh", accused: "Varkala Lime Works" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    stage: "plea",
    appliedOn: "2026-05-05",
    filedFor: "complainant",
    delayDays: 9,
    delayIn: "filing the list of documents with the plea",
    reason:
      "The original cheque and memo were with the bank for certification on the date the list was due.",
  },
  {
    id: "dc-405",
    caseNumber: "ST/405/2026",
    parties: { complainant: "Noorjahan", accused: "Attingal Handlooms" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "evidence",
    appliedOn: "2026-05-19",
    filedFor: "accused",
    delayDays: 17,
    delayIn: "filing the affidavit of the defence witness",
    reason:
      "The defence witness was outside the district and the affidavit could be sworn only on return.",
  },
  {
    id: "dc-406",
    caseNumber: "ST/406/2026",
    parties: { complainant: "Prasanna", accused: "Kilimanoor Dairy" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "evidence",
    appliedOn: "2026-06-02",
    filedFor: "complainant",
    delayDays: 13,
    delayIn: "filing the affidavit of evidence",
    reason:
      "The affidavit was ready but the deponent was ill on the date fixed for swearing it.",
  },
  {
    id: "dc-407",
    caseNumber: "ST/407/2026",
    parties: {
      complainant: "Jayan",
      accused: "Venjaramoodu Agro Mills and Trading Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "evidence",
    appliedOn: "2026-06-16",
    filedFor: "accused",
    delayDays: 28,
    delayIn: "producing the bank documents summoned",
    reason:
      "The branch replied that records of that period are held at the regional office and took a month to retrieve them.",
  },
  {
    id: "dc-408",
    caseNumber: "ST/408/2026",
    parties: { complainant: "Suhara", accused: "Nedumangad Printers" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "arguments",
    appliedOn: "2026-06-30",
    filedFor: "complainant",
    delayDays: 10,
    delayIn: "filing written arguments",
    reason:
      "Counsel for the complainant was in a part-heard trial before the sessions court through the week allowed.",
  },
  {
    id: "dc-409",
    caseNumber: "ST/409/2026",
    parties: { complainant: "Babu", accused: "Varkala Marine Stores" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "arguments",
    appliedOn: "2026-07-14",
    filedFor: "accused",
    delayDays: 15,
    delayIn: "filing written arguments",
    reason:
      "The accused changed counsel after the last hearing and the counsel now on record needed time to read the record.",
  },
  {
    id: "dc-410",
    caseNumber: "ST/410/2026",
    parties: { complainant: "Celine", accused: "Attingal Super Bazaar" },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Nisha Thomas", side: "accused" },
    ],
    stage: "judgement",
    appliedOn: "2026-07-28",
    filedFor: "accused",
    delayDays: 21,
    delayIn: "filing the application to re-open evidence",
    reason:
      "A receipt said to evidence payment was traced only after the case was posted for judgement.",
  },
];

/**
 * How many applications are waiting — the number the rail carries beside
 * "Delay condonation".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `REGISTER_QUEUE_COUNT` is, so the rail and the screen cannot disagree about
 * the size of the queue.
 */
export const DELAY_CONDONATION_QUEUE_COUNT = DELAY_CONDONATION_QUEUE.length;

export type DelayCondonationFilters = {
  stage: DelayCondonationStage | "all";
  /**
   * Free text over the cause title, the case number and counsel — the same
   * reach the scheduling queue uses. The reference labelled the box "Case
   * Name or Number, Advocate".
   */
  query: string;
};

export const EMPTY_DELAY_CONDONATION_FILTERS: DelayCondonationFilters = {
  stage: "all",
  query: "",
};

export function filterDelayCondonationCases(
  rows: DelayCondonationCase[],
  filters: DelayCondonationFilters,
): DelayCondonationCase[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((entry) => {
    if (filters.stage !== "all" && entry.stage !== filters.stage) return false;
    if (!query) return true;
    const haystack = [
      entry.parties.complainant,
      entry.parties.accused,
      entry.caseNumber,
      ...entry.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Compact column date — the same register the rest of the court side uses. */
export function formatDelayCondonationDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "5 March 2026" — a date named in the review facts, not in a column. */
export function formatDelayCondonationLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/**
 * "27 days in filing the complaint" — the one fact the whole application turns
 * on, so the overlay states it as a sentence rather than making the bench read
 * a number and a phrase out of two rows.
 */
export function delayLine(matter: DelayCondonationCase): string {
  const days = matter.delayDays === 1 ? "1 day" : `${matter.delayDays} days`;
  return `${days} in ${matter.delayIn}`;
}

/** Who put the application in — counsel on record, or the party without one. */
export function delayCondonationFiler(matter: DelayCondonationCase): string {
  return applicationFiler(matter, matter.filedFor);
}

export const DELAY_CONDONATION_TYPE_LABEL = "Delay condonation";

export type DelayCondonationDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  title: string;
  filedFor: string;
  facts: { term: string; value: string }[];
  paragraphs: string[];
  prayer: string;
  dated: string;
};

/**
 * The application as a court-form document, composed from this row.
 *
 * The same shape as `ReschedulingDocument` and `CopyApplicationDocument` — court
 * heading, recited particulars, numbered operative paragraphs, a prayer — because
 * that is what all three are: a party asking the court for something. The bench
 * reads one kind of paper across the review queues rather than three.
 *
 * The last paragraph is the plea every condonation application makes and none of
 * them omits: that the delay was not deliberate. It is part of the form, not a
 * finding — nothing here says the court accepted it.
 */
export function buildDelayCondonationDocument(
  matter: DelayCondonationCase,
): DelayCondonationDocument {
  const side = partySideLabel(matter.filedFor);
  const facts: { term: string; value: string }[] = [
    { term: "Complainant", value: matter.parties.complainant },
    { term: "Accused", value: matter.parties.accused },
  ];
  const complainantCounsel = counselFor(matter, "complainant").map(
    (counsel) => counsel.name,
  );
  if (complainantCounsel.length) {
    facts.push({
      term: "Complainant counsel",
      value: complainantCounsel.join(", "),
    });
  }
  const accusedCounsel = counselFor(matter, "accused").map(
    (counsel) => counsel.name,
  );
  if (accusedCounsel.length) {
    facts.push({ term: "Accused counsel", value: accusedCounsel.join(", ") });
  }
  facts.push(
    { term: "Stage", value: delayCondonationStageLabel(matter.stage) },
    { term: "Delay to be condoned", value: delayLine(matter) },
    {
      term: "Offence",
      value: "S. 138 of the Negotiable Instruments Act, 1881",
    },
  );

  return {
    court: `Before the ${CURRENT_STAFF.court}`,
    caseNumber: matter.caseNumber,
    matter: causeTitle(matter),
    title: "Application for condonation of delay",
    filedFor: `the ${side}`,
    facts,
    paragraphs: [
      `This matter is before this court at the stage of ${delayCondonationStageLabel(
        matter.stage,
      ).toLowerCase()}.`,
      `There has been a delay of ${delayLine(matter)}.`,
      `The delay occurred for the following reason: ${matter.reason}`,
      "The delay is neither wilful nor intentional, and the applicant submits that no prejudice will be caused to the other side if it is condoned.",
    ],
    prayer: `It is therefore prayed that this court may condone the delay of ${delayLine(
      matter,
    )} and proceed with this matter.`,
    dated: formatDelayCondonationLongDate(matter.appliedOn),
  };
}

export function delayCondonationDocumentText(
  document: DelayCondonationDocument,
): string {
  return [
    document.court,
    `Case no. ${document.caseNumber}`,
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
    `Prayer: ${document.prayer}`,
    "",
    `Filed for ${document.filedFor}`,
    `Dated ${document.dated}`,
  ].join("\n");
}

export function delayCondonationDocumentFilename(
  matter: DelayCondonationCase,
): string {
  return `${matter.caseNumber.replace(/\//g, "-")}-delay-condonation.txt`;
}

export function downloadDelayCondonationDocument(
  matter: DelayCondonationCase,
): void {
  const document = buildDelayCondonationDocument(matter);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(delayCondonationDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = delayCondonationDocumentFilename(voicedForDownload(matter));
  anchor.click();
  URL.revokeObjectURL(url);
}
