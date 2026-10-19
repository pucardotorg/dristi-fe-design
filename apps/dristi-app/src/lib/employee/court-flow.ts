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
 * "The period before" is one step back on the calendar: a whole month (or month to date)
 * against the whole month before it, any other range against the same number of days
 * just before it.
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
  type DisposalMethod,
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
    /* Month to date compares with the whole month before, not the same days of it. */
    previous = { from: monthStart(first - 1), to: monthEnd(first - 1) };
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
 *   against the whole month before; counts are compared with 30 days earlier.
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
 * The Trends date picker's quick picks. Trends are read month by month, so each pick
 * covers whole months, the current one read up to today.
 */
export function trendPresets(docket: CourtDocket): PickerPreset[] {
  const t = docket.today;
  const month = monthKey(t);
  const year = new Date(t).getUTCFullYear();
  const presets: [string, number, number][] = [
    ["Last 6 months", monthStart(month - 5), t],
    ["Last 12 months", monthStart(month - 11), t],
    ["This year", Date.UTC(year, 0, 1), t],
    ["Last year", Date.UTC(year - 1, 0, 1), Date.UTC(year, 0, 1) - DAY_MS],
    ["All records", docket.start, t],
  ];
  return presets.map(([label, from, to]) => ({ label, period: clampPeriod({ from, to }, docket) }));
}

/** What Trends opens on: the last 12 months, this one to date. */
export function trendOpening(docket: CourtDocket): Period {
  return trendPresets(docket)[1].period;
}

/** The months a Trends period covers, as month keys: whole months, first to last. */
export function trendMonths(period: Period): { from: number; to: number } {
  return { from: monthKey(period.from), to: monthKey(period.to) };
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
 * The period `steps` back: a day by weeks (the same weekday), a whole month (or month
 * to date) by whole months, any other range by its own length. `null` once it would
 * begin before the records do.
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
  /* Month to date and a whole month both step to whole months — "vs last month" is the
     full month before, not the same days of it. */
  const to = kind === "full" || kind === "month" ? monthEnd(monthKey(from)) : back(selection.to);
  return { from, to };
}

/**
 * How the Overview reads a chosen day or range — the design's v3 rules, alongside
 * `readingFor` (which keeps the earlier rules for anything else that reads it):
 *
 * - **One day** is that day alone, compared with the same weekday a week earlier.
 * - **A range** is read across itself; counts are taken on its last day.
 * - **Month to date** and a **whole month** compare with whole months one step back
 *   ("vs last month" is the full previous month, not the same days of it).
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
  if (kind === "full" || kind === "month") return "Previous month";
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

/* ------------------------------------------------- the cases behind a figure */

/** Cases filed in a period, with the days since filing at its end; newest last. */
export function filedCases(docket: CourtDocket, period: Period): DatedCase[] {
  return docket.cases
    .filter((c) => inPeriod(c.filed, period))
    .map((c) => ({ case: c, days: daysBetween(c.filed, period.to) }))
    .sort((a, b) => b.days - a.days);
}

export type OutcomeKey = "Convicted" | "Acquitted" | "Settled" | "early" | "toLongPending";

/** A closed case: its days in court (filing to closing), how and on which register it closed. */
export type ClosedRow = DatedCase & {
  outcome: OutcomeKey;
  method: DisposalMethod | "Long pending";
  closedOn: number;
  /** Disposed on the CMP register: before cognizance was taken. */
  beforeCognizance: boolean;
};

const closedCache = new WeakMap<CourtDocket, Map<string, ClosedRow[]>>();

