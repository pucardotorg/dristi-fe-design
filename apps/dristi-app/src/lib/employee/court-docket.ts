/**
 * One generated court, for the magistrate dashboard and the registers.
 *
 * DEMO DATA, NOT A BACKEND. There is no court docket behind the court side yet, so the
 * dashboard and every register read this one seeded court: about 2,500 NI Act §138
 * complaints filed over the last 24 months, each walked through the note's six stages
 * (registration, cognizance, appearance, bail, trial, judgement) by a seeded random
 * process. It is the owner-approved mockup's generator, ported as it was.
 *
 * Two promises make it worth having, and the tests hold both:
 *
 * - **One source.** The dashboard's numbers and the registers' rows are the same cases,
 *   so a tile's count is the row count of the register it opens, and an overdue count is
 *   the length of the list under it.
 * - **The statements reconcile.** Opening pendency + filed − disposed − moved to long
 *   pending = closing pendency, in every month, quarter and financial year.
 *
 * **Anchored to the court's today, like the rest of the demo.** The other fixtures store
 * offsets from today so a demo never goes stale; this does the same by generating the 24
 * months that end in today's month. The same day always produces the same court
 * (`courtDocket(day)` is cached per day), so a server render and the browser's hydration
 * agree whenever they agree on the day — which is `useCourtToday`'s own contract.
 *
 * Kerala is the designed baseline: filing numbers `KL-000123-2025`, `CMP/123/2025` at
 * registration, `ST/123/2025` at cognizance, `LP/12/2025` for long pending, and copy
 * applications `CA/12/2025`. Screens re-voice them for another state at display time.
 *
 * Dates are UTC epoch milliseconds at midnight: whole days, with no timezone to drift.
 */

export const DAY_MS = 86_400_000;

export type StageKey =
  | "registration"
  | "cognizance"
  | "appearance"
  | "bail"
  | "trial"
  | "judgement";

/**
 * Every limit the dashboard judges a case by, in one place so it can become court
 * configuration later (the note's figures; the thresholds are not editable yet).
 *
 * - `stages` — days a case may sit in a stage before it is overdue.
 * - `process` — days a process may wait for payment, then delivery, and how close a
 *   hearing must be for unserved process to count as at risk.
 */
export const COURT_LIMITS = {
  stages: {
    registration: 3,
    cognizance: 70,
    appearance: 60,
    bail: 14,
    trial: 45,
    judgement: 10,
  } satisfies Record<StageKey, number>,
  process: {
    paymentPendingDays: 7,
    deliveryPendingDays: 14,
    hearingWithinDays: 14,
  },
} as const;

export type Stage = {
  key: StageKey;
  label: string;
  /** What the stage covers, mapped from the note's six stages (owner-finalized). */
  covers: string;
  /** Typical days between hearings in this stage — a generator parameter only. */
  gap: number;
  /** The purpose a next hearing in this stage is listed for. */
  purpose: string;
};

export const STAGES: Stage[] = [
  { key: "registration", label: "Registration", covers: "Filed, not yet registered", gap: 3, purpose: "" },
  { key: "cognizance", label: "Cognizance", covers: "Registered, awaiting cognizance", gap: 28, purpose: "Cognizance" },
  { key: "appearance", label: "Appearance", covers: "Process and appearance of the accused", gap: 24, purpose: "Appearance" },
  { key: "bail", label: "Bail", covers: "Accused appeared, bail not yet granted", gap: 7, purpose: "Bail" },
  { key: "trial", label: "Trial", covers: "Plea, evidence and arguments", gap: 18, purpose: "Evidence" },
  { key: "judgement", label: "Judgement", covers: "Reserved for judgement", gap: 6, purpose: "Judgement" },
];

const STAGE_BY_KEY = Object.fromEntries(STAGES.map((stage) => [stage.key, stage])) as Record<
  StageKey,
  Stage
>;

export function stageByKey(key: StageKey): Stage {
  return STAGE_BY_KEY[key];
}

/** The stages a hearing is held in — registration has none. */
export const HEARING_STAGES = STAGES.filter((stage) => stage.key !== "registration");

export type DisposalMethod =
  | "Settled"
  | "Withdrawn"
  | "Dismissed"
  | "Returned"
  | "Convicted"
  | "Acquitted";

