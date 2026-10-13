/**
 * This court's register — every case on its file, and the priorities the bench reads it
 * through.
 *
 * The screen it feeds is `/employee`, which is the dashboard and the case register at
 * once (owner, 2026-09-14: *"I think we can combine the dashboard and all cases list"*).
 * That combination is why this module holds both halves: the six priority categories are
 * not a separate analytic, they are saved filters over the same rows the table shows, so
 * a tile's count and the list it opens cannot disagree.
 *
 * ## Where the six categories came from
 *
 * The owner's field visit to Gujarat (2026-09-14). Judges there asked for exactly this
 * and explicitly did not ask for general analytics or broad pendency numbers on the
 * landing screen: what they want is instant awareness of the matters that need judicial
 * action now or are under a higher court's mandate. All six are transcribed from that
 * research and none is invented here.
 *
 * Two of them are **derived, not stored** — the register already knew them:
 *
 * - *Newly filed, pending cognizance* is `stage === "cognizance"`. A case that has
 *   cleared registry scrutiny and not yet been taken on file is at that stage by
 *   definition (`hearings.ts`, `CourtCaseStage`).
 * - *Process issued, report awaited* is `stage === "process"`, for the same reason: the
 *   stage means summons or warrant has gone out and the serving report has not come back.
 *
 * The other four are facts the model did not carry, so they are a flag set on the case.
 * They are properties of the matter rather than of its stage — a stayed case is stayed at
 * whatever stage it had reached — which is why they cannot be folded into `CourtCaseStage`.
 *
 * ## Demo data, and honest about which parts
 *
 * There is no backend. The 23 cases listed for today are transcribed from `CAUSE_LIST`
 * so the dashboard and the cause list cannot name the same case two ways — `cases.test.ts`
 * asserts it — and the rest are this court's older file. Dates are stored as offsets from
 * today rather than as fixed days, so a demo opened next month still shows a court with
 * dates in front of it rather than a screen of expired listings.
 */

import {
  CAUSE_LIST,
  isoDay,
  parseIsoDay,
  type CourtCaseStage,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";

/**
 * A priority a case carries as a fact about the matter, not as a stage it has reached.
 *
 * `utp` is the Supreme Court's under-trial-prisoner mandate: the accused is in custody,
 * so the matter takes statutory hearing priority. It is rare in a §138 court and real —
 * an accused arrested on a non-bailable warrant after repeated non-appearance — which is
 * exactly why the bench wants it on a tile rather than buried in a list.
 */
export type CourtCaseFlag = "utp" | "stayed" | "time-bound" | "appellate-pending";

export type CourtCase = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  stage: CourtCaseStage;
  /**
   * Days from today to the next listing. `0` is listed today; `null` is no date fixed,
   * which is the truth about a case awaiting cognizance and not a missing value.
   */
  nextHearingInDays: number | null;
  /** How long the case has been on this court's file, in days. */
  registeredDaysAgo: number;
  flags: CourtCaseFlag[];
  /** Days the accused has been in custody — set only on `utp` cases. A person's liberty,
   *  so the dashboard leads with it. Demo data standing in for the real record's field. */
  custodyDays?: number;
  /** Days until the disposal deadline a higher court fixed — set only on `time-bound`
   *  cases. Demo data for the real field. */
  deadlineInDays?: number;
  /** Days the service report is overdue on an issued summons — set on `process`-stage
   *  cases still waiting on one. Demo data for the real field. */
  serviceOverdueDays?: number;
  /** The court above that has the matter — set on `stayed` / `appellate-pending` cases.
   *  Demo data for the real field. */
  higherCourt?: string;
};

/**
 * One of the bench's standing priorities — a tile, and the filter behind it.
 *
 * `tile` and `title` are two lengths of the same name on purpose. A tile is about 160px
 * wide on a phone and has to survive two lines; the filtered list's heading has the whole
 * panel and should say the category the way the research says it. `meaning` is the line
 * that makes the category legible to somebody who is not a magistrate — it is copy, not
 * a fact about any case.
 */