/** Cases closed in a period, longest in court first. */
export function closedCases(docket: CourtDocket, period: Period): ClosedRow[] {
  let cache = closedCache.get(docket);
  if (!cache) closedCache.set(docket, (cache = new Map()));
  const key = `${period.from}:${period.to}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const rows: ClosedRow[] = [];
  for (const c of docket.cases) {
    if (c.disposal && inPeriod(c.disposal.date, period)) {
      const m = c.disposal.method;
      const outcome: OutcomeKey = m === "Convicted" || m === "Acquitted" || m === "Settled" ? m : "early";
      rows.push({
        case: c,
        days: daysBetween(c.filed, c.disposal.date),
        outcome,
        method: m,
        closedOn: c.disposal.date,
        beforeCognizance: c.disposal.at === "CMP",
      });
    } else if (c.longPendingAt !== null && inPeriod(c.longPendingAt, period)) {
      rows.push({
        case: c,
        days: daysBetween(c.filed, c.longPendingAt),
        outcome: "toLongPending",
        method: "Long pending",
        closedOn: c.longPendingAt,
        beforeCognizance: false,
      });
    }
  }
  rows.sort((a, b) => b.days - a.days);
  cache.set(key, rows);
  return rows;
}

export type PendingSets = {
  /** Every case pending on the period's last day, with its days in court. */
  all: DatedCase[];
  cmp: DatedCase[];
  st: DatedCase[];
  awaitingRegistration: DatedCase[];
  /** Filed in the period, up to six months before it, longer before it — as `pendingAges`. */
  ages: [DatedCase[], DatedCase[], DatedCase[]];
};

/** The cases behind the Overview's pending figure and its parts. */
export function pendingSets(docket: CourtDocket, period: Period): PendingSets {
  const t = period.to;
  const position = positionOn(docket, t);
  const sets: PendingSets = { all: [], cmp: [], st: [], awaitingRegistration: [], ages: [[], [], []] };
  for (const stage of STAGES) {
    for (const c of position.byStage[stage.key]) {
      const row = { case: c, days: daysBetween(c.filed, t) };
      sets.all.push(row);
      if (c.cognizanceAt !== null && c.cognizanceAt <= t) sets.st.push(row);
      else if (c.registeredAt !== null && c.registeredAt <= t) sets.cmp.push(row);
      else sets.awaitingRegistration.push(row);
      const age = c.filed >= period.from ? 0 : daysBetween(c.filed, period.from) <= OLD_CASE_DAYS ? 1 : 2;
      sets.ages[age].push(row);
    }
  }
  const longest = (rows: DatedCase[]) => rows.sort((a, b) => b.days - a.days);
  longest(sets.all);
  longest(sets.cmp);
  longest(sets.st);
  longest(sets.awaitingRegistration);
  sets.ages.forEach(longest);
  return sets;
}

/** What a comparison baseline is made of: each window and its filed and closed counts. */
export function baselineWindows(
  docket: CourtDocket,
  reading: PeriodReading,
): { period: Period; filed: number; closed: number }[] {
  return reading.baseline.map((period) => ({ period, ...filedAndClosed(docket, period) }));
}

export type TrendDetail = {
  rows: { point: TrendPoint; change: number | null }[];
  highest: TrendPoint | null;
  lowest: TrendPoint | null;
  /** Best and worst by the measure's own direction. */
  best: TrendPoint | null;
  worst: TrendPoint | null;
  first: TrendPoint | null;
  /** The month before the last one with a value. */
  previous: TrendPoint | null;
  /** The months the verdict's average is taken over. */
  baseMonths: TrendPoint[];
  /** Last month against the month before it. */
  lastChange: number | null;
};

/** A trend's month-by-month values and the figures its verdict rests on. */
export function trendDetail(trend: Trend): TrendDetail {
  const real = trend.points.filter((p) => p.value !== null);
  let previous: number | null = null;
  const rows = trend.points.map((point) => {
    const change = point.value !== null && previous !== null ? point.value - previous : null;
    if (point.value !== null) previous = point.value;
    return { point, change };
  });
  const byValue = real.slice().sort((a, b) => a.value! - b.value!);
  const highest = byValue.at(-1) ?? null;
  const lowest = byValue[0] ?? null;
  return {
    rows,
    highest,
    lowest,
    best: trend.better === "up" ? highest : lowest,
    worst: trend.better === "up" ? lowest : highest,
    first: real[0] ?? null,
    previous: real.length > 1 ? real[real.length - 2] : null,
    baseMonths: real.slice(-4, -1),
    lastChange: real.length > 1 ? real.at(-1)!.value! - real.at(-2)!.value! : null,
  };
}

/** What went into one month of a trend — the design's crosshair breakdown. */
export function trendBreakdown(docket: CourtDocket, id: TrendId, point: TrendPoint): { label: string; value: string }[] {
  const period = { from: monthStart(point.month), to: point.at };
  const count = (pred: (c: DocketCase) => boolean) => docket.cases.filter(pred).length;
  const fmt = (n: number) => n.toLocaleString("en-IN");
  if (id === "pending" || id === "clearance") {
    const filed = count((c) => inPeriod(c.filed, period));
    const disposed = count((c) => c.disposal !== null && inPeriod(c.disposal.date, period));
    if (id === "clearance") {
      return [
        { label: "Disposed", value: fmt(disposed) },
        { label: "Filed", value: fmt(filed) },
        { label: disposed >= filed ? "Backlog shrank by" : "Backlog grew by", value: fmt(Math.abs(disposed - filed)) },
      ];
    }
    return [
      { label: "Filed in the month", value: fmt(filed) },
      { label: "Disposed in the month", value: fmt(disposed) },
      { label: "Moved to long pending", value: fmt(count((c) => inPeriod(c.longPendingAt, period))) },
    ];
  }
  if (id === "overdue") {
    const overdue = positionOn(docket, point.at).overdue;
    return STAGES.map((s) => ({ label: s.label, n: overdue[s.key].length }))
      .filter((x) => x.n)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map((x) => ({ label: x.label, value: fmt(x.n) }));
  }
  if (id === "disposal") {
    const days = docket.cases
      .filter((c) => c.disposal !== null && inPeriod(c.disposal.date, period))
      .map((c) => daysBetween(c.filed, c.disposal!.date));
    if (!days.length) return [];
    return [
      { label: "Cases disposed", value: fmt(days.length) },
      { label: "Quickest", value: `${fmt(Math.min(...days))} days` },
      { label: "Slowest", value: `${fmt(Math.max(...days))} days` },
    ];
  }
  const days = docket.cases
    .flatMap((c) => c.processes)
    .filter((p) => p.type === "Summons" && inPeriod(p.delivered, period))
    .map((p) => daysBetween(p.paid!, p.delivered!));
  if (!days.length) return [];
  return [
    { label: "Summons delivered", value: fmt(days.length) },
    { label: "Within 14 days", value: `${Math.round((days.filter((d) => d <= 14).length / days.length) * 100)}%` },
    { label: "Slowest", value: `${fmt(Math.max(...days))} days` },
  ];
}

/* ------------------------------------------------- where the pending cases are */

/** A run of days in a stage, as one bar of the stage's histogram. */
export type StageBin = { from: number; to: number | null; rows: DatedCase[]; late: boolean };

export type StagePathStage = {
  stage: StageKey;
  limit: number;
  /** Pending in the stage at the period's end, with days in the stage, longest first. */
  rows: DatedCase[];
  /**
   * Days in the stage in bins that line up with the review point: as many bins before it
   * as after it, then one open bin. The review point falls between bins `reviewAfter - 1`
   * and `reviewAfter`.
   */
  bins: StageBin[];
  reviewAfter: number;
  median: number | null;
  /** Cases that entered the stage during the period. */
  cameIn: number;
  /** Cases that left it during the period, onward or closed. */
  left: number;
  /** Of those that left, the cases that went on to the next stage. */
  movedOn: number;
};

const pathCache = new WeakMap<CourtDocket, Map<string, Record<StageKey, StagePathStage>>>();

/** The design's stage path: each stage's cases, days-in-stage bins and movement in a period. */
export function stagePathFor(docket: CourtDocket, period: Period): Record<StageKey, StagePathStage> {
  let cache = pathCache.get(docket);
  if (!cache) pathCache.set(docket, (cache = new Map()));
  const key = `${period.from}:${period.to}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const t = period.to;
  const out = {} as Record<StageKey, StagePathStage>;
  const rowsBy = byStageOf<DatedCase>();
  for (const c of docket.cases) {
    const now = stageOn(c, t);
    if (now) rowsBy[now.stage].push({ case: c, days: daysBetween(now.start, t) });
  }
  for (const s of STAGES) {
    const limit = COURT_LIMITS.stages[s.key];
    const rows = rowsBy[s.key].sort((a, b) => b.days - a.days);
    const pre = [7, 6, 5, 4, 3, 2, 1].find((k) => limit % k === 0 && k <= limit) ?? 1;
    const w = limit / pre;
    const n = pre * 2 + 1;
    const bins: StageBin[] = Array.from({ length: n }, (_, b) => ({
      from: b === 0 ? 0 : b * w + 1,
      to: b === n - 1 ? null : (b + 1) * w,
      rows: [],
      late: (b === 0 ? 0 : b * w + 1) > limit,
    }));
    for (const r of rows) bins[Math.min(n - 1, r.days <= 0 ? 0 : Math.ceil(r.days / w) - 1)].rows.push(r);
    out[s.key] = {
      stage: s.key,
      limit,
      rows,
      bins,
      reviewAfter: pre,
      median: median(rows.map((r) => r.days)),
      cameIn: 0,
      left: 0,
      movedOn: 0,
    };
  }
  const order = STAGES.map((s) => s.key);
  for (const c of docket.cases) {
    const entries = c.log.map((e) => ({ stage: e.stage, start: e.start, end: e.end }));
    if (c.stage !== null && c.stageStart !== null) entries.push({ stage: c.stage, start: c.stageStart, end: Infinity });
    const closedAt = Math.min(c.disposal ? c.disposal.date : Infinity, c.longPendingAt ?? Infinity);
    entries.forEach((e, j) => {
      if (e.start > closedAt) return;
      if (inPeriod(e.start, period)) {
        out[e.stage].cameIn++;
        const prev = entries[j - 1];
        if (prev && order.indexOf(prev.stage) + 1 === order.indexOf(e.stage)) out[prev.stage].movedOn++;
      }
      const leftAt = Math.min(e.end, closedAt);
      if (leftAt >= e.start && inPeriod(leftAt, period)) out[e.stage].left++;
    });
  }
  cache.set(key, out);
  return out;
}