/** Disposals without a contest, as the statement of pendency counts them. */
export const UNCONTESTED: ReadonlySet<DisposalMethod> = new Set([
  "Settled",
  "Withdrawn",
  "Dismissed",
  "Returned",
]);

export type ProcessType = "Notice" | "Summons" | "Warrant";

export type CourtProcess = {
  type: ProcessType;
  issued: number;
  paid: number | null;
  delivered: number | null;
  /** The stage the process belongs to: notice at cognizance, the rest at appearance. */
  stage: StageKey;
};

export type CmpApplication = {
  /** `CMP/…`, from the same sequence registrations draw on. */
  number: string;
  submitted: number;
  type: string;
  side: "Complainant" | "Accused";
  filedBy: string;
  petitioner: string;
  decided: number | null;
  status: "Allowed" | "Rejected" | "Pending";
};

export type Deposition = {
  date: number;
  witness: string;
  designation: string;
  party: "Complainant" | "Accused";
  markedAsEvidence: boolean;
};

export type DocketCase = {
  id: number;
  filed: number;
  complainant: string;
  accused: string;
  title: string;
  advocate: string;
  accusedAdvocate: string;
  /** Stages already left, with their dates and the hearings held in each. */
  log: { stage: StageKey; start: number; end: number; hearings: number }[];
  processes: CourtProcess[];
  applications: CmpApplication[];
  depositions: Deposition[];
  registeredAt: number | null;
  cognizanceAt: number | null;
  bailAt: number | null;
  disposal: { at: "ST" | "CMP"; date: number; method: DisposalMethod } | null;
  longPendingAt: number | null;
  /** The stage it is in now; `null` once disposed or moved to long pending. */
  stage: StageKey | null;
  stageStart: number | null;
  /** Hearings held in the current stage. */
  stageHearings: number;
  /** Hearings held over the whole case. */
  hearings: number;
  previousPosting: number | null;
  nextHearing: number | null;
  nextPurpose: string | null;
  filingNumber: string;
  cmpNumber: string | null;
  stNumber: string | null;
  lpNumber: string | null;
  /** The case's current number: ST once numbered, else CMP, else the filing number. */
  caseNumber: string;
};

export type CopyApplication = {
  number: string;
  applied: number;
  case: DocketCase;
  sheets: number;
  fee: number;
  issued: number | null;
  applicant: string;
  details: string;
};

export type CourtDocket = {
  today: number;
  /** The first day of the first generated month (24 months, ending in today's month). */
  start: number;
  cases: DocketCase[];
  copies: CopyApplication[];
  /** Days between successive hearings, by the stage they were held in. */
  gaps: Record<StageKey, number[]>;
  /**
   * The same gaps with the day of the hearing that closed each one, oldest first, so a
   * period can be read: the gaps whose hearing fell inside it. Gaps that would close after
   * today are left out.
   */
  gapLog: HearingGap[];
};

export type HearingGap = { stage: StageKey; date: number; days: number };

/* ------------------------------------------------------------------ dates */