export type CourtPriority = {
  id: CourtPriorityId;
  tile: string;
  title: string;
  meaning: string;
  matches: (record: CourtCase) => boolean;
};

export type CourtPriorityId =
  | "pending-cognizance"
  | "utp"
  | "stayed"
  | "time-bound"
  | "appellate-pending"
  | "process-pending";

/** Flag order and wording, for the register's own Priority column. */
export const COURT_CASE_FLAG_LABEL: Record<CourtCaseFlag, string> = {
  utp: "In custody",
  stayed: "Stayed",
  "time-bound": "Time-bound",
  "appellate-pending": "Appeal or revision",
};

function carries(flag: CourtCaseFlag) {
  return (record: CourtCase) => record.flags.includes(flag);
}

/**
 * The six, in the order the owner's research lists them: what the bench must act on
 * first, then what a higher court has said about the matter, then what it is waiting on.
 */
export const COURT_PRIORITIES: CourtPriority[] = [
  {
    id: "pending-cognizance",
    tile: "Pending cognizance",
    title: "Newly filed, pending cognizance",
    meaning:
      "Cleared registry scrutiny and waiting for the order that issues summons.",
    matches: (record) => record.stage === "cognizance",
  },
  {
    id: "utp",
    tile: "Accused in custody",
    title: "Under-trial prisoner matters",
    meaning:
      "The accused is in custody, so the matter takes statutory hearing priority.",
    matches: carries("utp"),
  },
  {
    id: "stayed",
    tile: "Stayed",
    title: "Stayed by a higher court",
    meaning:
      "Proceedings are stayed by the High Court or the Supreme Court.",
    matches: carries("stayed"),
  },
  {
    id: "time-bound",
    tile: "Time-bound",
    title: "Time-bound by a higher court's direction",
    meaning: "A higher court has fixed a date by which this case must be disposed.",
    matches: carries("time-bound"),
  },
  {
    id: "appellate-pending",
    tile: "Appeal or revision",
    title: "Revision or appeal pending above",
    meaning: "A revision or appeal out of this case is live in an appellate court.",
    matches: carries("appellate-pending"),
  },
  {
    id: "process-pending",
    tile: "Process awaited",
    title: "Process issued, report awaited",
    meaning:
      "Summons or warrant has gone out and the serving report has not come back.",
    matches: (record) => record.stage === "process",
  },
];

export function courtPriorityById(
  id: CourtPriorityId,
): CourtPriority | undefined {
  return COURT_PRIORITIES.find((priority) => priority.id === id);
}

/* The 23 matters listed for today, lifted from the cause list rather than retyped, so
   the dashboard and the day's list cannot drift about the same case. Everything the
   register knows and a listing does not — the next date, the age, the flags — is
   attached here by case number. A case listed today is listed today: `0`. */
const TODAYS_EXTRAS: Record<
  string,
  { registeredDaysAgo: number; flags: CourtCaseFlag[] }