/* ---------------------------------------------- needs attention, on a day */

export type AttentionCheckId = "undated" | "long" | "soon" | "pay" | "del";

export type AttentionBin = { from: number; to: number; label: string; rows: CheckRow[] };

export type AttentionCheck = {
  id: AttentionCheckId;
  label: string;
  rule: string;
  /** Built on next dates, which are kept for the latest day only. */
  latestOnly: boolean;
  /** False on a past day for a latest-day-only check. */
  available: boolean;
  /** Longest wait first, or soonest hearing first. */
  rows: CheckRow[];
  /** How long the cases have waited, on the check's own measure, in bins. */
  bins: AttentionBin[];
  axis: { low: string; high: string; title: string };
  fact: string | null;
  /** The count on the range's first day, when a range is read and it can be rebuilt. */
  atStart: number | null;
};

export type AttentionReading = {
  /** The day the checks are counted on. */
  day: number;
  /** A range's first day, compared with; `null` for a single day. */
  start: number | null;
  live: boolean;
  groups: { key: "hearing" | "process"; label: string; source: string; checks: AttentionCheck[] }[];
  /** Distinct cases across the available checks. */
  distinct: number;
};

const ATTENTION_DEF: Record<
  AttentionCheckId,
  {
    label: string;
    rule: string;
    latestOnly: boolean;
    title: string;
    low: number;
    unit: (v: number) => string;
    tip: (v: number) => string;
  }
