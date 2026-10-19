/**
 * The magistrate dashboard read for a period: how cases moved through the stages, and
 * where they stood at its end, each set against the period before.
 *
 * It reads the one generated court (`court-docket.ts`) and rebuilds any past day from what
 * every case keeps — the stages it left, with their dates, its process dates and its
 * hearing gaps — so a past period's numbers are the court as it stood then, not today's
 * court relabelled.
 *
 * Two kinds of number, compared one way:
 *
 * - **Flows** (came in, went out, hearing gaps, process times) are totals over the period,
 *   compared with the totals over the period before.
 * - **Positions** (pending, past a review point, process waiting) are read on the period's
 *   last day, compared with the last day of the period before.
 *
 * "The period before" is the same stretch of the calendar one step back: a whole month
 * against the whole month before it, this month to date against the same days of last
 * month, any other range against the same number of days just before it.
 *
 * The dashboard reads a chosen day or range through `readingFor`, which says which
 * movement period and which comparison day go with it. Next dates (hearing gaps, undated
 * cases, hearings near with process unserved) exist for the latest day only
 * (`nextDates`).
 *
 * `todoLists`, `gapsIn` and `gapHistogramIn` are not read by the dashboard any more: the
 * to-do block was dropped and the gaps row reads next dates (owner, 2026-10-19).
 */

import {
  COURT_LIMITS,
  courtMeasures,
  DAY_MS,
  daysBetween,
  daysInStage,
  monthKey,
  monthStart,
  STAGES,
  type CourtDocket,
  type DocketCase,
  type ProcessType,
  type StageKey,
} from "@/lib/employee/court-docket";

export type Period = { from: number; to: number };

export type PeriodPreset = "this-month" | "last-month" | "last-3-months";

const monthEnd = (key: number) => monthStart(key + 1) - DAY_MS;

/** A preset as a period, kept within the generated court. */
export function presetPeriod(preset: PeriodPreset, docket: CourtDocket): Period {
  const month = monthKey(docket.today);
  switch (preset) {
    case "this-month":
      return { from: monthStart(month), to: docket.today };
    case "last-month":
      return { from: monthStart(month - 1), to: monthEnd(month - 1) };
    case "last-3-months":
      return { from: monthStart(month - 3), to: monthEnd(month - 1) };
  }
}

