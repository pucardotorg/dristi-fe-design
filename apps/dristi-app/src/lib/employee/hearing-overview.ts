/**
 * The facts behind one listing's case overview — the page the bench opens when it
 * starts a hearing.
 *
 * Restated here rather than imported from `lib/cases/peek.ts` because the employee
 * area does not read the citizen side (see `content.ts`). The *shape* of the glance
 * is the same one: parties, stage, the last sitting, a short history.
 * Advocate-only facts — "you appear", pending tasks, a link into the advocate case
 * file — are not restated. There is no court-side case file yet, which is also why
 * the overview page's View case action is not wired to one.
 *
 * **There is no backend.** Extras are demo rows keyed to `CAUSE_LIST`, enough for
 * the page to survive a first listing (no last sitting) and a part-heard evidence
 * matter (an order of the day). A hearing with no extras still renders: the listing
 * itself is the case.
 */

import {
  COURT_CASE_STAGES,
  formatListingDate,
  parseIsoDay,
  shiftDay,
  type CourtCaseStage,
  type CourtHearing,
} from "./hearings";
import {
  FILING_WINDOW_DAYS,
  PAYMENT_WINDOW_DAYS,
  niWindowNote,
  type NiWindowStatus,
} from "./ni-act";

export type HearingCaseExtras = {
  filedOn?: string;
  chequeAmount?: number;
  lastHearing?: {
    on: string;
    purpose: string;
    order: string;
    directed: boolean;
  };
};

export function formatCaseDate(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseIsoDay(day));
}

export function formatCaseWeekday(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseIsoDay(day));
}

export function formatChequeAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** "A and B" — the same sentence the advocate peek uses for counsel. */
export function formatCounselList(names: string[]): string {
  return new Intl.ListFormat("en-IN", {
    style: "long",
    type: "conjunction",
  }).format(names);
}

export function hearingCaseExtras(id: string): HearingCaseExtras {
  return HEARING_CASE_EXTRAS[id] ?? {};
}