> = {
  "ST/241/2026": { registeredDaysAgo: 168, flags: [] },
  "ST/243/2026": { registeredDaysAgo: 142, flags: [] },
  "ST/244/2026": { registeredDaysAgo: 138, flags: [] },
  "ST/245/2026": { registeredDaysAgo: 21, flags: [] },
  "ST/246/2026": { registeredDaysAgo: 18, flags: [] },
  "ST/247/2026": { registeredDaysAgo: 16, flags: [] },
  "ST/248/2026": { registeredDaysAgo: 120, flags: [] },
  /* The one matter on today's list with the accused in custody — arrested on a
     non-bailable warrant after repeated non-appearance. */
  "ST/249/2026": { registeredDaysAgo: 96, flags: ["utp"] },
  "ST/250/2026": { registeredDaysAgo: 175, flags: [] },
  "ST/251/2026": { registeredDaysAgo: 181, flags: [] },
  "ST/252/2026": { registeredDaysAgo: 14, flags: [] },
  "ST/253/2026": { registeredDaysAgo: 190, flags: [] },
  "ST/254/2026": { registeredDaysAgo: 268, flags: ["time-bound"] },
  "ST/255/2026": { registeredDaysAgo: 131, flags: [] },
  "ST/256/2026": { registeredDaysAgo: 88, flags: [] },
  "ST/257/2026": { registeredDaysAgo: 11, flags: [] },
  "ST/258/2026": { registeredDaysAgo: 196, flags: [] },
  "ST/259/2026": { registeredDaysAgo: 126, flags: [] },
  "ST/260/2026": { registeredDaysAgo: 311, flags: [] },
  "ST/261/2026": { registeredDaysAgo: 114, flags: [] },
  "ST/262/2026": { registeredDaysAgo: 79, flags: [] },
  "ST/263/2026": { registeredDaysAgo: 259, flags: [] },
  "ST/264/2026": { registeredDaysAgo: 9, flags: [] },
};

const LISTED_TODAY: CourtCase[] = CAUSE_LIST.map((hearing) => {
  const extras = TODAYS_EXTRAS[hearing.caseNumber];
  return {
    id: `c-${hearing.caseNumber.replace(/\//g, "-")}`,
    caseNumber: hearing.caseNumber,
    parties: hearing.parties,
    stage: hearing.stage,
    nextHearingInDays: 0,
    registeredDaysAgo: extras?.registeredDaysAgo ?? 0,
    flags: extras?.flags ?? [],
  };
});

/* The rest of this court's file — matters not listed today. Older case numbers and two
   from last year, so the register reads like a working court rather than one week. */
