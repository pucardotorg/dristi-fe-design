/**
 * Prepared ahead: how an advocate handles pending tasks, and a nudge to finish each one at
 * least a working day before it is due. The calculation behind ② "Must do today" ›
 * Insights on the advocate Home.
 *
 * Source: `prepared-ahead-widget-spec.md` (owner, 2026-11-16). Section numbers in the
 * comments point at it. Everything here is a pure function of the task records, the court
 * calendar and "today", so the same inputs always draw the same chart (no AI, no stored
 * guesses). The backend's nightly verdict and snapshot jobs (§11) are an optimisation of
 * this same calculation; the prototype computes every day live.
 *
 * Rules that make it deterministic:
 * - All rules use the task's CURRENT due date (§7). A due-date change simply recomputes:
 *   old carried marks and verdicts disappear because they are never stored.
 * - Days are calendar days in court time (IST), never time of day (§2).
 * - Work done, and dates due, on a non-working day count on the previous working day (§4.3).
 * - Carried tasks repeat on every day they stay open, so bar totals are never added (§4.4).
 *   Every summary number comes from verdicts (§5).
 */

/** A calendar day in court time, `YYYY-MM-DD`. */
export type DayKey = string;

export type CourtCalendar = {
  /** Days of the week the court sits: 0 = Sunday … 6 = Saturday. */
  workingWeekdays: number[];
  /** Holidays and vacation days, as day keys. */
  holidays: DayKey[];
};

/** Mon to Sat sitting, Sundays off: the spec's test assumption (§12). */
export const MON_TO_SAT: CourtCalendar = { workingWeekdays: [1, 2, 3, 4, 5, 6], holidays: [] };

export type CompletionEvent = { at: string; type: "completed" | "reopened" };

export type PrepTask = {
  id: string;
  /** Verb + object, as Take action words it: "Pay the process fee". */
  title: string;
  /** The case, as rows name it. */
  caseTitle: string;
  /** Can only be done in court on the day (be present for the plea, produce PW-2). Off the chart and out of the score (§3). */
  inCourt?: boolean;
  createdAt: string;
  /** The current due date. Absent: the task cannot be judged (§3). */
  dueOn?: DayKey;
  /** When the current due date was set, if it was ever changed (§7.3). */
  dueChangedAt?: string;
  /** The task's own expiry date (§8). */
  expiresOn?: DayKey;
  /** Completed and reopened, oldest first. The last "completed" is the final completion (§9). */
  completions?: CompletionEvent[];
  /** The case was settled, withdrawn or disposed (§7.4). */
  caseClosedAt?: string;
};

export type Verdict = "ahead" | "not-ahead";

export type SegmentKey = "ahead" | "onDay" | "cleared" | "carried" | "expired" | "overdueTodo" | "todo";

export type DayColumn = {
  day: DayKey;
  isToday: boolean;
  /** Counts per segment. Past days never have `overdueTodo` or `todo`; today never has `carried`. */
  counts: Record<SegmentKey, number>;
  /** The tasks behind each segment, for the breakdown. */
  tasks: Record<SegmentKey, PrepTask[]>;
  total: number;
  /** All tasks due that day were ready before it (§6). */
  tick: boolean;
};

export type WeekScore = {
  /** Monday of the week. */
  from: DayKey;
  /** Sunday of the week. */
  to: DayKey;
  eligible: number;
  ahead: number;
  /** 0–100, rounded; null when nothing was due. */
  percent: number | null;
};

export type TodayCallout = {
  /** The next working day after today, and whether it is literally tomorrow. */
  nextDay: DayKey;
  nextIsTomorrow: boolean;
  dueNext: number;
  leftToday: number;
  overdue: number;
  noDueDate: number;
  /** Everything up to and including this day is done; null when something is still owed by tomorrow. */
  readyThrough: DayKey | null;
  /** Nothing open with a due date at all. */
  allClear: boolean;
};

export type PreparedAhead = {
  columns: DayColumn[];
  lastWeek: WeekScore;
  weekBefore: WeekScore;
  /** lastWeek − weekBefore, in points; null when either week had nothing due (§5.2). */
  change: number | null;
  /** Task-days carried over in the last completed week (§5.3). */
  carriedTaskDays: number;
  today: TodayCallout;
  /** For the footnote (§10.7): tasks in the window left out of the score. */
  notCounted: { inCourt: number; lateCreated: number; movedLate: number };
  /** No task due, done or carried anywhere in the window (§10.7). */
  empty: boolean;
};