const HEARING_CASE_EXTRAS: Partial<Record<string, HearingCaseExtras>> = {
  "h-241": {
    filedOn: "2026-03-12",
    chequeAmount: 450000,
    lastHearing: {
      on: "2026-08-19",
      purpose: "Evidence of complainant",
      order:
        "PW-1 was examined in chief and partly cross-examined. Further cross-examination was deferred at the request of counsel for the accused. The complainant was directed to keep PW-2 present and produce the original bank return memo on the next posting date.",
      directed: true,
    },
  },
  "h-243": {
    filedOn: "2026-06-04",
    chequeAmount: 180000,
  },
  "h-244": {
    filedOn: "2026-05-22",
    chequeAmount: 275000,
  },
  "h-245": {
    filedOn: "2026-07-08",
    chequeAmount: 90000,
  },
  "h-246": {
    filedOn: "2026-07-15",
    chequeAmount: 150000,
  },
  "h-247": {
    filedOn: "2026-04-30",
    chequeAmount: 320000,
  },
  "h-248": {
    filedOn: "2026-02-18",
    chequeAmount: 210000,
    lastHearing: {
      on: "2026-08-12",
      purpose: "Plea",
      order:
        "Accused pleaded not guilty. Matter posted for evidence of the complainant.",
      directed: true,
    },
  },
  "h-249": {
    filedOn: "2026-06-28",
    chequeAmount: 125000,
  },
  "h-250": {
    filedOn: "2026-01-16",
    chequeAmount: 620000,
    lastHearing: {
      on: "2026-08-05",
      purpose: "Evidence of complainant",
      order:
        "PW-1's examination-in-chief concluded. Cross-examination to continue.",
      directed: false,
    },
  },
  "h-251": {
    filedOn: "2025-11-04",
    chequeAmount: 840000,
    lastHearing: {
      on: "2026-07-29",
      purpose: "For reports",
      order:
        "Forensic report awaited. Matter posted for reports to be received.",
      directed: true,
    },
  },
  "h-252": {
    filedOn: "2026-06-11",
    chequeAmount: 95000,
  },
  "h-253": {
    filedOn: "2025-09-18",
    chequeAmount: 340000,
    lastHearing: {
      on: "2026-08-26",
      purpose: "Examination of accused under S. 351 BNSS",
      order:
        "Examination of the accused begun. Matter part-heard and posted for continuation.",
      directed: false,
    },
  },
  "h-254": {
    filedOn: "2025-08-07",
    chequeAmount: 410000,
    lastHearing: {
      on: "2026-08-14",
      purpose: "Arguments",
      order: "Arguments heard. Judgment reserved.",
      directed: true,
    },
  },
  "h-255": {
    filedOn: "2026-05-09",
    chequeAmount: 175000,
  },
  "h-256": {
    filedOn: "2026-07-02",
    chequeAmount: 80000,
  },
  "h-257": {
    filedOn: "2026-04-21",
    chequeAmount: 260000,
  },
  "h-258": {
    filedOn: "2026-01-28",
    chequeAmount: 390000,
    lastHearing: {
      on: "2026-08-21",
      purpose: "Evidence of complainant",
      order: "PW-1 kept present. Examination-in-chief to continue.",
      directed: false,
    },
  },
  "h-259": {
    filedOn: "2026-06-19",
    chequeAmount: 110000,
  },
  "h-260": {
    filedOn: "2025-06-03",
    chequeAmount: 505000,
    lastHearing: {
      on: "2026-08-28",
      purpose: "Arguments",
      order: "Arguments concluded. Posted for judgment.",
      directed: true,
    },
  },
  "h-261": {
    filedOn: "2026-03-27",
    chequeAmount: 145000,
    lastHearing: {
      on: "2026-07-22",
      purpose: "Appearance",
      order: "Accused appeared. Posted for plea.",
      directed: true,
    },
  },
  "h-262": {
    filedOn: "2026-07-11",
    chequeAmount: 70000,
  },
  "h-263": {
    filedOn: "2025-12-16",
    chequeAmount: 230000,
    lastHearing: {
      on: "2026-08-07",
      purpose: "Arguments",
      order: "Part-heard. Counsel for the accused to conclude.",
      directed: false,
    },
  },
  "h-264": {
    filedOn: "2026-05-14",
    chequeAmount: 160000,
  },
};

/* ──────────────────────────── the case's timeline ─────────────────────────── */

/**
 * One dated step in a matter's life, as the timeline prints it.
 *
 * `on` is `null` for the step that has not closed — today's sitting, which is happening
 * while the bench reads this. Everything else carries the day it closed, because a date
 * is the one form of this fact nobody has to re-anchor to anything (owner, 2026-09-12).
 */
export type CaseTimelineStep = {
  id: string;
  label: string;
  on: string | null;
  /** What the step means: the statutory window it closes. Never the arithmetic. */
  note?: string;
  aside?: string;
  tone?: "warning";
  status: "past" | "current";
  /** Where the step's entity opens — the event catalogue's Link To. */
  href?: string;
};

/**
 * What the court has done, as events. The cheque's chain before filing is not shown
 * (owner, 2026-10-14); it is still built, because the filing note is measured from it.
 */
export type CaseTimeline = {
  inCourt: CaseTimelineStep[];
};

/** "12 Jul 2025" — the day as it sits in a column of other days. */
export function formatTimelineDate(day: string): string {
  return formatListingDate(day);
}

/**
 * The serial out of a case number — "ST/241/2026" is 241.
 *
 * The serial rather than the whole string because it is the part that differs between
 * two matters of the same year: seeding off the year would give every case on the board
 * an identical chain.
 */
function seedOf(caseNumber: string): number {
  const serial = caseNumber.match(/(\d+)/);
  return serial ? Number(serial[1]) : 0;
}