const NOT_LISTED_TODAY: CourtCase[] = [
  {
    id: "c-ST-112-2026",
    caseNumber: "ST/112/2026",
    parties: { complainant: "Aravind Sasidharan", accused: "Anugraha Builders" },
    stage: "evidence",
    nextHearingInDays: 3,
    registeredDaysAgo: 210,
    flags: ["time-bound"],
  },
  {
    id: "c-ST-128-2026",
    caseNumber: "ST/128/2026",
    parties: { complainant: "Asha Vijayakumar", accused: "Aryankavu Provisions" },
    stage: "plea",
    nextHearingInDays: 7,
    registeredDaysAgo: 195,
    flags: [],
  },
  {
    id: "c-ST-134-2026",
    caseNumber: "ST/134/2026",
    parties: { complainant: "Anwar Rasheed", accused: "Adichanalloor Traders" },
    stage: "cognizance",
    nextHearingInDays: null,
    registeredDaysAgo: 12,
    flags: [],
  },
  {
    id: "c-ST-147-2026",
    caseNumber: "ST/147/2026",
    parties: { complainant: "Abdul Kareem", accused: "Anchalumoodu Quarry" },
    stage: "arguments",
    nextHearingInDays: 2,
    registeredDaysAgo: 240,
    flags: ["appellate-pending"],
  },
  {
    id: "c-ST-158-2026",
    caseNumber: "ST/158/2026",
    parties: { complainant: "Aiswarya Nandakumar", accused: "Ajay Menon" },
    stage: "evidence",
    nextHearingInDays: 5,
    registeredDaysAgo: 180,
    flags: ["stayed"],
  },
  {
    id: "c-ST-163-2026",
    caseNumber: "ST/163/2026",
    parties: { complainant: "Ajith Kumar", accused: "Ameena Bhaskar" },
    stage: "process",
    nextHearingInDays: 9,
    registeredDaysAgo: 60,
    flags: [],
  },
  {
    id: "c-ST-171-2026",
    caseNumber: "ST/171/2026",
    parties: {
      complainant: "Anju Thankachan",
      accused: "Backwater Marine Logistics and Warehousing Company Pvt Ltd",
    },
    stage: "appearance",
    nextHearingInDays: 4,
    registeredDaysAgo: 95,
    flags: [],
  },
  {
    id: "c-ST-186-2026",
    caseNumber: "ST/186/2026",
    parties: {
      complainant: "Anilkumar Sivadasan",
      accused: "Everbright Electricals",
    },
    stage: "judgement",
    nextHearingInDays: 1,
    registeredDaysAgo: 320,
    flags: ["time-bound"],
  },
  {
    id: "c-ST-194-2026",
    caseNumber: "ST/194/2026",
    parties: { complainant: "Abdul Latheef", accused: "Trident Packaging" },
    stage: "evidence",
    nextHearingInDays: 6,
    registeredDaysAgo: 150,
    flags: [],
  },
  {
    id: "c-ST-203-2026",
    caseNumber: "ST/203/2026",
    parties: { complainant: "Ashraf Kunju", accused: "Sabari Textiles" },
    stage: "cognizance",
    nextHearingInDays: null,
    registeredDaysAgo: 8,
    flags: [],
  },
  {
    id: "c-ST-211-2026",
    caseNumber: "ST/211/2026",
    parties: { complainant: "Ashokan Damodaran", accused: "Palm Grove Resorts" },
    stage: "process",
    nextHearingInDays: 11,
    registeredDaysAgo: 45,
    flags: ["utp"],
  },
  {
    id: "c-ST-219-2026",
    caseNumber: "ST/219/2026",
    parties: { complainant: "Anitha Vasudevan", accused: "Ocean Pearl Seafoods" },
    stage: "evidence",
    nextHearingInDays: 8,
    registeredDaysAgo: 130,
    flags: ["stayed"],
  },
  {
    id: "c-ST-224-2026",
    caseNumber: "ST/224/2026",
    parties: { complainant: "Aboobacker Sidhique", accused: "Mangala Cashews" },
    stage: "plea",
    nextHearingInDays: 12,
    registeredDaysAgo: 110,
    flags: [],
  },
  {
    id: "c-ST-231-2026",
    caseNumber: "ST/231/2026",
    parties: { complainant: "Aliyar Kunju", accused: "Kerala Spice Traders" },
    stage: "cognizance",
    nextHearingInDays: null,
    registeredDaysAgo: 5,
    flags: [],
  },
  {
    id: "c-ST-236-2026",
    caseNumber: "ST/236/2026",
    parties: {
      complainant: "Ajitha Chandrasekharan",
      accused: "Unity Hardware Mart",
    },
    stage: "arguments",
    nextHearingInDays: 2,
    registeredDaysAgo: 275,
    flags: ["appellate-pending", "time-bound"],
  },
  {
    id: "c-ST-29-2025",
    caseNumber: "ST/29/2025",
    parties: { complainant: "Aneesh Gopakumar", accused: "Highland Rubber Works" },
    stage: "evidence",
    nextHearingInDays: 14,
    registeredDaysAgo: 420,
    flags: ["stayed"],
  },
  {
    id: "c-ST-57-2025",
    caseNumber: "ST/57/2025",
    parties: { complainant: "Anwar Sadath", accused: "Riverside Constructions" },
    stage: "process",
    nextHearingInDays: 10,
    registeredDaysAgo: 390,
    flags: ["appellate-pending"],
  },
];

/** Everything on this court's file. */
/**
 * The specifics behind each flag — what turns a priority from a count into an action. A
 * flag says a case is time-bound; the bench needs "its disposal deadline is in three days"
 * to sort it and to know what to do. Keyed by case number, merged onto the register below.
 * Demo data standing in for fields the real record carries. Every flagged case has its
 * matching detail here — `cases.test.ts` asserts none is left bare.
 */
const PRIORITY_DETAIL: Record<
  string,
  {
    custodyDays?: number;
    deadlineInDays?: number;
    serviceOverdueDays?: number;
    higherCourt?: string;
  }