/* ── Days ─────────────────────────────────────────────────────────────── */

const COURT_TZ = "Asia/Kolkata";
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: COURT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The court-time calendar day an instant falls on. */
export function dayOf(iso: string): DayKey {
  return dayFormat.format(new Date(iso));
}

/** Day arithmetic on keys, in UTC so no local offset can shift a day. */
export function addDays(day: DayKey, n: number): DayKey {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(day: DayKey): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

export function isWorkingDay(cal: CourtCalendar, day: DayKey): boolean {
  return cal.workingWeekdays.includes(weekdayOf(day)) && !cal.holidays.includes(day);
}

/** The day itself if the court sits, else the working day before it (§4.3). */
export function toWorkingDay(cal: CourtCalendar, day: DayKey): DayKey {
  let d = day;
  for (let i = 0; i < 60 && !isWorkingDay(cal, d); i++) d = addDays(d, -1);
  return d;
}

export function nextWorkingDay(cal: CourtCalendar, day: DayKey): DayKey {
  let d = addDays(day, 1);
  for (let i = 0; i < 60 && !isWorkingDay(cal, d); i++) d = addDays(d, 1);
  return d;
}

/** Monday of the week a day sits in (weeks run Monday to Sunday, §5.1). */
export function mondayOf(day: DayKey): DayKey {
  return addDays(day, -((weekdayOf(day) + 6) % 7));
}

/* ── One task ─────────────────────────────────────────────────────────── */

/** The due date as the chart reads it: on a working day. */
const dueDay = (cal: CourtCalendar, t: PrepTask) => (t.dueOn ? toWorkingDay(cal, t.dueOn) : null);

/** The working day of an event. */
const eventDay = (cal: CourtCalendar, iso: string) => toWorkingDay(cal, dayOf(iso));

/** The final completion, if the task ends completed (§9: the final time drives segments). */
export function finalCompletion(t: PrepTask): string | null {
  const last = t.completions?.at(-1);
  return last && last.type === "completed" ? last.at : null;
}

/** Completed as of the end of working day `day` (reopens undo it from their moment, §9). */
function doneByEndOf(cal: CourtCalendar, t: PrepTask, day: DayKey): boolean {
  let done = false;
  for (const e of t.completions ?? []) {
    if (eventDay(cal, e.at) <= day) done = e.type === "completed";
  }
  return done;
}

/** Completed before working day `day` began (midnight): the moment a verdict is taken (§2). */
function doneBefore(cal: CourtCalendar, t: PrepTask, day: DayKey): boolean {
  let done = false;
  for (const e of t.completions ?? []) {
    if (eventDay(cal, e.at) < day) done = e.type === "completed";
  }
  return done;
}

/** Unfinished tasks on a closed case vanish, past marks included (§7.4). */
function isRemoved(t: PrepTask): boolean {
  return Boolean(t.caseClosedAt) && !finalCompletion(t);
}

/** On the chart at all: has a due date and is not an in-court task (§3). */
function onChart(t: PrepTask): boolean {
  return Boolean(t.dueOn) && !t.inCourt && !isRemoved(t);
}

/**
 * Created on or after its due date, or its due date moved to a day already reached: it could
 * never have been done ahead. In the bars, out of the score (§3, §7.3).
 */
export function isLateCreated(cal: CourtCalendar, t: PrepTask): boolean {
  const due = dueDay(cal, t);
  if (!due) return false;
  if (eventDay(cal, t.createdAt) >= due) return true;
  return Boolean(t.dueChangedAt) && eventDay(cal, t.dueChangedAt!) >= due;
}

/** Counts towards the score (§3). */
export function isEligible(cal: CourtCalendar, t: PrepTask): boolean {
  return onChart(t) && !isLateCreated(cal, t);
}

/** The day the task expired, if it did: its expiry date, reached without being completed (§8). */
function expiredOn(cal: CourtCalendar, t: PrepTask): DayKey | null {
  if (!t.expiresOn || finalCompletion(t)) return null;
  return toWorkingDay(cal, t.expiresOn);
}

/**
 * The ahead verdict, taken when the due date begins (§2). Null before that, and for tasks the
 * score leaves out.
 */
export function verdictOf(cal: CourtCalendar, t: PrepTask, today: DayKey): Verdict | null {
  const due = dueDay(cal, t);
  if (!due || !isEligible(cal, t) || due > today) return null;
  return doneBefore(cal, t, due) ? "ahead" : "not-ahead";
}

/* ── The chart ────────────────────────────────────────────────────────── */

const SEGMENTS: SegmentKey[] = ["ahead", "onDay", "cleared", "carried", "expired", "overdueTodo", "todo"];

const emptyCounts = () => Object.fromEntries(SEGMENTS.map((k) => [k, 0])) as Record<SegmentKey, number>;
const emptyTasks = () => Object.fromEntries(SEGMENTS.map((k) => [k, []])) as unknown as Record<SegmentKey, PrepTask[]>;

/** One working day's column (§4.1 past, §4.2 today). */
export function columnFor(cal: CourtCalendar, tasks: PrepTask[], day: DayKey, today: DayKey): DayColumn {
  const isToday = day === today;
  const out = emptyTasks();
  const chart = tasks.filter(onChart);

  for (const t of chart) {
    const due = dueDay(cal, t)!;
    const done = finalCompletion(t);
    const doneDay = done ? eventDay(cal, done) : null;
    const expired = expiredOn(cal, t);
    const created = eventDay(cal, t.createdAt);

    if (doneDay === day) {
      out[due > day ? "ahead" : due === day ? "onDay" : "cleared"].push(t);
      continue;
    }
    if (expired === day) {
      out.expired.push(t);
      continue;
    }
    if (expired !== null && expired < day) continue;
    if (created > day) continue;

    if (isToday) {
      if (doneByEndOf(cal, t, day)) continue;
      if (due < day) out.overdueTodo.push(t);
      else if (due === day || due === nextWorkingDay(cal, day)) out.todo.push(t);
    } else if (due <= day && !doneByEndOf(cal, t, day)) {
      out.carried.push(t);
    }
  }

  const counts = emptyCounts();
  for (const k of SEGMENTS) counts[k] = out[k].length;
  const total = SEGMENTS.reduce((sum, k) => sum + counts[k], 0);

  /* §6: due that day, all ready before it, nothing carried or expired. Today has nothing
     carried yet; an overdue task still open stands in for it, since it will be. */
  const dueThatDay = chart.filter((t) => dueDay(cal, t) === day && isEligible(cal, t));
  const tick =
    dueThatDay.length > 0 &&
    dueThatDay.every((t) => doneBefore(cal, t, day)) &&
    counts.carried === 0 &&
    counts.expired === 0 &&
    (!isToday || counts.overdueTodo === 0);

  return { day, isToday, counts, tasks: out, total, tick };
}

/** The last `count` working days before today, oldest first, then today (§10.1). */
export function windowDays(cal: CourtCalendar, today: DayKey, count = 10): DayKey[] {
  const days: DayKey[] = [];
  let d = addDays(today, -1);
  for (let i = 0; days.length < count && i < 120; i++, d = addDays(d, -1)) {
    if (isWorkingDay(cal, d)) days.unshift(d);
  }
  /* A Sunday or holiday never gets a column (§2), today included: the window then ends on
     the last working day, which is already over. */
  return isWorkingDay(cal, today) ? [...days, today] : days;
}

/** A week's score from verdicts alone (§5.1). */
export function weekScore(cal: CourtCalendar, tasks: PrepTask[], monday: DayKey, today: DayKey): WeekScore {
  const sunday = addDays(monday, 6);
  const due = tasks.filter((t) => {
    const d = dueDay(cal, t);
    return d !== null && d >= monday && d <= sunday && isEligible(cal, t);
  });
  const verdicts = due.map((t) => verdictOf(cal, t, today)).filter((v): v is Verdict => v !== null);
  const ahead = verdicts.filter((v) => v === "ahead").length;
  return {
    from: monday,
    to: sunday,
    eligible: verdicts.length,
    ahead,
    percent: verdicts.length ? Math.round((ahead / verdicts.length) * 100) : null,
  };
}

/** Today's callout (§10.6). */
export function todayCallout(cal: CourtCalendar, tasks: PrepTask[], today: DayKey): TodayCallout {
  const next = nextWorkingDay(cal, today);
  const open = tasks.filter((t) => onChart(t) && !finalCompletion(t) && !(expiredOn(cal, t) !== null && expiredOn(cal, t)! <= today));
  const due = (t: PrepTask) => dueDay(cal, t)!;
  const overdue = open.filter((t) => due(t) < today).length;
  const leftToday = open.filter((t) => due(t) === today).length;
  const dueNext = open.filter((t) => due(t) === next).length;
  const noDueDate = tasks.filter((t) => !t.dueOn && !t.inCourt && !isRemoved(t) && !finalCompletion(t)).length;

  let readyThrough: DayKey | null = null;
  const allClear = open.length === 0;
  if (!allClear && overdue + leftToday + dueNext === 0) {
    /* Everything before the first open task's due date is done. */
    const first = open.map(due).sort()[0];
    let d = first;
    do d = addDays(d, -1);
    while (!isWorkingDay(cal, d));
    readyThrough = d;
  } else if (allClear) {
    /* Nothing open: ready through the last date already done for, if it lies ahead. */
    const ahead = tasks
      .filter((t) => onChart(t) && finalCompletion(t))
      .map(due)
      .filter((d) => d > today)
      .sort()
      .at(-1);
    readyThrough = ahead ?? null;
  }
  return {
    nextDay: next,
    nextIsTomorrow: next === addDays(today, 1),
    dueNext,
    leftToday,
    overdue,
    noDueDate,
    readyThrough,
    allClear,
  };
}

/** Everything the widget draws, for one advocate on one day. */
export function preparedAhead(cal: CourtCalendar, tasks: PrepTask[], today: DayKey, count = 10): PreparedAhead {
  const days = windowDays(cal, today, count);
  const columns = days.map((d) => columnFor(cal, tasks, d, today));

  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);
  const lastWeek = weekScore(cal, tasks, lastMonday, today);
  const weekBefore = weekScore(cal, tasks, addDays(lastMonday, -7), today);
  const change =
    lastWeek.percent === null || weekBefore.percent === null ? null : lastWeek.percent - weekBefore.percent;

  let carriedTaskDays = 0;
  for (let d = lastMonday; d < thisMonday; d = addDays(d, 1)) {
    if (isWorkingDay(cal, d)) carriedTaskDays += columnFor(cal, tasks, d, today).counts.carried;
  }

  const first = days[0];
  const inWindow = (t: PrepTask) => {
    const d = dueDay(cal, t);
    return d !== null && d >= first && d <= today && !isRemoved(t);
  };
  const late = tasks.filter((t) => onChart(t) && inWindow(t) && isLateCreated(cal, t));
  const createdLate = (t: PrepTask) => eventDay(cal, t.createdAt) >= dueDay(cal, t)!;
  const notCounted = {
    inCourt: tasks.filter((t) => t.inCourt && inWindow(t)).length,
    lateCreated: late.filter(createdLate).length,
    movedLate: late.filter((t) => !createdLate(t)).length,
  };

  return {
    columns,
    lastWeek,
    weekBefore,
    change,
    carriedTaskDays,
    today: todayCallout(cal, tasks, today),
    notCounted,
    empty: columns.every((c) => c.total === 0 && !c.tick),
  };
}

/* ── Drawing helpers (§10.3) ──────────────────────────────────────────── */

/** A clean axis maximum at or above the tallest bar: 2, 4, 6, 8, 10, 12, 16, 20… */
export function niceMax(n: number): number {
  if (n <= 0) return 4;
  /* Even steps only, so the half-way line is always a whole number. */
  const steps = [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100];
  return steps.find((s) => s >= n) ?? Math.ceil(n / 50) * 50;
}

/**
 * The outlier rule: if the tallest bar is more than 3 times the second tallest, it is drawn at
 * 3 times the second tallest with a break, and its real number is written on top.
 */
export function axisFor(totals: number[]): { max: number; cap: number | null } {
  const sorted = [...totals].sort((a, b) => b - a);
  const [first = 0, second = 0] = sorted;
  if (second > 0 && first > 3 * second) {
    const cap = 3 * second;
    return { max: niceMax(cap), cap };
  }
  return { max: niceMax(first), cap: null };
}