type StatutoryChain = {
  chequeOn: string;
  presentedOn: string;
  returnedOn: string;
  noticeSentOn: string;
  noticeServedOn: string;
  accruedOn: string;
  presentationDays: number;
  noticeDays: number;
  sinceAccrual: number;
};

/**
 * The §138 chain behind a filing date, built backwards from it.
 *
 * Backwards because the filing date is the one real fact the cause list holds — every
 * matter on the board has already been filed — and the six steps that had to precede it
 * are fixed in order and spacing by the statute itself. Walking back from the filing
 * date produces a chain that is self-consistent by construction: no generated matter can
 * have a notice sent before its cheque bounced.
 *
 * The moduli are the register queue's own (`chainFor`), so a matter demonstrated in one
 * screen and a matter demonstrated in the other look like they came from the same court.
 * They are sized to stay clear of the two windows this build never puts a listed matter
 * outside of: a case that reached the cause list was taken on file, so its cheque was
 * presented in time and its notice was sent in time. Filing is the one window a listed
 * matter can be outside — that is what a delay condonation application is for, and the
 * matter listed for one is the matter whose chain says so.
 *
 * **None of this is a court record.** It is demo data, deterministic from the case
 * number so a screenshot taken twice shows the same case.
 */
function statutoryChain(
  filedOn: string,
  seed: number,
  late: boolean,
): StatutoryChain {
  const sinceAccrual = late ? 44 + (seed % 90) : 4 + (seed % 24);
  const accruedOn = shiftDay(filedOn, -sinceAccrual);
  const noticeServedOn = shiftDay(accruedOn, -PAYMENT_WINDOW_DAYS);
  const noticeSentOn = shiftDay(noticeServedOn, -(2 + (seed % 4)));
  const noticeDays = 3 + (seed % 22);
  const returnedOn = shiftDay(noticeSentOn, -noticeDays);
  const presentedOn = shiftDay(returnedOn, -(1 + (seed % 3)));
  const presentationDays = 6 + (seed % 70);
  const chequeOn = shiftDay(presentedOn, -presentationDays);

  return {
    chequeOn,
    presentedOn,
    returnedOn,
    noticeSentOn,
    noticeServedOn,
    accruedOn,
    presentationDays,
    noticeDays,
    sinceAccrual,
  };
}

/**
 * The court's record, as events from the event catalogue (PUCAR Dashboard 2027 —
 * Events/Case Updates; owner 2026-10-14 picked which). Each label is the catalogue's
 * Events column with its variables filled; each link is its Link To, opened on the one
 * demo case every listing opens (`HEARING_DEMO_CASE`). An event whose Link To is N/A or
 * blank links to its Associated Entity where the case view has one, or not at all.
 *
 * Which events a matter has is read off the stages it has passed: cognizance and the
 * summons follow taking the complaint on file, delivery comes before the accused can be
 * at appearance, and joining the case and the bail application come with appearance.
 */
const HEARING_DEMO_CASE = "/employee/cases/c-1001";

function demoCaseFileDoc(doc: string): string {
  return `${HEARING_DEMO_CASE}?section=case-file&doc=${doc}`;
}

type CourtEvent = {
  id: string;
  /** The stage the matter must have reached for the event to have happened. */
  reached: CourtCaseStage | "filed";
  /** Strictly passed, not merely reached. */
  passed?: boolean;
  /** Where it falls between filing and the last sitting, as a fraction. */
  at: number;
  label: (hearing: CourtHearing) => string;
  href?: string;
};

/** Not evenly spaced, because a §138 matter is not: registration and cognizance follow
 *  the filing within days, service takes weeks, appearance takes months. */