/** A chosen range, put in order and kept between the court's first day and today. */
export function clampPeriod(period: Period, docket: CourtDocket): Period {
  const clamp = (t: number) => Math.min(docket.today, Math.max(docket.start, t));
  const a = clamp(period.from);
  const b = clamp(period.to);
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/**
 * The period to compare with, or `null` when it would begin before the court's records
 * do — half a comparison reads as a real change.
 */
export function previousPeriod(period: Period, docket: CourtDocket): Period | null {
  const { from, to } = period;
  const first = monthKey(from);
  const last = monthKey(to);
  let previous: Period;
  if (from === monthStart(first) && to === monthEnd(last)) {
    const months = last - first + 1;
    previous = { from: monthStart(first - months), to: monthEnd(first - 1) };
  } else if (from === monthStart(first) && first === last) {
    const begins = monthStart(first - 1);
    previous = { from: begins, to: Math.min(begins + (to - from), monthEnd(first - 1)) };
  } else {
    const length = daysBetween(from, to) + 1;
    previous = { from: from - length * DAY_MS, to: from - DAY_MS };
  }
  return previous.from < docket.start ? null : previous;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(t: number) {
  const date = new Date(t);
  return { d: date.getUTCDate(), m: MONTHS[date.getUTCMonth()], y: date.getUTCFullYear() };
}

/** "19 Oct 2026". */
export function formatDay(t: number): string {
  const { d, m, y } = parts(t);
  return `${d} ${m} ${y}`;
}

/** "19 Oct" — a day where the year is plain from the period beside it. */
export function formatDayShort(t: number): string {
  const { d, m } = parts(t);
  return `${d} ${m}`;
}

/**
 * A period as people say it: "Sep 2026", "Jul–Sep 2026", "1–19 Oct 2026",
 * "12 Aug – 3 Sep 2026", "15 Dec 2025 – 10 Jan 2026".
 */
export function formatPeriod({ from, to }: Period): string {
  return periodText(from, to, true);
}

/** The same without the year, beside a heading that already gives it: "1–19 Sep". */
export function formatPeriodShort({ from, to }: Period): string {
  return parts(from).y === parts(to).y ? periodText(from, to, false) : formatPeriod({ from, to });
}

function periodText(from: number, to: number, withYear: boolean): string {
  const a = parts(from);
  const b = parts(to);
  const first = monthKey(from);
  const last = monthKey(to);
  const wholeMonths = from === monthStart(first) && to === monthEnd(last);
  const y = withYear ? ` ${b.y}` : "";
  if (from === to) return withYear ? formatDay(from) : formatDayShort(from);
  if (a.y !== b.y) {
    return wholeMonths ? `${a.m} ${a.y} – ${b.m} ${b.y}` : `${formatDay(from)} – ${formatDay(to)}`;
  }
  if (wholeMonths) return first === last ? `${b.m}${y}` : `${a.m}–${b.m}${y}`;
  if (first === last) return `${a.d}–${b.d} ${b.m}${y}`;
  return `${a.d} ${a.m} – ${b.d} ${b.m}${y}`;
}

/* ------------------------------------------------------------ a past day */

/** The stage a case was in at the end of day `t`, or `null` if it was not pending then. */
export function stageOn(c: DocketCase, t: number): { stage: StageKey; start: number } | null {
  if (c.filed > t) return null;
  if (c.disposal && c.disposal.date <= t) return null;
  if (c.longPendingAt !== null && c.longPendingAt <= t) return null;
  for (const entry of c.log) {
    if (entry.start <= t && t < entry.end) return { stage: entry.stage, start: entry.start };
  }
  if (c.stage !== null && c.stageStart !== null && c.stageStart <= t) {
    return { stage: c.stage, start: c.stageStart };
  }
  return null;
}

/** A case and the days that put it on a list: in stage, unpaid, undelivered, waiting. */
export type DatedCase = { case: DocketCase; days: number };

export type Position = {
  at: number;
  pending: number;
  /** On the CMP register: registered, not yet numbered ST. */
  cmp: number;
  st: number;
  /** Filed, not yet registered — pending, but on neither register. */
  awaitingRegistration: number;
  /** On the long pending register by this day, all time. */
  longPending: number;
  byStage: Record<StageKey, DocketCase[]>;
  /** In the stage longer than its review point, longest first. */
  overdue: Record<StageKey, DatedCase[]>;
  /** Process fee unpaid past the limit, by the stage the process belongs to. */
  paymentPending: Record<StageKey, DatedCase[]>;
  /** Paid, not delivered past the limit. */
  deliveryPending: Record<StageKey, DatedCase[]>;
};

const byStageOf = <T,>(): Record<StageKey, T[]> =>
  Object.fromEntries(STAGES.map((stage) => [stage.key, [] as T[]])) as Record<StageKey, T[]>;

/** One entry per case, keeping its largest days; longest first. */
function perCase(rows: DatedCase[]): DatedCase[] {
  const most = new Map<DocketCase, number>();
  for (const row of rows) most.set(row.case, Math.max(row.days, most.get(row.case) ?? -1));
  return [...most].map(([c, days]) => ({ case: c, days })).sort((a, b) => b.days - a.days);
}

const positionCache = new WeakMap<CourtDocket, Map<number, Position>>();

/** Where the court stood at the end of day `t`. */
export function positionOn(docket: CourtDocket, t: number): Position {
  let cache = positionCache.get(docket);
  if (!cache) positionCache.set(docket, (cache = new Map()));
  const cached = cache.get(t);
  if (cached) return cached;

  const limits = COURT_LIMITS;
  const byStage = byStageOf<DocketCase>();
  const overdue = byStageOf<DatedCase>();
  const unpaid = byStageOf<DatedCase>();
  const undelivered = byStageOf<DatedCase>();
  let cmp = 0;
  let st = 0;
  let longPending = 0;

  for (const c of docket.cases) {
    if (c.longPendingAt !== null && c.longPendingAt <= t) longPending++;
    const now = stageOn(c, t);
    if (!now) continue;
    byStage[now.stage].push(c);
    if (c.cognizanceAt !== null && c.cognizanceAt <= t) st++;
    else if (c.registeredAt !== null && c.registeredAt <= t) cmp++;
    const inStage = daysBetween(now.start, t);
    if (inStage > limits.stages[now.stage]) overdue[now.stage].push({ case: c, days: inStage });
    for (const p of c.processes) {
      if (p.stage !== now.stage || p.issued > t) continue;
      const paid = p.paid !== null && p.paid <= t;
      const delivered = p.delivered !== null && p.delivered <= t;
      if (!paid && daysBetween(p.issued, t) > limits.process.paymentPendingDays) {
        unpaid[p.stage].push({ case: c, days: daysBetween(p.issued, t) });
      }
      if (paid && !delivered && daysBetween(p.paid!, t) > limits.process.deliveryPendingDays) {
        undelivered[p.stage].push({ case: c, days: daysBetween(p.paid!, t) });
      }
    }
  }

  const pending = STAGES.reduce((sum, stage) => sum + byStage[stage.key].length, 0);
  const sorted = (lists: Record<StageKey, DatedCase[]>) =>
    Object.fromEntries(STAGES.map((stage) => [stage.key, perCase(lists[stage.key])])) as Record<
      StageKey,
      DatedCase[]
    >;
  const position: Position = {
    at: t,
    pending,
    cmp,
    st,
    awaitingRegistration: pending - cmp - st,
    longPending,
    byStage,
    overdue: sorted(overdue),
    paymentPending: sorted(unpaid),
    deliveryPending: sorted(undelivered),
  };
  cache.set(t, position);
  return position;
}

/** Cases past a review point, all stages together, at each month end up to `t`. */
export function overdueTrend(docket: CourtDocket, t: number, months = 6) {
  const last = monthKey(t);
  const trend: { month: number; at: number; partial: boolean; value: number }[] = [];
  for (let key = last - months + 1; key <= last; key++) {
    const at = Math.min(monthEnd(key), t);
    if (at < docket.start) continue;
    const position = positionOn(docket, at);
    trend.push({
      month: key,
      at,
      partial: at !== monthEnd(key),
      value: STAGES.reduce((sum, stage) => sum + position.overdue[stage.key].length, 0),
    });
  }
  return trend;
}

/* ------------------------------------------------------------- a period */

const inside = (t: number | null, { from, to }: Period) => t !== null && t >= from && t <= to;

export type Movement = {
  cameIn: DocketCase[];
  disposed: DocketCase[];
  toLongPending: DocketCase[];
};

export function movementIn(docket: CourtDocket, period: Period): Movement {
  return {
    cameIn: docket.cases.filter((c) => inside(c.filed, period)),
    disposed: docket.cases.filter((c) => c.disposal !== null && inside(c.disposal.date, period)),
    toLongPending: docket.cases.filter((c) => inside(c.longPendingAt, period)),
  };
}

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};

/**
 * A stage's usual gap between hearings, over everything the court has recorded. A gap
 * more than twice this is a long one; the reference does not move with the period, so a
 * period's long gaps can be compared with another's.
 */
export function usualGap(docket: CourtDocket, stage: StageKey): number | null {
  return median(docket.gaps[stage]);
}

export type StageGaps = {
  /** Hearings held in the period, in the stage. */
  hearings: number;
  /** The median gap before those hearings, in days; `null` with no hearings. */
  median: number | null;
  /** Gaps more than twice the stage's usual gap. */
  long: number;
  /** The days that count as long for the stage. */
  longOver: number | null;
};

export function gapsIn(docket: CourtDocket, period: Period): Record<StageKey, StageGaps> {
  return Object.fromEntries(
    STAGES.map((stage) => {
      const usual = usualGap(docket, stage.key);
      const days = docket.gapLog
        .filter((gap) => gap.stage === stage.key && inside(gap.date, period))
        .map((gap) => gap.days);
      const longOver = usual === null ? null : usual * 2;
      return [
        stage.key,
        {
          hearings: days.length,
          median: median(days),
          long: longOver === null ? 0 : days.filter((d) => d > longOver).length,
          longOver,
        },
      ];
    }),
  ) as Record<StageKey, StageGaps>;
}

const GAP_BUCKETS: [string, number, number][] = [
  ["≤ 7", 0, 7],
  ["8–14", 8, 14],
  ["15–30", 15, 30],
  ["31–60", 31, 60],
  ["61–90", 61, 90],
  ["90+", 91, Infinity],
];

/** The period's gaps between hearings, all stages, bucketed. */
export function gapHistogramIn(docket: CourtDocket, period: Period) {
  const days = docket.gapLog.filter((gap) => inside(gap.date, period)).map((gap) => gap.days);
  return GAP_BUCKETS.map(([short, lo, hi]) => ({
    short,
    label: `${short} days`,
    value: days.filter((d) => d >= lo && d <= hi).length,
  }));
}

export type ProcessTimes = {
  type: ProcessType;
  /** Average days from issue to payment, for fees paid in the period. */
  toPayment: number | null;
  paid: number;
  /** Average days from payment to delivery, for process delivered in the period. */
  toDelivery: number | null;
  delivered: number;
};

export function processTimesIn(docket: CourtDocket, period: Period): ProcessTimes[] {
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  return (["Notice", "Summons", "Warrant"] as const).map((type) => {
    const all = docket.cases.flatMap((c) => c.processes.filter((p) => p.type === type));
    const paid = all.filter((p) => inside(p.paid, period));
    const delivered = all.filter((p) => inside(p.delivered, period));
    return {
      type,
      toPayment: mean(paid.map((p) => daysBetween(p.issued, p.paid!))),
      paid: paid.length,
      toDelivery: mean(delivered.map((p) => daysBetween(p.paid!, p.delivered!))),
      delivered: delivered.length,
    };
  });
}

/* ------------------------------------------------------ the chosen date */

/**
 * How the dashboard reads the day or range the date picker chose (the approved mockup's
 * rule):
 *
 * - **One day D:** counts are read on D; movement is the month so far (the 1st to D),
 *   against the same days of the month before; counts are compared with 30 days earlier.
 * - **A range A–B:** counts are read on B; movement is A–B, against the period before it
 *   (`previousPeriod`); counts are compared with A.
 */
export type Reading = {
  selection: Period;
  single: boolean;
  /** The day counts are read on is the latest the records hold. */
  live: boolean;
  /** The day counts are read on. */
  end: number;
  /** What came in and went out is counted over this. */
  movement: Period;
  /** The movement compared with, or `null` before the records begin. */
  prior: Period | null;
  /** The day counts are compared with, or `null` when there is none. */
  compareAt: number | null;
};

export function readingFor(selection: Period, docket: CourtDocket): Reading {
  const { from, to } = clampPeriod(selection, docket);
  const single = from === to;
  const movement = single ? { from: Math.max(docket.start, monthStart(monthKey(to))), to } : { from, to };
  const before = single ? to - 30 * DAY_MS : from;
  return {
    selection: { from, to },
    single,
    live: to === docket.today,
    end: to,
    movement,
    prior: previousPeriod(movement, docket),
    compareAt: before >= docket.start && before < to ? before : null,
  };
}

export type PickerPreset = { label: string; period: Period };

/** The date picker's quick picks, each kept inside the records. */
export function pickerPresets(docket: CourtDocket): PickerPreset[] {
  const t = docket.today;
  const month = monthKey(t);
  const yearStart = Date.UTC(new Date(t).getUTCFullYear(), 0, 1);
  const presets: [string, number, number][] = [
    ["Latest day", t, t],
    ["Last 7 days", t - 6 * DAY_MS, t],
    ["Last 30 days", t - 29 * DAY_MS, t],
    ["This month", monthStart(month), t],
    ["Last month", monthStart(month - 1), monthEnd(month - 1)],
    ["Last 90 days", t - 89 * DAY_MS, t],
    ["This year", yearStart, t],
    ["All records", docket.start, t],
  ];
  return presets.map(([label, from, to]) => ({ label, period: clampPeriod({ from, to }, docket) }));
}

/**
 * A span in a sentence, with the year only when it is not the latest records' year:
 * "15 Oct", "1–15 Oct", "12 Sep – 3 Oct", "1 Dec 2025 – 3 Jan 2026".
 */
export function formatSpan(from: number, to: number, latest: number): string {
  const a = parts(from);
  const b = parts(to);
  const tail = b.y !== parts(latest).y ? ` ${b.y}` : "";
  if (from === to) return `${formatDayShort(from)}${tail}`;
  if (a.y !== b.y) return `${formatDay(from)} – ${formatDay(to)}`;
  if (a.m === b.m) return `${a.d}–${b.d} ${b.m}${tail}`;
  return `${formatDayShort(from)} – ${formatDayShort(to)}${tail}`;
}

/** The same, always with the year: "15 Oct 2026", "1–15 Oct 2026", "1 Sep – 15 Oct 2026". */
export function formatSpanFull(from: number, to: number): string {
  const a = parts(from);
  const b = parts(to);
  if (from === to) return formatDay(from);
  if (a.y !== b.y) return `${formatDay(from)} – ${formatDay(to)}`;
  if (a.m === b.m) return `${a.d}–${formatDay(to)}`;
  return `${formatDayShort(from)} – ${formatDay(to)}`;
}

/* ------------------------------------------------- next dates, latest day */

/**
 * What the latest postings say. Only the latest posting of each case is recorded — the
 * day it was last heard and the next date it was given — so these read for the latest
 * day only, never a past one.
 */
export type NextDates = {
  /** The median gap from the last posting to the next date, by stage; `null` with none. */
  usual: Record<StageKey, number | null>;
  /** Next date more than twice the usual gap away (and over two weeks); furthest first. */
  farBeyond: Record<StageKey, DatedCase[]>;
  /** Pending with no next date; days since the last posting, longest first. */
  undated: Record<StageKey, DatedCase[]>;
  /** Hearing within the limit with process not served; days to it, soonest first. */
  hearingSoon: Record<StageKey, DatedCase[]>;
  /** Every pending case with a next date, by its gap from the last posting. */
  gapBuckets: { label: string; value: number }[];
};

/** Gaps in the last two buckets (over 45 days) are the long ones. */
export const LONG_GAP_FROM_BUCKET = 4;

const NEXT_DATE_BUCKETS: [string, number, number][] = [
  ["Up to 7", 0, 7],
  ["8–14", 8, 14],
  ["15–30", 15, 30],
  ["31–45", 31, 45],
  ["46–60", 46, 60],
  ["Over 60", 61, Infinity],
];

const nextDatesCache = new WeakMap<CourtDocket, NextDates>();

export function nextDates(docket: CourtDocket): NextDates {
  const cached = nextDatesCache.get(docket);
  if (cached) return cached;
  const m = courtMeasures(docket);
  const today = docket.today;
  const posted = m.pending
    .filter((c) => c.stage !== null && c.nextHearing !== null && c.previousPosting !== null)
    .map((c) => ({ case: c, gap: daysBetween(c.previousPosting!, c.nextHearing!) }));

  const usual = byStageOf<number>();
  for (const x of posted) usual[x.case.stage!].push(x.gap);
  const medians = Object.fromEntries(
    STAGES.map((stage) => [stage.key, median(usual[stage.key])]),
  ) as Record<StageKey, number | null>;

  const farBeyond = byStageOf<DatedCase>();
  for (const x of posted) {
    const typical = medians[x.case.stage!];
    if (typical !== null && x.gap > typical * 2 && x.gap > 14) {
      farBeyond[x.case.stage!].push({ case: x.case, days: daysBetween(today, x.case.nextHearing!) });
    }
  }

  const undated = byStageOf<DatedCase>();
  for (const c of m.undated) {
    undated[c.stage!].push({
      case: c,
      days: c.previousPosting === null ? 0 : daysBetween(c.previousPosting, today),
    });
  }

  const soon = byStageOf<DatedCase>();
  for (const x of m.hearingSoon) {
    soon[x.case.stage!].push({ case: x.case, days: daysBetween(today, x.case.nextHearing!) });
  }

  const longestFirst = (lists: Record<StageKey, DatedCase[]>) =>
    Object.fromEntries(STAGES.map((stage) => [stage.key, perCase(lists[stage.key])])) as Record<
      StageKey,
      DatedCase[]
    >;
  const soonestFirst = Object.fromEntries(
    STAGES.map((stage) => [stage.key, perCase(soon[stage.key]).sort((a, b) => a.days - b.days)]),
  ) as Record<StageKey, DatedCase[]>;

  const result: NextDates = {
    usual: medians,
    farBeyond: longestFirst(farBeyond),
    undated: longestFirst(undated),
    hearingSoon: soonestFirst,
    gapBuckets: NEXT_DATE_BUCKETS.map(([label, lo, hi]) => ({
      label,
      value: posted.filter((x) => x.gap >= lo && x.gap <= hi).length,
    })),
  };
  nextDatesCache.set(docket, result);
  return result;
}

/* ----------------------------------------------------- process, a period */

/** Average days to pay and to deliver, over all process paid or delivered in the period. */
export function processAveragesIn(
  docket: CourtDocket,
  period: Period | null,
): { toPayment: number | null; toDelivery: number | null } {
  if (period === null) return { toPayment: null, toDelivery: null };
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  const all = docket.cases.flatMap((c) => c.processes);
  return {
    toPayment: mean(all.filter((p) => inside(p.paid, period)).map((p) => daysBetween(p.issued, p.paid!))),
    toDelivery: mean(
      all.filter((p) => inside(p.delivered, period)).map((p) => daysBetween(p.paid!, p.delivered!)),
    ),
  };
}

/** Pending cases on day `t` with process issued in their stage and not yet delivered. */
export function waitingOnProcess(docket: CourtDocket, t: number): number {
  let count = 0;
  for (const c of docket.cases) {
    const now = stageOn(c, t);
    if (!now) continue;
    if (
      c.processes.some(
        (p) => p.stage === now.stage && p.issued <= t && (p.delivered === null || p.delivered > t),
      )
    ) {
      count++;
    }
  }
  return count;
}

/* ------------------------------------------------------- what to do first */

export type TodoId = "process" | "undated" | "applications" | "judgement";

export type TodoList = {
  id: TodoId;
  title: string;
  /** Who acts on it. Only the magistrate gives a next date or decides. */
  who: "You" | "Office";
  daysHeader: string;
  rows: DatedCase[];
  /** Soonest first rather than longest first. */
  soonestFirst?: boolean;
};

/** Today's lists, longest waiting first — the same today whatever period is chosen. */
export function todoLists(docket: CourtDocket): TodoList[] {
  const m = courtMeasures(docket);
  const today = docket.today;
  const limits = COURT_LIMITS;

  const process = perCase(
    m.hearingSoon.map((x) => ({ case: x.case, days: daysBetween(today, x.case.nextHearing!) })),
  ).sort((a, b) => a.days - b.days);

  const applications = perCase(
    m.pending.flatMap((c) =>
      c.applications
        .filter((a) => a.status === "Pending")
        .map((a) => ({ case: c, days: daysBetween(a.submitted, today) })),
    ),
  );

  return [
    {
      id: "process",
      title: `Hearing within ${limits.process.hearingWithinDays} days, process not served`,
      who: "Office",
      daysHeader: "Days to hearing",
      rows: process,
      soonestFirst: true,
    },
    {
      id: "undated",
      title: "No next hearing date",
      who: "You",
      daysHeader: "Days since last posting",
      rows: m.undated.map((c) => ({
        case: c,
        days: c.previousPosting === null ? 0 : daysBetween(c.previousPosting, today),
      })),
    },
    {
      id: "applications",
      title: "Applications waiting for your decision",
      who: "You",
      daysHeader: "Days waiting",
      rows: applications,
    },
    {
      id: "judgement",
      title: `Reserved for judgement over ${limits.stages.judgement} days`,
      who: "You",
      daysHeader: "Days reserved",
      rows: m.overdue.judgement.map((c) => ({ case: c, days: daysInStage(c, today) })),
    },
  ];
}

/* ------------------------------------------------ the dashboard, one reading */

/**
 * Who can move a delay: the office (registration, listing, chasing process), the
 * magistrate (cognizance, hearings, judgement) or someone outside the court (parties,
 * post and police). From the owner's Case Flow design.
 */
export type CheckOwner = "office" | "magistrate" | "outside";

export const STAGE_OWNER: Record<StageKey, CheckOwner> = {
  registration: "office",
  cognizance: "magistrate",
  appearance: "outside",
  bail: "outside",
  trial: "magistrate",
  judgement: "magistrate",
};

/** A case on a list, with the stage it is counted in. */
export type CheckRow = DatedCase & { stage: StageKey };

/* ------------------------------------------------ the period under review */

/**
 * What the Overview's period is compared with (the design's "Compare with"): the period
 * just before, the same period a year earlier, the average of the six periods before, or
 * nothing.
 */
export type CompareMode = "prev" | "year" | "avg" | "none";

/**
 * - `day` — one day, compared week on week (the same weekday).
 * - `month` — the 1st of a month to a day before its end: month to date.
 * - `full` — a whole month.
 * - `span` — any other range.
 */
export type PeriodKind = "day" | "month" | "full" | "span";

export type PeriodReading = {
  selection: Period;
  kind: PeriodKind;
  /** Days in the period. */
  length: number;
  /** Counts are read on this day. */
  end: number;
  /** The latest day the records hold. */
  live: boolean;
  /** The opening selection: the 1st of this month to the latest day. */
  isDefault: boolean;
  compare: CompareMode;
  /** The windows the comparison is averaged over: none, one, or up to six. */
  baseline: Period[];
  /** The day a stage's waiting count is compared with, or `null` without one. */
  overdueSince: number | null;
};

/** The selection the dashboard opens on: this month so far. */
export function defaultSelection(docket: CourtDocket): Period {
  return { from: Math.max(docket.start, monthStart(monthKey(docket.today))), to: docket.today };
}

export function periodKind({ from, to }: Period): PeriodKind {
  if (from === to) return "day";
  const key = monthKey(from);
  if (new Date(from).getUTCDate() === 1 && key === monthKey(to)) return to === monthEnd(key) ? "full" : "month";
  return "span";
}

/** The same calendar date `months` back, kept inside the shorter month. */
function monthsBack(t: number, months: number): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() - months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), last));
}