> = {
  "ST/249/2026": { custodyDays: 63 },
  "ST/211/2026": { custodyDays: 28 },
  "ST/186/2026": { deadlineInDays: 1 },
  "ST/254/2026": { deadlineInDays: 3 },
  "ST/236/2026": { deadlineInDays: 6, higherCourt: "Sessions Court" },
  "ST/112/2026": { deadlineInDays: 9 },
  "ST/163/2026": { serviceOverdueDays: 34 },
  "ST/256/2026": { serviceOverdueDays: 22 },
  "ST/262/2026": { serviceOverdueDays: 11 },
  "ST/158/2026": { higherCourt: "High Court" },
  "ST/219/2026": { higherCourt: "High Court" },
  "ST/29/2025": { higherCourt: "Sessions Court" },
  "ST/147/2026": { higherCourt: "Sessions Court" },
  "ST/57/2025": { higherCourt: "High Court" },
};

export const COURT_CASES: CourtCase[] = [
  ...LISTED_TODAY,
  ...NOT_LISTED_TODAY,
].map((record) => ({ ...record, ...PRIORITY_DETAIL[record.caseNumber] }));

/** What the rail's row says. Derived, so the row and the screen agree. */
export const COURT_CASE_COUNT = COURT_CASES.length;

/** How many cases a priority holds. Zero is a real answer and the tile says so. */
export function courtPriorityCount(
  priority: CourtPriority,
  register: CourtCase[] = COURT_CASES,
): number {
  return register.filter(priority.matches).length;
}

function shiftDay(day: string, days: number): string {
  const date = parseIsoDay(day);
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** The next listing as a day, or `null` when no date is fixed. */
export function nextHearingDay(
  record: CourtCase,
  today: string,
): string | null {
  return record.nextHearingInDays === null
    ? null
    : shiftDay(today, record.nextHearingInDays);
}

/** The day the case came on this court's file. */
export function registeredDay(record: CourtCase, today: string): string {
  return shiftDay(today, -record.registeredDaysAgo);
}

/** "A v. B" — the cause title, written the way the cause list writes it. */
export function courtCaseTitle(record: CourtCase): string {
  return `${record.parties.complainant} v. ${record.parties.accused}`;
}

export type CourtCaseFilters = {
  query: string;
  /** `null` is every stage. */
  stage: CourtCaseStage | null;
  /** The tile that is pressed, if any. `null` is the whole register. */
  priority: CourtPriorityId | null;
};

export const EMPTY_COURT_CASE_FILTERS: CourtCaseFilters = {
  query: "",
  stage: null,
  priority: null,
};

export function hasCourtCaseFilters(filters: CourtCaseFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.stage !== null ||
    filters.priority !== null
  );
}

/**
 * The register, narrowed.
 *
 * Free text matches the case number and either party — the three things a court clerk
 * actually has in hand when they are looking for a file. Matching is case- and
 * space-insensitive on the number because "st/241/2026" is the same file as "ST/241/2026"
 * and nobody should have to know that.
 */
export function filterCourtCases(
  filters: CourtCaseFilters,
  register: CourtCase[] = COURT_CASES,
): CourtCase[] {
  const query = caseSearchKey(filters.query);
  const priority =
    filters.priority === null ? null : courtPriorityById(filters.priority);

  return register.filter((record) => {
    if (filters.stage !== null && record.stage !== filters.stage) return false;
    if (priority && !priority.matches(record)) return false;
    if (!query) return true;
    return (
      record.caseNumber.toLowerCase().includes(query) ||
      record.parties.complainant.toLowerCase().includes(query) ||
      record.parties.accused.toLowerCase().includes(query) ||
      courtCaseTitle(record).toLowerCase().includes(query)
    );
  });
}

/* --------------------------------------------------------------- attention */

export type CaseAttentionKind = "custody" | "deadline" | "service";

export type CaseAttention = {
  kind: CaseAttentionKind;
  /** The plain sentence shown on the row — the specific number, not a category name. */
  reason: string;
};