> = {
  undated: {
    label: "No next hearing date",
    rule: "Registered, but not listed for any future date",
    latestOnly: true,
    title: "Days since last hearing",
    low: 0,
    unit: (v) => `${v.toLocaleString("en-IN")} days`,
    tip: (v) => `last heard ${v.toLocaleString("en-IN")} days ago`,
  },
  long: {
    label: "Next hearing too far away",
    rule: "More than twice the usual gap for its stage",
    latestOnly: true,
    title: "Gap compared with the usual",
    low: 2,
    unit: (v) => `${Number(v.toFixed(1))}×`,
    tip: (v) => `gap ${Number(v.toFixed(1))}× the usual`,
  },
  soon: {
    label: "Hearing soon, process not served",
    rule: "Hearing in the next 14 days; summons, notice or warrant not served",
    latestOnly: true,
    title: "Days until the hearing",
    low: 0,
    unit: (v) => (v === 0 ? "Today" : `${v} days`),
    tip: (v) => (v <= 0 ? "hearing today" : v === 1 ? "hearing tomorrow" : `hearing in ${v} days`),
  },
  pay: {
    label: "Process fee not paid",
    rule: `More than ${COURT_LIMITS.process.paymentPendingDays} days since the process was ordered`,
    latestOnly: false,
    title: "Days unpaid",
    low: COURT_LIMITS.process.paymentPendingDays + 1,
    unit: (v) => `${v.toLocaleString("en-IN")} days`,
    tip: (v) => `unpaid for ${v.toLocaleString("en-IN")} days`,
  },
  del: {
    label: "Process paid, not delivered",
    rule: `More than ${COURT_LIMITS.process.deliveryPendingDays} days since the fee was paid`,
    latestOnly: false,
    title: "Days since payment",
    low: COURT_LIMITS.process.deliveryPendingDays + 1,
    unit: (v) => `${v.toLocaleString("en-IN")} days`,
    tip: (v) => `paid ${v.toLocaleString("en-IN")} days ago`,
  },
};