const COURT_EVENTS: CourtEvent[] = [
  {
    id: "case-registered",
    reached: "filed",
    at: 0.03,
    label: () => "Case Registered",
  },
  {
    id: "cognizance-taken",
    reached: "cognizance",
    passed: true,
    at: 0.1,
    label: () => "Cognizance Taken",
    href: demoCaseFileDoc("order-cognizance"),
  },
  {
    id: "summons-issued",
    reached: "cognizance",
    passed: true,
    at: 0.15,
    label: () => "Summons Issued",
    href: demoCaseFileDoc("order-issuing-summons"),
  },
  {
    id: "summons-delivered",
    reached: "appearance",
    at: 0.3,
    label: () => "Summons Status Updated - Delivered",
    href: demoCaseFileDoc("process-summons"),
  },
  {
    id: "accused-joined",
    reached: "appearance",
    passed: true,
    at: 0.46,
    label: (hearing) => `Accused ${hearing.parties.accused} Joined Case`,
    href: `${HEARING_DEMO_CASE}?section=parties`,
  },
  {
    /* The catalogue has no "application filed" event; an application enters the case
       when the magistrate onboards it. */
    id: "bail-onboarded",
    reached: "appearance",
    passed: true,
    at: 0.47,
    label: () => "Application - Bail onboarded",
    href: `${HEARING_DEMO_CASE}?section=applications&application=sub-1001-bail`,
  },
];

function hasHappened(event: CourtEvent, stage: CourtCaseStage): boolean {
  if (event.reached === "filed") return true;
  const order = COURT_CASE_STAGES.map((entry) => entry.id);
  const at = order.indexOf(stage);
  const needed = order.indexOf(event.reached);
  return event.passed ? at > needed : at >= needed;
}

/**
 * A matter's whole timeline: the cheque's chain, then the court's record.
 *
 * Built rather than stored. Every listing on the board carries a filing date, a stage and
 * a purpose, and those three plus the statute determine the rest — so twenty-three
 * matters get twenty-three consistent histories without twenty-three hand-written blocks
 * that would eventually contradict each other about which comes first.
 *
 * The court's half holds events from the catalogue only — not the sittings, which are
 * not events there. A listing with no filing date on its sidecar has no known events.
 */
export function caseTimeline(
  hearing: CourtHearing,
  extras: HearingCaseExtras,
  today: string,
): CaseTimeline {
  if (!extras.filedOn) return { inCourt: [] };

  const seed = seedOf(hearing.caseNumber);
  /* The matter listed for a delay condonation is the matter that was filed late. The
     board says so on the row; the chain has to agree with it or the screen argues with
     itself two clicks apart. */
  const late = hearing.purpose === "delay-condonation";
  const chain = statutoryChain(extras.filedOn, seed, late);

  const filing: NiWindowStatus =
    chain.sinceAccrual <= FILING_WINDOW_DAYS
      ? "within"
      : /* Late, and the matter is before the court today to ask that it be excused. */
        late
        ? "condonation-sought"
        : "outside";

  const inCourt: CaseTimelineStep[] = [
    {
      id: "case-filed",
      label: "Case Filed",
      on: extras.filedOn,
      status: "past",
      ...niWindowNote("filing", filing),
    },
  ];

  /* Events run from the filing to the last sitting the court held — or to today, for a
     matter whose first sitting this is. Never earlier than the event before them. */
  const reachedOn = extras.lastHearing?.on ?? today;
  const span = daysApart(extras.filedOn, reachedOn);
  let previous = extras.filedOn;
  for (const event of COURT_EVENTS) {
    if (!hasHappened(event, hearing.stage)) continue;
    const proposed = shiftDay(
      extras.filedOn,
      Math.max(1, Math.round(span * event.at)),
    );
    const on = proposed < previous ? previous : proposed;
    previous = on;
    inCourt.push({
      id: event.id,
      label: event.label(hearing),
      on,
      status: "past",
      href: event.href,
    });
  }

  return { inCourt };
}

/** Whole days between two `YYYY-MM-DD` days. */
function daysApart(from: string, to: string): number {
  return Math.round(
    (parseIsoDay(to).getTime() - parseIsoDay(from).getTime()) / 86400000,
  );
}