/**
 * The one thing, if any, that makes a case need timely action — with the sentence that
 * says why. Custody comes before everything (a person's liberty), then a disposal deadline
 * a higher court fixed, then a summons whose service report has not come back. A case with
 * none of these is not here; being stayed or under appeal is awareness, handled apart.
 */
export function caseAttention(record: CourtCase): CaseAttention | undefined {
  if (record.custodyDays != null) {
    return {
      kind: "custody",
      reason: `In custody for ${record.custodyDays} days`,
    };
  }
  if (record.deadlineInDays != null) {
    const days = record.deadlineInDays;
    const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    return { kind: "deadline", reason: `Disposal deadline ${when}` };
  }
  if (record.serviceOverdueDays != null) {
    return {
      kind: "service",
      reason: `Service report overdue by ${record.serviceOverdueDays} days`,
    };
  }
  return undefined;
}

/**
 * The cases to act on first, most urgent first.
 *
 * Ordered by kind, not a blended score, because the order is a rule a court would defend:
 * everyone in custody first (longest wait on top), then the nearest disposal deadline,
 * then the most overdue service. No arithmetic that could seat a 40-day-overdue summons
 * above a person who has been in jail two months.
 */
export function actNowCases(
  register: CourtCase[] = COURT_CASES,
): { record: CourtCase; attention: CaseAttention }[] {
  const rank: Record<CaseAttentionKind, number> = {
    custody: 0,
    deadline: 1,
    service: 2,
  };
  return register
    .map((record) => ({ record, attention: caseAttention(record) }))
    .filter(
      (row): row is { record: CourtCase; attention: CaseAttention } =>
        row.attention !== undefined,
    )
    .sort((a, b) => {
      if (a.attention.kind !== b.attention.kind) {
        return rank[a.attention.kind] - rank[b.attention.kind];
      }
      switch (a.attention.kind) {
        case "custody":
          return (b.record.custodyDays ?? 0) - (a.record.custodyDays ?? 0);
        case "deadline":
          return (a.record.deadlineInDays ?? 0) - (b.record.deadlineInDays ?? 0);
        case "service":
          return (
            (b.record.serviceOverdueDays ?? 0) - (a.record.serviceOverdueDays ?? 0)
          );
      }
    });
}

/**
 * Cases a higher court has a hand in — stayed, or with an appeal or revision live above.
 * Awareness, not an action queue: a stayed matter must not be proceeded with, and one
 * under appeal is being decided elsewhere. Oldest on the file first.
 */
export function underHigherCourtCases(
  register: CourtCase[] = COURT_CASES,
): { record: CourtCase; reason: string }[] {
  return register
    .filter(
      (record) =>
        record.flags.includes("stayed") ||
        record.flags.includes("appellate-pending"),
    )
    .map((record) => {
      const court = record.higherCourt ?? "a higher court";
      const reason = record.flags.includes("stayed")
        ? `Stayed by the ${court}`
        : `Pending in the ${court}`;
      return { record, reason };
    })
    .sort((a, b) => b.record.registeredDaysAgo - a.record.registeredDaysAgo);
}

/**
 * "1 year 2 months", "3 months", "18 days" — how long a case has been on the file.
 *
 * Rounded to the unit a court would say out loud: days below a month, whole months below
 * a year, then years and the remaining months, with the second unit dropped when it is
 * zero so nothing reads "1 year 0 months".
 *
 * **A year is 365 days here and a month is 30, deliberately.** Deriving months from the
 * astronomical 30.44 and then taking years out of *those* makes 365 days read as "11
 * months", which is not what anybody means by a case that was filed a year ago today.
 * This is a phrase a person says about a file, not an interval calculation.
 */
export function courtCaseAge(days: number): string {
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"}`;
  const years = Math.floor(days / 365);
  if (years === 0) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? "month" : "months"}`;
  }
  const months = Math.floor((days % 365) / 30);
  const yearPart = `${years} ${years === 1 ? "year" : "years"}`;
  if (months === 0) return yearPart;
  return `${yearPart} ${months} ${months === 1 ? "month" : "months"}`;
}