/** Cases grouped by how long they have waited on the check's own measure — the design's `binStrip`. */
export function attentionBins(id: AttentionCheckId, rows: CheckRow[], usual: (r: CheckRow) => number): AttentionBin[] {
  const def = ATTENTION_DEF[id];
  const values = rows.map((r) => ({ r, v: id === "long" ? usual(r) : id === "soon" ? Math.max(0, r.days) : r.days }));
  if (!values.length) return [];
  const lo = def.low;
  const maxV = Math.max(...values.map((x) => x.v));
  let w: number;
  let n: number;
  if (id === "soon") {
    w = 1;
    n = 15;
  } else if (id === "long") {
    w = 0.5;
    n = Math.max(4, Math.min(12, Math.ceil((maxV - lo) / w)));
  } else {
    n = Math.min(12, Math.max(4, Math.ceil(maxV - lo)));
    w = Math.max(1, Math.ceil((maxV - lo + 1) / n));
    n = Math.max(1, Math.ceil((maxV - lo + 1) / w));
  }
  const bins: AttentionBin[] = Array.from({ length: n }, (_, b) => {
    const from = lo + b * w;
    const to = lo + (b + 1) * w - (id === "long" ? 0 : 1);
    const label =
      id === "soon"
        ? def.tip(from)
        : id === "long"
          ? `gap ${from}–${to}× the usual`
          : w === 1
            ? def.tip(from)
            : def.tip(from).replace(/[\d,]+ days/, `${from.toLocaleString("en-IN")}–${to.toLocaleString("en-IN")} days`);
    return { from, to, label, rows: [] };
  });
  for (const { r, v } of values) bins[Math.min(n - 1, Math.max(0, Math.floor((v - lo) / w)))].rows.push(r);
  return bins;
}

const attentionReadCache = new WeakMap<CourtDocket, Map<string, AttentionReading>>();

/**
 * Needs attention for a day or a range — the design's v4 `attention()`. A state is
 * counted on a day: the range's last day, compared with its first. The hearing-date and
 * hearing-soon checks need next dates, kept for the latest day only, so on a past day they
 * are unavailable rather than zero.
 */