/**
 * The period `steps` back: a day by weeks (the same weekday), a month by months, any
 * other range by its own length. `null` once it would begin before the records do.
 */
export function periodBack(selection: Period, steps: number, docket: CourtDocket): Period | null {
  const kind = periodKind(selection);
  const length = daysBetween(selection.from, selection.to) + 1;
  const back = (t: number) =>
    kind === "day"
      ? t - 7 * steps * DAY_MS
      : kind === "span"
        ? t - length * steps * DAY_MS
        : monthsBack(t, steps);
  const from = back(selection.from);
  if (from < docket.start) return null;
  const to = kind === "full" ? monthEnd(monthKey(from)) : back(selection.to);
  return { from, to };
}

/**
 * How the Overview reads a chosen day or range — the design's v3 rules, alongside
 * `readingFor` (which keeps the earlier rules for anything else that reads it):
 *
 * - **One day** is that day alone, compared with the same weekday a week earlier.
 * - **A range** is read across itself; counts are taken on its last day.
 * - **The same period last year** steps back 52 weeks, 12 months, or as many lengths as
 *   make a year; **the average of the last 6** averages up to six periods just before.
 * - A stage's waiting count is compared with the start of the range, or with 30 days
 *   earlier for a single day.
 */
export function periodReading(
  selection: Period,
  docket: CourtDocket,
  compare: CompareMode = "prev",
): PeriodReading {
  const period = clampPeriod(selection, docket);
  const kind = periodKind(period);
  const length = daysBetween(period.from, period.to) + 1;
  const yearSteps = kind === "day" ? 52 : kind === "span" ? Math.max(1, Math.round(365 / length)) : 12;
  const one = (steps: number) => {
    const p = periodBack(period, steps, docket);
    return p ? [p] : [];
  };
  const baseline =
    compare === "prev"
      ? one(1)
      : compare === "year"
        ? one(yearSteps)
        : compare === "avg"
          ? [1, 2, 3, 4, 5, 6].flatMap(one)
          : [];
  const since = kind === "day" ? period.to - 30 * DAY_MS : period.from;
  const fallback = defaultSelection(docket);
  return {
    selection: period,
    kind,
    length,
    end: period.to,
    live: period.to === docket.today,
    isDefault: period.from === fallback.from && period.to === fallback.to,
    compare,
    baseline,
    overdueSince: since >= docket.start && since < period.to ? since : null,
  };
}