/** `YYYY-MM-DD` to UTC midnight. */
export function dayToMs(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

/** UTC midnight back to `YYYY-MM-DD`. */
export function msToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b`. */
export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / DAY_MS);
}

export function yearOf(ms: number): number {
  return new Date(ms).getUTCFullYear();
}

/** A month as one integer (year × 12 + month), for grouping and comparing. */
export function monthKey(ms: number): number {
  const date = new Date(ms);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function monthStart(key: number): number {
  return Date.UTC(Math.floor(key / 12), key % 12, 1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 2025". */
export function monthLabel(key: number): string {
  return `${MONTHS[key % 12]} ${Math.floor(key / 12)}`;
}

/** "Oct". */
export function monthShortLabel(key: number): string {
  return MONTHS[key % 12];
}

/* ------------------------------------------------------------- the generator */

const SEED = 138138;

const MEN = ["Suresh", "Anil", "Rajesh", "Biju", "Thomas", "Abdul", "Manoj", "Sunil", "Ravi", "Jose", "Shaji", "Vinod", "Ajith", "Sabu", "Rahim", "Gopakumar", "Pradeep", "Saji", "Harikumar", "Sajeev"];
const WOMEN = ["Priya", "Sreeja", "Fathima", "Deepa", "Mary", "Lekha", "Anitha", "Bindu", "Shiny", "Remya", "Sheeba", "Jaya"];
const SURNAMES = ["Pillai", "Menon", "Nair", "Kurup", "Warrier", "Nambiar", "Panicker", "Unnithan", "Thampi", "Achari", "Kunju", "Rawther", "Varghese", "Joseph", "Kurian", "George", "Mathew", "Abraham"];
const FIRMS = ["Chaithanya Agencies", "Ashtamudi Finance", "Sreevalsam Chits", "Quilon Traders", "Malabar Motors", "Anjali Gold Loans", "Thangassery Fisheries", "Karunagappally Cashews", "Punalur Plywoods", "Paravur Hardwares", "Kadappakada Textiles", "Chinnakada Electricals"];
const COMPLAINANT_APPLICATIONS = ["Condonation of delay", "Amendment of complaint", "Return of documents", "Adjournment"];
const ACCUSED_APPLICATIONS = ["Exemption from personal appearance", "Recall of warrant", "Adjournment", "Return of documents"];
const WITNESSES: [string, "Complainant" | "Accused"][] = [
  ["Complainant", "Complainant"],
  ["Bank manager", "Complainant"],
  ["Power of attorney holder", "Complainant"],
  ["Accused", "Accused"],
  ["Defence witness", "Accused"],
];

function generate(todayDay: string): CourtDocket {
  const TODAY = dayToMs(todayDay);
  const todayMonth = monthKey(TODAY);
  const firstMonth = todayMonth - 23;
  const start = monthStart(firstMonth);

  /* A linear congruential generator: the same seed gives the same court, everywhere. */
  let state = SEED;
  const rnd = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
  const person = () => `${rnd() < 0.72 ? pick(MEN) : pick(WOMEN)} ${pick(SURNAMES)}`;

  const gaps = Object.fromEntries(STAGES.map((stage) => [stage.key, [] as number[]])) as Record<
    StageKey,
    number[]
  >;

  function drawDuration(key: StageKey): number {
    switch (key) {
      case "registration":
        return rnd() < 0.84 ? ri(0, 3) : ri(4, 11);
      case "cognizance":
        return ri(14, 108);
      case "appearance":
        return rnd() < 0.7 ? ri(18, 75) : ri(76, 170);
      case "bail":
        return rnd() < 0.72 ? ri(1, 14) : ri(15, 42);
      case "trial":
        return rnd() < 0.45 ? ri(20, 45) : ri(46, 130);
      case "judgement":
        return rnd() < 0.72 ? ri(2, 10) : ri(11, 26);
    }
  }

  function addProcess(c: Omit<DocketCase, "id">, type: ProcessType, issued: number) {
    if (issued > TODAY) return;
    let paid: number | null = issued + (rnd() < 0.8 ? ri(0, 6) : ri(7, 26)) * DAY_MS;
    if (paid > TODAY) paid = null;
    let delivered: number | null = null;
    if (paid !== null) {
      delivered = paid + (rnd() < 0.82 ? ri(3, 14) : ri(15, 48)) * DAY_MS;
      if (delivered > TODAY) delivered = null;
    }
    c.processes.push({
      type,
      issued,
      paid,
      delivered,
      stage: type === "Notice" ? "cognizance" : "appearance",
    });
  }

  const gapLog: HearingGap[] = [];

  /* Dating the gaps draws nothing extra from the generator, so the court is the same
     court it was before they were dated. */
  function heldIn(key: StageKey, duration: number, from: number): number {
    if (key === "registration") return 0;
    const gap = STAGE_BY_KEY[key].gap * (0.6 + rnd() * 0.8);
    const held = Math.floor(duration / gap);
    let date = from;
    for (let i = 0; i < Math.min(held, 12); i++) {
      const days = Math.max(1, Math.round(gap * (0.45 + rnd() * 1.1)));
      gaps[key].push(days);
      date += days * DAY_MS;
      if (date <= TODAY) gapLog.push({ stage: key, date, days });
    }
    return held;
  }

  function addDepositions(c: Omit<DocketCase, "id">, from: number, to: number, count: number) {
    for (let i = 0; i < count; i++) {
      const [designation, party] =
        i === 0
          ? WITNESSES[c.complainant.includes(" ") && !FIRMS.includes(c.complainant) ? 0 : 2]
          : pick(WITNESSES);
      const date = from + ri(3, Math.max(4, daysBetween(from, to))) * DAY_MS;
      if (date > TODAY) continue;
      c.depositions.push({
        date,
        witness:
          designation === "Complainant"
            ? c.complainant
            : designation === "Accused"
              ? c.accused
              : person(),
        designation,
        party,
        markedAsEvidence: rnd() < 0.72,
      });
    }
  }

  function simulate(filed: number): Omit<DocketCase, "id"> {
    const firm = rnd() < 0.55;
    const complainant = firm ? pick(FIRMS) : person();
    const accused = person();
    const c: Omit<DocketCase, "id"> = {
      filed,
      complainant,
      accused,
      title: `${complainant} v. ${accused}`,
      advocate: `Adv. ${person()}`,
      accusedAdvocate: `Adv. ${person()}`,
      log: [],
      processes: [],
      applications: [],
      depositions: [],
      registeredAt: null,
      cognizanceAt: null,
      bailAt: null,
      disposal: null,
      longPendingAt: null,
      stage: null,
      stageStart: null,
      stageHearings: 0,
      hearings: 0,
      previousPosting: null,
      nextHearing: null,
      nextPurpose: null,
      filingNumber: "",
      cmpNumber: null,
      stNumber: null,
      lpNumber: null,
      caseNumber: "",
    };

    let t = filed;
    for (const stage of STAGES) {
      const duration = drawDuration(stage.key);
      if (t + duration * DAY_MS > TODAY) {
        c.stage = stage.key;
        c.stageStart = t;
        c.stageHearings = heldIn(stage.key, daysBetween(t, TODAY), t);
        if (stage.key === "cognizance") addProcess(c, "Notice", t + ri(0, 6) * DAY_MS);
        if (stage.key === "appearance") {
          addProcess(c, "Summons", t + ri(0, 4) * DAY_MS);
          if (daysBetween(t, TODAY) > 50 && rnd() < 0.5) addProcess(c, "Warrant", t + ri(42, 50) * DAY_MS);
        }
        if (stage.key === "trial" && daysBetween(t, TODAY) > 15) addDepositions(c, t, TODAY, ri(0, 2));
        break;
      }
      const end = t + duration * DAY_MS;
      c.log.push({ stage: stage.key, start: t, end, hearings: heldIn(stage.key, duration, t) });
      if (stage.key === "cognizance") addProcess(c, "Notice", t + ri(0, 6) * DAY_MS);
      if (stage.key === "appearance") {
        addProcess(c, "Summons", t + ri(0, 4) * DAY_MS);
        if (duration > 50 && rnd() < 0.5) addProcess(c, "Warrant", t + ri(42, 50) * DAY_MS);
      }
      if (stage.key === "trial") addDepositions(c, t, end, ri(1, 3));
      t = end;
      if (stage.key === "registration") c.registeredAt = t;
      if (stage.key === "cognizance") {
        if (rnd() < 0.07) {
          c.disposal = { at: "CMP", date: t, method: pick(["Withdrawn", "Dismissed", "Returned"] as const) };
          break;
        }
        c.cognizanceAt = t;
      }
      if (stage.key === "appearance") {
        const r = rnd();
        if (r < 0.27) {
          c.disposal = { at: "ST", date: t, method: "Settled" };
          break;
        }
        if (duration > 95 && r < 0.5) {
          c.longPendingAt = t;
          break;
        }
      }
      if (stage.key === "bail") c.bailAt = t;
      if (stage.key === "trial") {
        const r = rnd();
        if (r < 0.13) {
          c.disposal = { at: "ST", date: t, method: "Settled" };
          break;
        }
        if (r < 0.18) {
          c.disposal = { at: "ST", date: t, method: "Withdrawn" };
          break;
        }
      }
      if (stage.key === "judgement") {
        c.disposal = { at: "ST", date: t, method: rnd() < 0.6 ? "Convicted" : "Acquitted" };
      }
    }

    c.hearings = c.log.reduce((sum, entry) => sum + entry.hearings, 0) + c.stageHearings;
    const closed = c.disposal ? c.disposal.date : c.longPendingAt;

    if (c.registeredAt !== null) {
      const count = rnd() < 0.45 ? ri(1, 2) : 0;
      for (let i = 0; i < count; i++) {
        const submitted =
          c.registeredAt + ri(1, Math.max(2, daysBetween(c.registeredAt, closed ?? TODAY))) * DAY_MS;
        if (submitted > TODAY) continue;
        const accusedSide = rnd() < 0.5 && c.cognizanceAt !== null;
        const decided = submitted + ri(2, 40) * DAY_MS;
        c.applications.push({
          number: "",
          submitted,
          type: accusedSide ? pick(ACCUSED_APPLICATIONS) : pick(COMPLAINANT_APPLICATIONS),
          side: accusedSide ? "Accused" : "Complainant",
          filedBy: accusedSide ? c.accusedAdvocate : c.advocate,
          petitioner: accusedSide ? accused : complainant,
          decided: decided <= TODAY ? decided : null,
          status: decided <= TODAY ? (rnd() < 0.8 ? "Allowed" : "Rejected") : "Pending",
        });
      }
    }

    if (closed === null && c.stage !== null && c.stage !== "registration" && c.stageStart !== null) {
      const gap = STAGE_BY_KEY[c.stage].gap;
      c.previousPosting = c.stageHearings > 0 ? TODAY - ri(1, Math.round(gap)) * DAY_MS : c.stageStart;
      c.nextHearing = rnd() < 0.045 ? null : TODAY + ri(1, Math.max(4, Math.round(gap * 1.25))) * DAY_MS;
      c.nextPurpose =
        c.stage === "trial"
          ? pick(["Plea", "Evidence", "Evidence", "Arguments"])
          : STAGE_BY_KEY[c.stage].purpose;
    } else if (closed !== null) {
      c.previousPosting = closed;
    }
    return c;
  }

  const drafts: Omit<DocketCase, "id">[] = [];
  for (let m = 0; ; m++) {
    const monthBegins = monthStart(firstMonth + m);
    if (monthBegins > TODAY) break;
    const monthEnds = Math.min(monthStart(firstMonth + m + 1) - DAY_MS, TODAY);
    const count = Math.round(70 + m * 3.1 + ri(-9, 9));
    const span = daysBetween(monthBegins, monthEnds) + 1;
    for (let i = 0; i < count; i++) drafts.push(simulate(monthBegins + ri(0, span - 1) * DAY_MS));
  }

  /* Numbering, in date order, so numbers rise with dates as a register's would. */
  const sequence = new Map<string, number>();
  const next = (prefix: string, year: number) => {
    const key = `${prefix}${year}`;
    const value = (sequence.get(key) ?? 0) + 1;
    sequence.set(key, value);
    return value;
  };
  drafts.sort((a, b) => a.filed - b.filed);
  for (const c of drafts) {
    const year = yearOf(c.filed);
    c.filingNumber = `KL-${String(next("F", year)).padStart(6, "0")}-${year}`;
  }
  const events: { t: number; c?: Omit<DocketCase, "id">; a?: CmpApplication }[] = [];
  for (const c of drafts) {
    if (c.registeredAt !== null) events.push({ t: c.registeredAt, c });
    for (const a of c.applications) events.push({ t: a.submitted, a });
  }
  events.sort((a, b) => a.t - b.t);
  for (const event of events) {
    const year = yearOf(event.t);
    const number = `CMP/${next("C", year)}/${year}`;
    if (event.c) event.c.cmpNumber = number;
    else if (event.a) event.a.number = number;
  }
  for (const c of drafts
    .filter((d) => d.cognizanceAt !== null)
    .sort((a, b) => (a.cognizanceAt ?? 0) - (b.cognizanceAt ?? 0))) {
    const year = yearOf(c.cognizanceAt!);
    c.stNumber = `ST/${next("S", year)}/${year}`;
  }
  for (const c of drafts
    .filter((d) => d.longPendingAt !== null)
    .sort((a, b) => (a.longPendingAt ?? 0) - (b.longPendingAt ?? 0))) {
    const year = yearOf(c.longPendingAt!);
    c.lpNumber = `LP/${next("L", year)}/${year}`;
  }
  const cases: DocketCase[] = drafts.map((c, id) => ({
    ...c,
    id,
    caseNumber: c.stNumber ?? c.cmpNumber ?? c.filingNumber,
  }));

  /* Certified copies: of a judgement, or of a paper in a pending case. */
  const copies: CopyApplication[] = [];
  for (const c of cases) {
    if ((c.disposal && rnd() < 0.05) || (!c.disposal && c.registeredAt !== null && rnd() < 0.012)) {
      const applied = Math.min(TODAY, (c.disposal ? c.disposal.date : c.registeredAt!) + ri(1, 30) * DAY_MS);
      const sheets = ri(3, 42);
      const issued = applied + ri(1, 9) * DAY_MS;
      copies.push({
        number: "",
        applied,
        case: c,
        sheets,
        fee: sheets * 3,
        issued: issued <= TODAY ? issued : null,
        applicant: rnd() < 0.6 ? c.advocate : c.accusedAdvocate,
        details: c.disposal
          ? "Certified copy of judgement"
          : pick([
              "Certified copy of complaint",
              "Certified copy of order sheet",
              "Certified copy of deposition",
            ]),
      });
    }
  }
  const copySequence = new Map<number, number>();
  copies.sort((a, b) => a.applied - b.applied);
  for (const copy of copies) {
    const year = yearOf(copy.applied);
    const value = (copySequence.get(year) ?? 0) + 1;
    copySequence.set(year, value);
    copy.number = `CA/${value}/${year}`;
  }

  gapLog.sort((a, b) => a.date - b.date);
  return { today: TODAY, start, cases, copies, gaps, gapLog };
}

/*
 * One court per day, kept at module level. A day's court is built once and every screen
 * reads the same object, so the registers' rows are literally the cases the dashboard
 * counted. Only the latest day is held: a page left open past midnight moves on rather
 * than accumulating courts.
 */
let cachedDay: string | null = null;
let cachedDocket: CourtDocket | null = null;

export function courtDocket(today: string): CourtDocket {
  if (cachedDay !== today || cachedDocket === null) {
    cachedDocket = generate(today);
    cachedDay = today;
  }
  return cachedDocket;
}

/* ----------------------------------------------------------------- measures */

export function isPending(c: DocketCase): boolean {
  return c.disposal === null && c.longPendingAt === null;
}

/** Days in the current stage, as of today. */
export function daysInStage(c: DocketCase, today: number): number {
  return c.stageStart === null ? 0 : daysBetween(c.stageStart, today);
}

export type LiveProcess = { case: DocketCase; process: CourtProcess };

export type ProcessAverage = {
  type: ProcessType;
  issued: number;
  /** Average days from issue to payment, over the process that has been paid. */
  toPayment: number;
  /** Average days from payment to delivery, over the process that has been delivered. */
  toDelivery: number;
};

export type HistogramBucket = { label: string; short: string; value: number };

export type CourtMeasures = {
  pending: DocketCase[];
  stPending: DocketCase[];
  cmpPending: DocketCase[];
  /** Filed, not yet registered — pending, but not on either register yet. */
  awaitingRegistration: DocketCase[];
  stDisposed: DocketCase[];
  cmpDisposed: DocketCase[];
  longPending: DocketCase[];
  stDisposedThisMonth: number;
  byStage: Record<StageKey, DocketCase[]>;
  /** Over the stage's limit, longest in stage first. */
  overdue: Record<StageKey, DocketCase[]>;
  /** Pending past registration with no next hearing date, longest since posting first. */
  undated: DocketCase[];
  /** Judgements (convictions and acquittals) in each of the last 12 complete months. */
  judgements: { month: number; value: number }[];
  paymentPending: LiveProcess[];
  deliveryPending: LiveProcess[];
  hearingSoon: LiveProcess[];
  processAverages: ProcessAverage[];
};

const measuresCache = new WeakMap<CourtDocket, CourtMeasures>();

export function courtMeasures(docket: CourtDocket): CourtMeasures {
  const cached = measuresCache.get(docket);
  if (cached) return cached;

  const { cases, today } = docket;
  const pending = cases.filter(isPending);
  const byStage = Object.fromEntries(
    STAGES.map((stage) => [stage.key, pending.filter((c) => c.stage === stage.key)]),
  ) as Record<StageKey, DocketCase[]>;
  const overdue = Object.fromEntries(
    STAGES.map((stage) => [
      stage.key,
      byStage[stage.key]
        .filter((c) => daysInStage(c, today) > COURT_LIMITS.stages[stage.key])
        .sort((a, b) => daysInStage(b, today) - daysInStage(a, today)),
    ]),
  ) as Record<StageKey, DocketCase[]>;

  const thisMonth = monthKey(today);
  const isJudgement = (c: DocketCase) =>
    c.disposal !== null && (c.disposal.method === "Convicted" || c.disposal.method === "Acquitted");
  const judgements: { month: number; value: number }[] = [];
  for (let back = 12; back >= 1; back--) {
    const month = thisMonth - back;
    judgements.push({
      month,
      value: cases.filter((c) => isJudgement(c) && monthKey(c.disposal!.date) === month).length,
    });
  }

  /* Process still running in the stage the case is in. */
  const live: LiveProcess[] = [];
  for (const c of pending) {
    for (const process of c.processes) {
      if (process.stage === c.stage) live.push({ case: c, process });
    }
  }
  const limits = COURT_LIMITS.process;

  const processAverages = (["Notice", "Summons", "Warrant"] as const).map((type) => {
    const all = cases.flatMap((c) => c.processes.filter((p) => p.type === type));
    const mean = (values: number[]) =>
      values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    return {
      type,
      issued: all.length,
      toPayment: mean(all.filter((p) => p.paid !== null).map((p) => daysBetween(p.issued, p.paid!))),
      toDelivery: mean(
        all.filter((p) => p.delivered !== null).map((p) => daysBetween(p.paid!, p.delivered!)),
      ),
    };
  });

  const measures: CourtMeasures = {
    pending,
    stPending: pending.filter((c) => c.stNumber !== null),
    cmpPending: pending.filter((c) => c.cmpNumber !== null && c.stNumber === null),
    awaitingRegistration: pending.filter((c) => c.stage === "registration"),
    stDisposed: cases.filter((c) => c.disposal?.at === "ST"),
    cmpDisposed: cases.filter((c) => c.disposal?.at === "CMP"),
    longPending: cases.filter((c) => c.longPendingAt !== null),
    stDisposedThisMonth: cases.filter(
      (c) => c.disposal?.at === "ST" && monthKey(c.disposal.date) === thisMonth,
    ).length,
    byStage,
    overdue,
    undated: pending
      .filter((c) => c.stage !== "registration" && c.nextHearing === null)
      .sort((a, b) => (a.previousPosting ?? 0) - (b.previousPosting ?? 0)),
    judgements,
    paymentPending: live
      .filter((x) => x.process.paid === null && daysBetween(x.process.issued, today) > limits.paymentPendingDays)
      .sort((a, b) => a.process.issued - b.process.issued),
    deliveryPending: live
      .filter(
        (x) =>
          x.process.paid !== null &&
          x.process.delivered === null &&
          daysBetween(x.process.paid, today) > limits.deliveryPendingDays,
      )
      .sort((a, b) => a.process.paid! - b.process.paid!),
    hearingSoon: live
      .filter(
        (x) =>
          (x.process.paid === null || x.process.delivered === null) &&
          x.case.nextHearing !== null &&
          daysBetween(today, x.case.nextHearing) <= limits.hearingWithinDays,
      )
      .sort((a, b) => a.case.nextHearing! - b.case.nextHearing!),
    processAverages,
  };
  measuresCache.set(docket, measures);
  return measures;
}

/* ---------------------------------------------------- time between hearings */

export type HearingStageFilter = "all" | Exclude<StageKey, "registration">;

const GAP_BUCKETS: [string, number, number][] = [
  ["≤ 7", 0, 7],
  ["8–14", 8, 14],
  ["15–30", 15, 30],
  ["31–60", 31, 60],
  ["61–90", 61, 90],
  ["90+", 91, Infinity],
];

const HEARING_BUCKETS: [string, number, number][] = [
  ["0", 0, 0],
  ["1", 1, 1],
  ["2–3", 2, 3],
  ["4–6", 4, 6],
  ["7–9", 7, 9],
  ["10+", 10, Infinity],
];

function gapsFor(docket: CourtDocket, stage: HearingStageFilter): number[] {
  return stage === "all"
    ? HEARING_STAGES.flatMap((s) => docket.gaps[s.key])
    : docket.gaps[stage];
}

/** Days between successive hearings, bucketed. */
export function gapHistogram(docket: CourtDocket, stage: HearingStageFilter): HistogramBucket[] {
  const gaps = gapsFor(docket, stage);
  return GAP_BUCKETS.map(([label, lo, hi]) => ({
    label: `${label} days`,
    short: label,
    value: gaps.filter((g) => g >= lo && g <= hi).length,
  }));
}

/** Pending cases by the hearings held in their current stage, bucketed. */
export function stageHearingHistogram(
  docket: CourtDocket,
  stage: HearingStageFilter,
): HistogramBucket[] {
  const measures = courtMeasures(docket);
  const pool =
    stage === "all"
      ? measures.pending.filter((c) => c.stage !== "registration")
      : measures.byStage[stage];
  return HEARING_BUCKETS.map(([label, lo, hi]) => ({
    label: `${label} ${label === "1" ? "hearing" : "hearings"}`,
    short: label,
    value: pool.filter((c) => c.stageHearings >= lo && c.stageHearings <= hi).length,
  }));
}

export function gapSummary(
  docket: CourtDocket,
  stage: HearingStageFilter,
): { median: number; average: number; count: number } {
  const gaps = gapsFor(docket, stage).slice().sort((a, b) => a - b);
  if (gaps.length === 0) return { median: 0, average: 0, count: 0 };
  return {
    median: gaps[gaps.length >> 1],
    average: gaps.reduce((sum, g) => sum + g, 0) / gaps.length,
    count: gaps.length,
  };
}

/* --------------------------------------------------------------- statements */

export type StatementPeriod = "monthly" | "quarterly" | "annual";

export type StatementRow = {
  label: string;
  from: number;
  to: number;
  opening: number;
  filed: number;
  uncontested: number;
  contested: number;
  longPending: number;
  totalDisposed: number;
  closing: number;
};

/** Cases on the file and still pending at the end of day `t`. */
function pendingAt(cases: DocketCase[], t: number): number {
  let count = 0;
  for (const c of cases) {
    if (
      c.filed <= t &&
      !(c.disposal && c.disposal.date <= t) &&
      !(c.longPendingAt !== null && c.longPendingAt <= t)
    ) {
      count++;
    }
  }
  return count;
}

function statement(cases: DocketCase[], from: number, to: number, label: string): StatementRow {
  const filed = cases.filter((c) => c.filed >= from && c.filed <= to).length;
  const disposed = cases.filter((c) => c.disposal && c.disposal.date >= from && c.disposal.date <= to);
  const uncontested = disposed.filter((c) => UNCONTESTED.has(c.disposal!.method)).length;
  const contested = disposed.length - uncontested;
  const longPending = cases.filter(
    (c) => c.longPendingAt !== null && c.longPendingAt >= from && c.longPendingAt <= to,
  ).length;
  return {
    label,
    from,
    to,
    opening: pendingAt(cases, from - DAY_MS),
    filed,
    uncontested,
    contested,
    longPending,
    totalDisposed: uncontested + contested + longPending,
    closing: pendingAt(cases, to),
  };
}

const statementCache = new WeakMap<CourtDocket, Record<StatementPeriod, StatementRow[]>>();

/**
 * Statements of filing, disposal and pendency, oldest period first. Monthly covers the
 * 24 generated months; quarterly runs by calendar quarter from the one the data starts
 * in; annual by financial year (April to March). The current period is to date.
 */
export function courtStatements(docket: CourtDocket): Record<StatementPeriod, StatementRow[]> {
  const cached = statementCache.get(docket);
  if (cached) return cached;
  const { cases, today, start } = docket;
  const toDate = (end: number) => (end > today ? " (to date)" : "");
  const firstMonth = monthKey(start);
  const lastMonth = monthKey(today);

  const monthly: StatementRow[] = [];
  for (let m = firstMonth; m <= lastMonth; m++) {
    const end = monthStart(m + 1) - DAY_MS;
    monthly.push(statement(cases, monthStart(m), Math.min(end, today), `${monthLabel(m)}${toDate(end)}`));
  }

  const quarterly: StatementRow[] = [];
  for (let q = firstMonth - (firstMonth % 3); q <= lastMonth; q += 3) {
    const end = monthStart(q + 3) - DAY_MS;
    const label = `Q${((q % 12) / 3) + 1} ${Math.floor(q / 12)}${toDate(end)}`;
    quarterly.push(statement(cases, monthStart(q), Math.min(end, today), label));
  }

  const annual: StatementRow[] = [];
  const fyOf = (key: number) => (key % 12 >= 3 ? Math.floor(key / 12) : Math.floor(key / 12) - 1);
  for (let y = fyOf(firstMonth); y <= fyOf(lastMonth); y++) {
    const begins = Date.UTC(y, 3, 1);
    const end = Date.UTC(y + 1, 3, 1) - DAY_MS;
    const label = `FY ${y}–${String(y + 1).slice(2)}${toDate(end)}`;
    annual.push(statement(cases, begins, Math.min(end, today), label));
  }

  const result = { monthly, quarterly, annual };
  statementCache.set(docket, result);
  return result;
}