export function attentionFor(docket: CourtDocket, selection: Period): AttentionReading {
  const { from, to } = clampPeriod(selection, docket);
  let cache = attentionReadCache.get(docket);
  if (!cache) attentionReadCache.set(docket, (cache = new Map()));
  const key = `${from}:${to}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const live = to === docket.today;
  const range = from !== to;
  const startUsable = range && from >= docket.start;
  const next = nextDates(docket);
  const at = positionOn(docket, to);
  const before = startUsable ? positionOn(docket, from) : null;
  const flat = (lists: Record<StageKey, DatedCase[]>) =>
    STAGES.flatMap((s) => lists[s.key].map((row) => ({ ...row, stage: s.key })));
  const gapRatio = (r: CheckRow) => {
    const c = r.case;
    const gap = c.previousPosting !== null && c.nextHearing !== null ? daysBetween(c.previousPosting, c.nextHearing) : 0;
    return gap / Math.max(1, next.usual[r.stage] ?? 1);
  };
  const days = (n: number) => `${n.toLocaleString("en-IN")} ${n === 1 ? "day" : "days"}`;

  const make = (id: AttentionCheckId, source: () => CheckRow[], atStart: () => number | null): AttentionCheck => {
    const def = ATTENTION_DEF[id];
    const available = !def.latestOnly || live;
    const rows = available ? source() : [];
    const bins = attentionBins(id, rows, gapRatio);
    let fact: string | null = null;
    if (rows.length) {
      if (id === "undated") fact = `Oldest: last heard ${days(rows[0].days)} ago`;
      if (id === "long") {
        const longest = Math.max(
          ...rows.map((r) =>
            r.case.previousPosting !== null && r.case.nextHearing !== null
              ? daysBetween(r.case.previousPosting, r.case.nextHearing)
              : 0,
          ),
        );
        fact = `Longest gap: ${days(longest)}`;
      }
      if (id === "soon") {
        const d = rows[0].days;
        fact = `Soonest: ${d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${days(d)}`}`;
      }
      if (id === "pay") fact = `Oldest: unpaid for ${days(rows[0].days)}`;
      if (id === "del") fact = `Oldest: paid ${days(rows[0].days)} ago`;
    }
    const last = bins.at(-1);
    return {
      id,
      label: def.label,
      rule: def.rule,
      latestOnly: def.latestOnly,
      available,
      rows,
      bins,
      axis: {
        low: def.unit(def.low),
        high: id === "soon" ? "14 days" : last ? def.unit(last.to) : "",
        title: def.title,
      },
      fact,
      atStart: available && !def.latestOnly ? atStart() : null,
    };
  };
  const longestFirst = (rows: CheckRow[]) => rows.sort((a, b) => b.days - a.days);
  const groups: AttentionReading["groups"] = [
    {
      key: "hearing",
      label: "Hearing dates",
      source: "Note B",
      checks: [
        make("undated", () => longestFirst(flat(next.undated)), () => null),
        make("long", () => longestFirst(flat(next.farBeyond)), () => null),
      ],
    },
    {
      key: "process",
      label: "Process",
      source: "Note D",
      checks: [
        make("soon", () => flat(next.hearingSoon).sort((a, b) => a.days - b.days), () => null),
        make("pay", () => longestFirst(flat(at.paymentPending)), () => (before ? sumStages(before.paymentPending) : null)),
        make("del", () => longestFirst(flat(at.deliveryPending)), () => (before ? sumStages(before.deliveryPending) : null)),
      ],
    },
  ];
  const ids = new Set<number>();
  for (const g of groups) for (const ch of g.checks) for (const r of ch.rows) ids.add(r.case.id);
  const result: AttentionReading = { day: to, start: range ? from : null, live, groups, distinct: ids.size };
  cache.set(key, result);
  return result;
}

/* ------------------------------------------------- how cases were closed */

export type ClosureSummary = {
  total: number;
  judgements: number;
  convicted: number;
  toLongPending: number;
  /** Median days from filing to disposal, disposed cases only. */
  medianDays: number | null;
};