/** The "period just before" option's name for a selection. */
export function previousName(selection: Period): string {
  const kind = periodKind(selection);
  if (kind === "day") return "Same day last week";
  if (kind === "full") return "Previous month";
  if (kind === "month") return "Same days last month";
  return `Previous ${daysBetween(selection.from, selection.to) + 1} days`;
}

/** The comparison as the date button shows it: "vs last month"; empty with none. */
export function compareShort(compare: CompareMode, selection: Period): string {
  const kind = periodKind(selection);
  if (compare === "none") return "";
  if (compare === "year") return "vs last year";
  if (compare === "avg") return "vs 6-period average";
  if (kind === "day") return "vs last week";
  if (kind === "span") return "vs previous period";
  return "vs last month";
}

const inPeriod = (t: number | null, { from, to }: Period) => t !== null && t >= from && t <= to;

/** Cases filed, and cases closed (disposed or moved to long pending), over a period. */
export function filedAndClosed(docket: CourtDocket, period: Period): { filed: number; closed: number } {
  let filed = 0;
  let closed = 0;
  for (const c of docket.cases) {
    if (inPeriod(c.filed, period)) filed++;
    if ((c.disposal && inPeriod(c.disposal.date, period)) || inPeriod(c.longPendingAt, period)) closed++;
  }
  return { filed, closed };
}

