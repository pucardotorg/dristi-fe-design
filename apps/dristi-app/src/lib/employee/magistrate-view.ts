/**
 * What the magistrate's own view reads (note 1.2, Magistrate a–d, as round 11 lays them out):
 * judgments against the magistrate's target, the registers month by month, the cases
 * waiting on a next date from the magistrate, and the cases gone quiet.
 *
 * Every list here is read on today, from the same generated court the dashboard reads
 * (`court-docket.ts`), so a count on this view and the same count on the Court view agree.
 */
import {
  COURT_LIMITS,
  DAY_MS,
  courtMeasures,
  daysBetween,
  daysInStage,
  isPending,
  monthKey,
  monthStart,
  STAGES,
  type CourtDocket,
  type DocketCase,
} from "./court-docket";
import { nextDates } from "./court-flow";

const isJudgment = (c: DocketCase) =>
  c.disposal !== null && (c.disposal.method === "Convicted" || c.disposal.method === "Acquitted");

/* ------------------------------------------------------------- judgments */

export type JudgmentMonth = { month: number; value: number; partial: boolean };

/** Judgments in each of the last `months` complete months, then this month so far. */
export function judgmentMonths(docket: CourtDocket, months = 6): JudgmentMonth[] {
  const now = monthKey(docket.today);
  const out: JudgmentMonth[] = [];
  for (let back = months; back >= 0; back--) {
    const month = now - back;
    out.push({
      month,
      value: docket.cases.filter((c) => isJudgment(c) && monthKey(c.disposal!.date) === month).length,
      partial: back === 0,
    });
  }
  return out;
}

export type ReservedCase = { case: DocketCase; days: number; since: number };

/** Cases reserved for judgment, longest waiting first: the judgments still to be written. */
export function reservedForJudgment(docket: CourtDocket): ReservedCase[] {
  return courtMeasures(docket)
    .byStage.judgement.map((c) => ({ case: c, days: daysInStage(c, docket.today), since: c.stageStart ?? docket.today }))
    .sort((a, b) => b.days - a.days);
}

/** Days a case may wait for its judgment before it is late (the note's judgment-stage limit). */
export const JUDGMENT_DUE_DAYS = COURT_LIMITS.stages.judgement;

/* ------------------------------------------------------------- registers */

export type RegisterMonth = {
  month: number;
  /** This month, read to today. */
  partial: boolean;
  judgments: number;
  stDisposed: number;
  cmpDisposed: number;
  toLongPending: number;
  /** On each register at the month's end (today for this month). */
  stPending: number;
  cmpPending: number;
  longPending: number;
};

/**
 * The registers month by month, newest first: what moved in each month, then what stood on
 * each register at its end. Read the way staff check the physical registers (note 1.2,
 * bench clerk A, which round 11 gives the magistrate as item a).
 */
export function registerMonths(docket: CourtDocket, months = 6): RegisterMonth[] {
  const now = monthKey(docket.today);
  const rows: RegisterMonth[] = [];
  for (let back = 0; back <= months; back++) {
    const month = now - back;
    const from = monthStart(month);
    const end = back === 0 ? docket.today : monthStart(month + 1) - DAY_MS;
    const within = (t: number | null | undefined) => t !== null && t !== undefined && t >= from && t <= end;
    const open = (c: DocketCase) =>
      c.filed <= end && !(c.disposal && c.disposal.date <= end) && !(c.longPendingAt !== null && c.longPendingAt <= end);
    const taken = (c: DocketCase) => c.cognizanceAt !== null && c.cognizanceAt <= end;
    let judgments = 0, stDisposed = 0, cmpDisposed = 0, toLongPending = 0, stPending = 0, cmpPending = 0, longPending = 0;
    for (const c of docket.cases) {
      if (c.disposal && within(c.disposal.date)) {
        if (isJudgment(c)) judgments++;
        if (c.disposal.at === "ST") stDisposed++;
        else cmpDisposed++;
      }
      if (within(c.longPendingAt)) toLongPending++;
      if (c.longPendingAt !== null && c.longPendingAt <= end) longPending++;
      if (open(c)) {
        if (taken(c)) stPending++;
        else if (c.registeredAt !== null && c.registeredAt <= end) cmpPending++;
      }
    }
    rows.push({ month, partial: back === 0, judgments, stDisposed, cmpDisposed, toLongPending, stPending, cmpPending, longPending });
  }
  return rows;
}

/* ------------------------------------------------------------- next dates */

export type UndatedCase = { case: DocketCase; days: number };

/** Registered, pending, and listed for no date: days since the last hearing, longest first. */
export function undatedCases(docket: CourtDocket): UndatedCase[] {
  return courtMeasures(docket)
    .undated.map((c) => ({ case: c, days: c.previousPosting === null ? 0 : daysBetween(c.previousPosting, docket.today) }))
    .sort((a, b) => b.days - a.days);
}

export type FarOffCase = { case: DocketCase; gap: number; usual: number };

/**
 * Listed, but further from the last hearing than the stage allows: more than twice the
 * stage's usual gap, and over two weeks (`nextDates`, the dashboard's existing rule). A
 * sensible gap differs by stage (note 1.1, days between hearings), so one number of days
 * for every stage would flag the slow stages and miss the fast ones. Furthest beyond the
 * usual first.
 */
export function farOffCases(docket: CourtDocket): FarOffCase[] {
  const nd = nextDates(docket);
  return STAGES.flatMap((stage) =>
    nd.farBeyond[stage.key].map(({ case: c }) => ({
      case: c,
      gap: daysBetween(c.previousPosting!, c.nextHearing!),
      usual: nd.usual[stage.key] ?? 0,
    })),
  ).sort((a, b) => b.gap / Math.max(1, b.usual) - a.gap / Math.max(1, a.usual));
}

/* ------------------------------------------------------------- silent */

export type SilentCase = { case: DocketCase; days: number; last: number; what: string };

/** The latest thing that happened on a case, on or before `today`. */
function lastActivity(c: DocketCase, today: number): { at: number; what: string } {
  const events: [number, string][] = [[c.filed, "Filed"]];
  if (c.previousPosting !== null) events.push([c.previousPosting, "Hearing"]);
  for (const p of c.processes) {
    events.push([p.issued, `${p.type} ordered`]);
    if (p.paid !== null) events.push([p.paid, `${p.type} fee paid`]);
    if (p.delivered !== null) events.push([p.delivered, `${p.type} delivered`]);
  }
  for (const a of c.applications) {
    events.push([a.submitted, "Application filed"]);
    if (a.decided !== null) events.push([a.decided, "Application decided"]);
  }
  for (const d of c.depositions) events.push([d.date, "Deposition"]);
  const [at, what] = events.filter(([t]) => t <= today).sort((a, b) => b[0] - a[0])[0];
  return { at, what };
}

/**
 * Pending past registration, not on the long pending register, and nothing on the case —
 * no hearing, filing, process step or deposition — for more than `days` (note section 4,
 * monitoring query 7: often settled out of court and never closed). Longest silent first.
 */
export function silentCases(docket: CourtDocket, days = COURT_LIMITS.silentDays): SilentCase[] {
  const today = docket.today;
  return docket.cases
    .filter((c) => isPending(c) && c.stage !== "registration")
    .map((c) => {
      const { at, what } = lastActivity(c, today);
      return { case: c, days: daysBetween(at, today), last: at, what };
    })
    .filter((r) => r.days > days)
    .sort((a, b) => b.days - a.days);
}