export function closureSummary(docket: CourtDocket, period: Period): ClosureSummary {
  const rows = closedCases(docket, period);
  const judged = rows.filter((r) => r.outcome === "Convicted" || r.outcome === "Acquitted");
  return {
    total: rows.length,
    judgements: judged.length,
    convicted: rows.filter((r) => r.outcome === "Convicted").length,
    toLongPending: rows.filter((r) => r.outcome === "toLongPending").length,
    medianDays: median(rows.filter((r) => r.outcome !== "toLongPending").map((r) => r.days)),
  };
}

/** The same over a baseline: counts averaged across its windows, the median over all their cases. */
export function closureBaseline(docket: CourtDocket, periods: Period[]): ClosureSummary | null {
  if (!periods.length) return null;
  const each = periods.map((p) => closureSummary(docket, p));
  const avg = (k: "total" | "judgements" | "convicted" | "toLongPending") =>
    each.reduce((sum, x) => sum + x[k], 0) / each.length;
  const pooled = periods.flatMap((p) => closedCases(docket, p)).filter((r) => r.outcome !== "toLongPending");
  return {
    total: avg("total"),
    judgements: avg("judgements"),
    convicted: avg("convicted"),
    toLongPending: avg("toLongPending"),
    medianDays: median(pooled.map((r) => r.days)),
  };
}

export type OutcomeDetail = {
  medianDays: number | null;
  beforeCognizance: number;
  /** Days from filing: under 6 months, 6–12 months, 1–2 years, over 2 years. */
  ages: { label: string; rows: ClosedRow[] }[];
};

export function outcomeDetail(rows: ClosedRow[]): OutcomeDetail {
  const bands: [string, number, number][] = [
    ["Under 6 months", 0, 180],
    ["6–12 months", 181, 365],
    ["1–2 years", 366, 730],
    ["Over 2 years", 731, Infinity],
  ];
  return {
    medianDays: median(rows.map((r) => r.days)),
    beforeCognizance: rows.filter((r) => r.beforeCognizance).length,
    ages: bands.map(([label, lo, hi]) => ({ label, rows: rows.filter((r) => r.days >= lo && r.days <= hi) })),
  };
}

export type TimelineColumn = {
  from: number;
  to: number;
  weekend: boolean;
  total: number;
  by: Record<OutcomeKey, number>;
};

/**
 * When closures happened: by day for up to 31 days, by week up to 183, by month beyond.
 * `null` for a single day or a period of one column.
 */
export function closureTimeline(
  docket: CourtDocket,
  period: Period,
): { unit: "day" | "week" | "month"; columns: TimelineColumn[]; busiest: TimelineColumn } | null {
  if (period.from === period.to) return null;
  const length = daysBetween(period.from, period.to) + 1;
  const unit = length <= 31 ? "day" : length <= 183 ? "week" : "month";
  const spans: [number, number][] = [];
  if (unit === "day") for (let t = period.from; t <= period.to; t += DAY_MS) spans.push([t, t]);
  else if (unit === "week")
    for (let t = period.from; t <= period.to; t += 7 * DAY_MS) spans.push([t, Math.min(period.to, t + 6 * DAY_MS)]);
  else
    for (let k = monthKey(period.from); k <= monthKey(period.to); k++)
      spans.push([Math.max(period.from, monthStart(k)), Math.min(period.to, monthEnd(k))]);
  if (spans.length < 2) return null;
  const rows = closedCases(docket, period);
  const columns = spans.map(([a, b]) => {
    const inside = rows.filter((r) => r.closedOn >= a && r.closedOn <= b);
    const by = { Convicted: 0, Acquitted: 0, Settled: 0, early: 0, toLongPending: 0 } as Record<OutcomeKey, number>;
    for (const r of inside) by[r.outcome]++;
    const day = new Date(a).getUTCDay();
    return { from: a, to: b, weekend: unit === "day" && (day === 0 || day === 6), total: inside.length, by };
  });
  const busiest = columns.reduce((best, c) => (c.total > best.total ? c : best));
  return { unit, columns, busiest };
}