export type Outcomes = {
  Convicted: number;
  Acquitted: number;
  Settled: number;
  Withdrawn: number;
  Dismissed: number;
  Returned: number;
  /** Withdrawn, dismissed and returned together. */
  early: number;
  toLongPending: number;
};

/** How the cases closed in a period were closed. */
export function outcomesIn(docket: CourtDocket, period: Period): Outcomes {
  const out: Outcomes = {
    Convicted: 0,
    Acquitted: 0,
    Settled: 0,
    Withdrawn: 0,
    Dismissed: 0,
    Returned: 0,
    early: 0,
    toLongPending: 0,
  };
  for (const c of docket.cases) {
    if (c.disposal && inPeriod(c.disposal.date, period)) out[c.disposal.method]++;
    if (inPeriod(c.longPendingAt, period)) out.toLongPending++;
  }
  out.early = out.Withdrawn + out.Dismissed + out.Returned;
  return out;
}

/** The mean of each count over a set of periods; `null` with none. */
export function averageOver<T extends Record<string, number>>(
  periods: Period[],
  read: (period: Period) => T,
): T | null {
  if (!periods.length) return null;
  const all = periods.map(read);
  return Object.fromEntries(
    Object.keys(all[0]).map((key) => [key, all.reduce((sum, x) => sum + x[key], 0) / all.length]),
  ) as T;
}

/** A pending case filed more than this many days before the period counts as old. */
export const OLD_CASE_DAYS = 183;

/**
 * The cases pending on the period's last day by when they were filed: in the period,
 * up to six months before it, or longer before it.
 */
export function pendingAges(docket: CourtDocket, period: Period): [number, number, number] {
  const position = positionOn(docket, period.to);
  const ages: [number, number, number] = [0, 0, 0];
  for (const stage of STAGES) {
    for (const c of position.byStage[stage.key]) {
      if (c.filed >= period.from) ages[0]++;
      else if (daysBetween(c.filed, period.from) <= OLD_CASE_DAYS) ages[1]++;
      else ages[2]++;
    }
  }
  return ages;
}

/* ------------------------------------------------ needs attention, today */

export type AttentionId = "soon" | "undated" | "apps" | "long" | "silent" | "pay" | "del";

export type AttentionItem = {
  id: AttentionId;
  owner: CheckOwner;
  label: string;
  /** Act now: the next step cannot wait. */
  urgent: boolean;
  rows: CheckRow[];
  count: number;
  /** Cases just past, well past and far past the limit (or near, nearer, nearest). */
  severity: [number, number, number];
  severityLabels: [string, string, string];
  /** How the far-past part reads after its count: "in 3 days or less". */
  farLabel: string;
  hint: string | null;
  /** The count a week earlier, where it can be rebuilt. */
  lastWeek: number | null;
  daysHeader: string;
  soonestFirst: boolean;
};

export type AttentionGroup = {
  owner: CheckOwner;
  label: string;
  description: string;
  items: AttentionItem[];
  /** Distinct cases across the group's items. */
  cases: number;
};

/** The last thing that happened on a case: a posting, a stage change, process or an application. */
export function lastActivity(c: DocketCase): number {
  let last = Math.max(c.previousPosting ?? 0, c.stageStart ?? 0);
  for (const p of c.processes) last = Math.max(last, p.issued, p.paid ?? 0, p.delivered ?? 0);
  for (const a of c.applications) last = Math.max(last, a.submitted, a.decided ?? 0);
  return last;
}

export const SILENT_DAYS = 90;
export const APPLICATION_DAYS = 7;

const ratioShade = (days: number, limit: number): 0 | 1 | 2 => {
  const r = days / limit;
  return r <= 1.5 ? 0 : r <= 2 ? 1 : 2;
};

const attentionCache = new WeakMap<CourtDocket, AttentionGroup[]>();

/**
 * What needs acting on today, grouped by who can act — the design's `NA_GROUPS` and
 * `NA_DEF`. Always read on the latest day: next dates exist for that day only.
 */
export function attentionToday(docket: CourtDocket): AttentionGroup[] {
  const cached = attentionCache.get(docket);
  if (cached) return cached;
  const today = docket.today;
  const limits = COURT_LIMITS.process;
  const next = nextDates(docket);
  const now = positionOn(docket, today);
  const weekAgo = today - 7 * DAY_MS >= docket.start ? positionOn(docket, today - 7 * DAY_MS) : null;
  const pending = courtMeasures(docket).pending;
  const flat = (lists: Record<StageKey, DatedCase[]>) =>
    STAGES.flatMap((stage) => lists[stage.key].map((row) => ({ ...row, stage: stage.key })));
  const longestFirst = (rows: CheckRow[]) => rows.sort((a, b) => b.days - a.days);

  const applications = longestFirst(
    pending.flatMap((c) => {
      const waiting = c.applications
        .filter((a) => a.status === "Pending" && daysBetween(a.submitted, today) > APPLICATION_DAYS)
        .map((a) => daysBetween(a.submitted, today));
      return waiting.length && c.stage ? [{ case: c, days: Math.max(...waiting), stage: c.stage }] : [];
    }),
  );
  const silent = longestFirst(
    pending.flatMap((c) => {
      if (c.stage === null || c.stage === "registration" || c.nextHearing !== null) return [];
      const days = daysBetween(lastActivity(c), today);
      return days > SILENT_DAYS ? [{ case: c, days, stage: c.stage }] : [];
    }),
  );

  const item = (
    base: Omit<AttentionItem, "count" | "severity">,
    shade: (row: CheckRow) => 0 | 1 | 2,
  ): AttentionItem => {
    const severity: [number, number, number] = [0, 0, 0];
    for (const row of base.rows) severity[shade(row)]++;
    return { ...base, count: base.rows.length, severity };
  };
  const soon = item(
    {
      id: "soon",
      owner: "office",
      label: "Hearing within 2 weeks, process not served",
      urgent: true,
      rows: flat(next.hearingSoon).sort((a, b) => a.days - b.days),
      severityLabels: ["Hearing in 8–14 days", "Hearing in 4–7 days", "Hearing in 3 days or less"],
      farLabel: "in 3 days or less",
      hint: null,
      lastWeek: null,
      daysHeader: "Days to hearing",
      soonestFirst: true,
    },
    (row) => (row.days <= 3 ? 2 : row.days <= 7 ? 1 : 0),
  );
  const undated = item(
    {
      id: "undated",
      owner: "office",
      label: "No next hearing date",
      urgent: true,
      rows: longestFirst(flat(next.undated)),
      severityLabels: ["Last posted up to 30 days ago", "31–90 days ago", "Over 90 days ago"],
      farLabel: "last posted over 90 days ago",
      hint: null,
      lastWeek: null,
      daysHeader: "Days since last posting",
      soonestFirst: false,
    },
    (row) => (row.days <= 30 ? 0 : row.days <= 90 ? 1 : 2),
  );
  const apps = item(
    {
      id: "apps",
      owner: "magistrate",
      label: `Applications undecided over ${APPLICATION_DAYS} days`,
      urgent: false,
      rows: applications,
      severityLabels: ["8–14 days", "15–30 days", "Over 30 days"],
      farLabel: "waiting over 30 days",
      hint: null,
      lastWeek: null,
      daysHeader: "Days waiting",
      soonestFirst: false,
    },
    (row) => (row.days <= 14 ? 0 : row.days <= 30 ? 1 : 2),
  );
  const long = item(
    {
      id: "long",
      owner: "magistrate",
      label: "Next date far beyond the usual gap",
      urgent: false,
      rows: longestFirst(flat(next.farBeyond)),
      severityLabels: ["2–3× the usual gap", "3–4× the usual gap", "Over 4× the usual gap"],
      farLabel: "over 4× the usual gap",
      hint: null,
      lastWeek: null,
      daysHeader: "Days to next date",
      soonestFirst: false,
    },
    (row) => {
      const c = row.case;
      const gap = c.previousPosting !== null && c.nextHearing !== null ? daysBetween(c.previousPosting, c.nextHearing) : 0;
      const r = gap / Math.max(1, next.usual[row.stage] ?? 1);
      return r <= 3 ? 0 : r <= 4 ? 1 : 2;
    },
  );
  const quiet = item(
    {
      id: "silent",
      owner: "magistrate",
      label: `No activity for ${SILENT_DAYS} days`,
      urgent: false,
      rows: silent,
      severityLabels: ["90–180 days", "181–365 days", "Over a year"],
      farLabel: "silent over a year",
      hint: "Often settled out of court but never closed",
      lastWeek: null,
      daysHeader: "Days since last activity",
      soonestFirst: false,
    },
    (row) => (row.days <= 180 ? 0 : row.days <= 365 ? 1 : 2),
  );
  const pay = item(
    {
      id: "pay",
      owner: "outside",
      label: `Process fee unpaid over ${limits.paymentPendingDays} days`,
      urgent: false,
      rows: longestFirst(flat(now.paymentPending)),
      severityLabels: ["8–10 days", "11–14 days", "Over 14 days"],
      farLabel: "unpaid over 14 days",
      hint: null,
      lastWeek: weekAgo ? sumStages(weekAgo.paymentPending) : null,
      daysHeader: "Days unpaid",
      soonestFirst: false,
    },
    (row) => ratioShade(row.days, limits.paymentPendingDays),
  );
  const del = item(
    {
      id: "del",
      owner: "outside",
      label: `Paid process not delivered in ${limits.deliveryPendingDays} days`,
      urgent: false,
      rows: longestFirst(flat(now.deliveryPending)),
      severityLabels: ["15–21 days", "22–28 days", "Over 28 days"],
      farLabel: "undelivered over 28 days",
      hint: null,
      lastWeek: weekAgo ? sumStages(weekAgo.deliveryPending) : null,
      daysHeader: "Days undelivered",
      soonestFirst: false,
    },
    (row) => ratioShade(row.days, limits.deliveryPendingDays),
  );

  const group = (owner: CheckOwner, label: string, description: string, items: AttentionItem[]): AttentionGroup => ({
    owner,
    label,
    description,
    items,
    cases: new Set(items.flatMap((it) => it.rows.map((row) => row.case.id))).size,
  });
  const result = [
    group("office", "Office", "Registration, listing and chasing process", [soon, undated]),
    group("magistrate", "Magistrate", "Orders, postings and decisions", [apps, long, quiet]),
    group("outside", "Outside the court", "Parties, post and police", [pay, del]),
  ];
  attentionCache.set(docket, result);
  return result;
}

const sumStages = (lists: Record<StageKey, DatedCase[]>) =>
  STAGES.reduce((sum, stage) => sum + lists[stage.key].length, 0);

/* ------------------------------------------------------------------ trends */

export type TrendId = "pending" | "clearance" | "overdue" | "disposal" | "serve";

export type TrendPoint = { month: number; at: number; partial: boolean; value: number | null };

export type Trend = {
  id: TrendId;
  label: string;
  /** Which way is better. */
  better: "up" | "down";
  /** A reference line (100% clearance). */
  reference: number | null;
  unit: "count" | "percent" | "days" | "days-decimal";
  note: string | null;
  points: TrendPoint[];
  last: TrendPoint | null;
  /** The mean of the three months before the last. */
  base: number | null;
  /** `null` with fewer than four months to judge by. */
  verdict: "better" | "worse" | "steady" | null;
};

const trendsCache = new WeakMap<CourtDocket, Map<string, Trend[]>>();

/**
 * Five measures month by month over months `from`–`to` (month keys, kept inside the
 * records and up to day `t`, the last month read up to `t`). The verdict sets the last
 * month against the mean of the three before: a change of 5% or more is improving or
 * worsening by the measure's own direction; anything less is steady. With fewer than
 * four months there is no verdict — the design's `trends()`.
 */
export function monthlyTrends(
  docket: CourtDocket,
  t: number,
  range?: { from: number; to: number },
): Trend[] {
  let cache = trendsCache.get(docket);
  if (!cache) trendsCache.set(docket, (cache = new Map()));
  const toKey = range?.to ?? monthKey(t);
  const fromKey = range?.from ?? toKey - 11;
  const key = `${t}:${fromKey}:${toKey}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const months: number[] = [];
  for (let k = fromKey; k <= toKey; k++) {
    if (monthStart(k) >= docket.start && monthStart(k) <= t) months.push(k);
  }
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const summons = docket.cases.flatMap((c) => c.processes.filter((p) => p.type === "Summons"));

  const measures: {
    id: TrendId;
    label: string;
    better: "up" | "down";
    reference: number | null;
    unit: Trend["unit"];
    note: string | null;
    at: (period: Period) => number | null;
  }[] = [
    {
      id: "pending",
      label: "Pending",
      better: "down",
      reference: null,
      unit: "count",
      note: null,
      at: ({ to }) => positionOn(docket, to).pending,
    },
    {
      id: "clearance",
      label: "Clearance rate",
      better: "up",
      reference: 100,
      unit: "percent",
      note: "Disposals ÷ filings. Above 100% the backlog shrinks.",
      at: (period) => {
        const filed = docket.cases.filter((c) => inPeriod(c.filed, period)).length;
        const disposed = docket.cases.filter((c) => c.disposal && inPeriod(c.disposal.date, period)).length;
        return filed ? (disposed / filed) * 100 : null;
      },
    },
    {
      id: "overdue",
      label: "Past a review point",
      better: "down",
      reference: null,
      unit: "count",
      note: null,
      at: ({ to }) => sumStages(positionOn(docket, to).overdue),
    },
    {
      id: "disposal",
      label: "Median days to disposal",
      better: "down",
      reference: null,
      unit: "days",
      note: "From filing to disposal",
      at: (period) =>
        median(
          docket.cases
            .filter((c) => c.disposal && inPeriod(c.disposal.date, period))
            .map((c) => daysBetween(c.filed, c.disposal!.date)),
        ),
    },
    {
      id: "serve",
      label: "Days to serve summons",
      better: "down",
      reference: null,
      unit: "days-decimal",
      note: "From payment to delivery",
      at: (period) => {
        const days = summons
          .filter((p) => inPeriod(p.delivered, period))
          .map((p) => daysBetween(p.paid!, p.delivered!));
        return days.length ? mean(days) : null;
      },
    },
  ];

  const result = measures.map((m): Trend => {
    const points = months.map((k) => {
      const at = Math.min(monthEnd(k), t);
      return { month: k, at, partial: at !== monthEnd(k), value: m.at({ from: monthStart(k), to: at }) };
    });
    const real = points.filter((p) => p.value !== null);
    const last = real.at(-1) ?? null;
    const previous = real.slice(-4, -1).map((p) => p.value!);
    const base = previous.length ? mean(previous) : null;
    let verdict: Trend["verdict"] = real.length < 4 ? null : "steady";
    if (verdict && last && base) {
      const change = (last.value! - base) / Math.abs(base);
      if (Math.abs(change) >= 0.05) verdict = change > 0 === (m.better === "up") ? "better" : "worse";
    }
    return { id: m.id, label: m.label, better: m.better, reference: m.reference, unit: m.unit, note: m.note, points, last, base, verdict };
  });
  cache.set(key, result);
  return result;
}
