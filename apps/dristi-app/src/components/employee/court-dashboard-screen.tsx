"use client";

import * as React from "react";

import { useCourtText } from "@/components/court/court-provider";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import { PANEL_CLASS } from "@/components/shell/panel";
import {
  BOX,
  CaseListBox,
  CountButton,
  NeedsAttention,
  PANEL,
  PanelHeader,
  plural,
  useCaseList,
} from "@/components/employee/court-dashboard-attention";
import { CountUp, TrickleDots, useGrowIn } from "@/components/employee/court-dashboard-motion";
import { Trends } from "@/components/employee/court-dashboard-trends";
import { DashboardDatePicker } from "@/components/employee/dashboard-date-picker";
import { useCourtDocket } from "@/components/employee/docket-table";
import { useCourtSession } from "@/components/employee/use-court-role";
import { useCourtToday } from "@/components/employee/use-court-today";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  COURT_LIMITS,
  DAY_MS,
  monthKey,
  monthStart,
  msToDay,
  STAGES,
  UNCONTESTED,
  type CourtDocket,
  type DisposalMethod,
  type DocketCase,
  type StageKey,
} from "@/lib/employee/court-docket";
import {
  averageOver,
  closedCases,
  longPendingCases,
  defaultSelection,
  filedAndClosed,
  filedCases,
  formatDay,
  formatDayShort,
  formatSpan,
  formatSpanFull,
  nextDates,
  outcomesIn,
  PENDING_AGE_GROUPS,
  pendingAgeGroup,
  pendingSets,
  periodReading,
  positionOn,
  stagePathFor,
  type CompareMode,
  type Period,
  type PeriodReading,
  type PickerPreset,
} from "@/lib/employee/court-flow";
import { formatCourtDay } from "@/lib/employee/hearings";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * `/employee` — the magistrate dashboard, built to the owner's Case Flow design, version
 * 4 (2026-10-19), with its interaction and motion. Panels on the work canvas:
 *
 * 1. **Overview** — the period under review (this month so far by default, set by the
 *    date picker in the panel), what was filed and closed against a chosen baseline, what
 *    is pending and how long it has been in court, and the stage path: each stage's cases,
 *    how long they have waited, what came in and left, and what moved on. A stage opens
 *    in detail below the path. Every count opens its cases in the panel.
 * 2. **Needs attention** — the hearing-date and process checks, on its own date.
 * 3. **Trends** — five measures month by month, one at a time in detail.
 *
 * "How cases were closed" left the page on 2026-11-14: the Overview's "How cases ended"
 * and "Time to disposal" carry its outcomes and median (owner).
 *
 * Every mark tells its exact value in a DS tooltip on hover and keyboard focus, and keeps
 * it in its accessible name; a mark that counts cases opens them on a click or a tap.
 * Motion is one-shot and off under reduced motion (`court-dashboard-motion.tsx`).
 *
 * DEMO DATA. There is no court backend yet; the court is generated and anchored to today.
 */

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const countText = (n: number) => formatCount(Math.round(n));
const parts = (t: number) => {
  const d = new Date(t);
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear(), weekday: d.getUTCDay() };
};
const monthLong = (key: number) => `${MONTHS_LONG[key % 12]} ${Math.floor(key / 12)}`;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** "Mon 12 Oct", with the year when it is not the latest records' year. */
function weekdayDay(t: number, latest: number, withYear = false): string {
  const p = parts(t);
  const year = withYear || p.year !== parts(latest).year ? ` ${p.year}` : "";
  return `${WEEKDAYS[p.weekday]} ${formatDayShort(t)}${year}`;
}

/** The period as the panels name it: a day, a month, month to date, or a range. */
function periodName(reading: PeriodReading): string {
  const { from, to } = reading.selection;
  if (reading.kind === "day") return formatCourtDay(msToDay(to));
  if (reading.kind === "full") return monthLong(monthKey(to));
  if (reading.kind === "month") {
    const p = parts(to);
    return `${parts(from).day}–${p.day} ${MONTHS_LONG[p.month]} ${p.year}`;
  }
  return formatSpanFull(from, to);
}

/** What the baseline is called in a sentence: "September 2026", "the 6-month average". */
function baselineName(reading: PeriodReading, latest: number, closures = false): string | null {
  const windows = reading.baseline;
  if (!windows.length) return null;
  if (reading.compare === "avg") {
    const n = windows.length;
    if (closures) return `Average of last ${n}`;
    if (reading.kind === "day") return `the average of the last ${n} ${WEEKDAYS_LONG[parts(reading.end).weekday]}`;
    if (reading.kind === "span") return `the average of the last ${n} periods`;
    return `the ${n}-month average`;
  }
  const w = windows[0];
  const year = reading.compare === "year";
  if (reading.kind === "day") return weekdayDay(w.from, latest, year);
  if (reading.kind === "full") return monthLong(monthKey(w.from));
  return year || closures ? formatSpanFull(w.from, w.to) : formatSpan(w.from, w.to, latest);
}

type ListSpec = {
  title: string;
  summary: string;
  details?: string[];
  rows: { case: DocketCase; days: number }[];
  daysHeader: string;
};

/* ------------------------------------------------------------------ page */

export function CourtDashboardScreen() {
  const docket = useCourtDocket();
  const today = useCourtToday();
  const courtText = useCourtText();
  const { court } = useCourtSession();
  /* `null` is the opening selection: this month so far, whatever day that turns out to be. */
  const [picked, setPicked] = React.useState<Period | null>(null);
  const [compare, setCompare] = React.useState<CompareMode>("prev");
  const opening = defaultSelection(docket);
  const reading = periodReading(picked ?? opening, docket, compare);

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
        <header className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title text-balance font-semibold">Dashboard</h1>
          <p className="text-body-compact text-muted-foreground">
            {courtText(court)} · {formatCourtDay(today)}
          </p>
        </header>

        <Overview
          docket={docket}
          reading={reading}
          picker={
            <DashboardDatePicker
              docket={docket}
              value={reading.selection}
              compare={compare}
              defaultValue={opening}
              onChange={(next, mode) => {
                setPicked(next.from === opening.from && next.to === opening.to ? null : next);
                setCompare(mode);
              }}
            />
          }
        />
        <StagesPanel docket={docket} />
        <NeedsAttention docket={docket} />
        <Trends docket={docket} />
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------- overview */

const STAGE_DESCRIPTION: Record<StageKey, string> = {
  registration: "Filed, waiting to be registered",
  cognizance: "Registered, waiting for the magistrate to take cognizance",
  appearance: "Summons out, waiting for the accused to appear",
  bail: "Accused appeared, bail not yet complete",
  trial: "Plea, evidence and arguments",
  judgement: "Reserved for judgement",
};

type OverviewList =
  | "filed"
  | "closed"
  | "pending"
  | "awaiting"
  | "disposed"
  | "toLongPending"
  | "longPending"
  | `stage-${StageKey}`
  | `cell-${StageKey}-${0 | 1 | 2 | 3}`
  | `age-${0 | 1 | 2 | 3}`
  | "contested"
  | "uncontested"
  | `method-${DisposalMethod}`
  | "st"
  | "cmp"
  | "stDisposed"
  | "cmpDisposed"
  | `cohort-${number}`
  | "cohortAll";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * How cases ended: a card per method, contested first. The bar that summed them went on
 * 2026-11-14: the cards and the group headings already carry every count and share
 * (owner).
 */
const METHODS: { key: DisposalMethod }[] = [
  { key: "Convicted" },
  { key: "Acquitted" },
  { key: "Settled" },
  { key: "Withdrawn" },
  { key: "Dismissed" },
  { key: "Returned" },
];

/**
 * The Overview's containers: one per section, each holding its own heading and controls
 * (the date picker in the first, the Cards / Table switch in the pending one) so a control
 * reads as part of its section. The panel surface: card fill, hairline edge, raised
 * shadow. They sit closer to each other than to the panels below, so they read as one
 * Overview (owner, 2026-11-14: headings had first moved onto the page, which read as too
 * fragmented).
 */
const SECTION = cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6", PANEL_CLASS);

/** One row of "By when cases were filed": name, lane, pending; the lane drops under on phones. */
const COHORT_ROW = "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)_4rem]";

/** The median of a list of days; `null` for none. */
const medianOf = (days: number[]) => {
  if (!days.length) return null;
  const sorted = [...days].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/** The cases a stage card opens: all in the stage, those past its limit, or one day bin. */
type StageList = `stage-${StageKey}` | `late-${StageKey}` | `bin-${StageKey}-${number}`;

function Overview({
  docket,
  reading,
  picker,
}: {
  docket: CourtDocket;
  reading: PeriodReading;
  picker: React.ReactNode;
}) {
  const latest = docket.today;
  const { from, to } = reading.selection;
  const now = filedAndClosed(docket, reading.selection);
  const base = averageOver(reading.baseline, (p) => filedAndClosed(docket, p));
  const name = baselineName(reading, latest);
  const end = positionOn(docket, to);
  const out = outcomesIn(docket, reading.selection);
  const disposed = now.closed - out.toLongPending;
  const opening = from - DAY_MS < docket.start ? null : positionOn(docket, from - DAY_MS).pending;
  /* Pending is a position: compared with where it stood as the period began. */
  const since = reading.kind === "day" ? formatDayShort(from - DAY_MS) : formatDayShort(from);
  const sets = pendingSets(docket, reading.selection);
  const ages = sets.ages.map((a) => a.length);
  const period = periodName(reading);
  const list = useCaseList<OverviewList>();
  const listId = "dash-overview-cases";
  const pendingName = reading.live ? "Pending today" : `Pending on ${formatDayShort(to)}`;
  const pastNote = reading.live
    ? undefined
    : [`Days are counted to ${formatDay(to)}. Stage and next hearing are as they stand on ${formatDay(latest)}.`];

  /* How cases ended and how long they took: note 1.2, all users b, c and e (round 13,
     direction 1; owner, 2026-11-14). Disposed cases only; moves to the long pending
     register are closures, not disposals. Contested means a judgment, as UNCONTESTED
     defines it for the statement of pendency. */
  const disposedRows = closedCases(docket, reading.selection).filter((r) => r.outcome !== "toLongPending");
  const baseDisposed = reading.baseline.flatMap((p) => closedCases(docket, p).filter((r) => r.outcome !== "toLongPending"));
  const isContested = (method: string) => !UNCONTESTED.has(method as DisposalMethod);
  const contestedRows = disposedRows.filter((r) => isContested(r.method));
  const uncontestedRows = disposedRows.filter((r) => !isContested(r.method));
  const baseContested = baseDisposed.filter((r) => isContested(r.method));
  const shareOf = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
  const methodCount = (key: DisposalMethod) => disposedRows.filter((r) => r.method === key).length;
  const medians = {
    all: medianOf(disposedRows.map((r) => r.days)),
    contested: medianOf(contestedRows.map((r) => r.days)),
    uncontested: medianOf(uncontestedRows.map((r) => r.days)),
  };
  const baseMedians = {
    all: medianOf(baseDisposed.map((r) => r.days)),
    contested: medianOf(baseContested.map((r) => r.days)),
    uncontested: medianOf(baseDisposed.filter((r) => !isContested(r.method)).map((r) => r.days)),
  };

  /* The registers, to check against the physical ones (note 1.2, all users a(i)): pending on
     each register on the period's last day, disposed from each in the period, and
     judgments (convicted or acquitted) month by month for the 12 months to the period's. */
  const spanShort = from === to ? formatDayShort(to) : formatSpan(from, to, latest);
  const stDisposed = disposedRows.filter((r) => !r.beforeCognizance);
  const cmpDisposed = disposedRows.filter((r) => r.beforeCognizance);
  const lastMonth = monthKey(to);
  const judgmentMonths = Array.from({ length: 12 }, (_, i) => {
    const key = lastMonth - 11 + i;
    const period = { from: monthStart(key), to: Math.min(monthStart(key + 1) - DAY_MS, latest) };
    const n = period.from > latest ? 0 : closedCases(docket, period).filter((r) => r.method === "Convicted" || r.method === "Acquitted").length;
    return { key, n, partial: key === monthKey(latest) && latest < monthStart(key + 1) - DAY_MS };
  });
  const judgmentMax = Math.max(1, ...judgmentMonths.map((m) => m.n));
  const baseToLongPending = reading.baseline.length
    ? Math.round(reading.baseline.reduce((sum, p) => sum + closedCases(docket, p).filter((r) => r.outcome === "toLongPending").length, 0) / reading.baseline.length)
    : null;

  /* Time to disposal by when cases were filed (note 1.2, all users e: "track it by filing
     cohort"; round 15, direction P, owner 2026-11-14). Its own range, apart from the
     Overview's period, which is usually this month and would hold one or two filing months.
     Read as things stand today. Up to 12 months of filings show a row per month, a longer
     range a row per quarter. Each row is as long as its cases are old, filled by the share
     disposed, with its median as a tick and the court's typical time dashed. */
  const cohortPresets: PickerPreset[] = (
    [
      ["Last 3 months", monthStart(monthKey(latest) - 2)],
      ["Last 6 months", monthStart(monthKey(latest) - 5)],
      ["Last 12 months", monthStart(monthKey(latest) - 11)],
      ["This year", Date.UTC(new Date(latest).getUTCFullYear(), 0, 1)],
      ["All records", docket.start],
    ] as [string, number][]
  ).map(([label, start]) => ({ label, period: { from: Math.max(start, docket.start), to: latest } }));
  const cohortOpening = cohortPresets[cohortPresets.length - 1].period;
  const [cohortPick, setCohortPick] = React.useState<Period | null>(null);
  const cohortRange = cohortPick ?? cohortOpening;
  const nowSets = pendingSets(docket, { from: latest, to: latest });
  const typicalDays =
    medianOf(docket.cases.flatMap((c) => (c.disposal && c.disposal.date <= latest ? [Math.round((c.disposal.date - c.filed) / DAY_MS)] : []))) ?? 0;
  const byMonth = monthKey(cohortRange.to) - monthKey(cohortRange.from) + 1 <= 12;
  const groupOf = (ms: number) => {
    const key = monthKey(ms);
    return byMonth ? key : key - (key % 3);
  };
  const inRange = (ms: number) => ms >= cohortRange.from && ms <= cohortRange.to;
  const dayOf = (ms: number) => new Date(ms).getUTCDate();
  const cohorts = (() => {
    const map = new Map<number, { filed: number; days: number[]; lpr: number }>();
    for (const c of docket.cases) {
      if (!inRange(c.filed)) continue;
      const g = groupOf(c.filed);
      const entry = map.get(g) ?? { filed: 0, days: [], lpr: 0 };
      entry.filed += 1;
      if (c.disposal && c.disposal.date <= latest) entry.days.push(Math.round((c.disposal.date - c.filed) / DAY_MS));
      else if (c.longPendingAt !== null && c.longPendingAt <= latest) entry.lpr += 1;
      map.set(g, entry);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([g, e]) => {
        const fromKey = Math.max(g, monthKey(cohortRange.from));
        const toKey = byMonth ? g : Math.min(g + 2, monthKey(cohortRange.to));
        const first = Math.max(monthStart(fromKey), cohortRange.from);
        const last = Math.min(monthStart(toKey + 1) - DAY_MS, cohortRange.to);
        const wholeStart = first === monthStart(fromKey);
        const wholeEnd = last === monthStart(toKey + 1) - DAY_MS;
        const year = Math.floor(toKey / 12);
        const label =
          fromKey === toKey
            ? wholeStart && wholeEnd
              ? `${MONTHS_SHORT[toKey % 12]} ${year}`
              : `${dayOf(first)}–${dayOf(last)} ${MONTHS_SHORT[toKey % 12]} ${year}`
            : `${wholeStart ? MONTHS_SHORT[fromKey % 12] : formatDayShort(first)}–${wholeEnd ? MONTHS_SHORT[toKey % 12] : formatDayShort(last)} ${year}`;
        const pending = nowSets.all.filter((r) => inRange(r.case.filed) && groupOf(r.case.filed) === g);
        return { g, label, filed: e.filed, disposed: e.days.length, median: medianOf(e.days), pending, lpr: e.lpr, age: Math.round((latest - first) / DAY_MS) };
      });
  })();
  const cohortTotal = cohorts.reduce(
    (sum, c) => ({ filed: sum.filed + c.filed, disposed: sum.disposed + c.disposed, lpr: sum.lpr + c.lpr }),
    { filed: 0, disposed: 0, lpr: 0 },
  );
  const cohortPending = nowSets.all.filter((r) => inRange(r.case.filed));
  const cohortSpan = Math.ceil(Math.max(typicalDays + 30, ...cohorts.map((c) => c.age)) / 90) * 90;
  const cohortStep = cohortSpan <= 270 ? 30 : cohortSpan <= 540 ? 90 : 180;
  const cohortTicks = Array.from({ length: Math.floor(cohortSpan / cohortStep) + 1 }, (_, i) => i * cohortStep);
  const atDays = (days: number) => `${(Math.min(days, cohortSpan) / cohortSpan) * 100}%`;
  const cohortRangeName = formatSpanFull(cohortRange.from, cohortRange.to);

  const resolve = (key: OverviewList): ListSpec | null => {
    const inCourt = "Days in court";
    if (key === "st" || key === "cmp") {
      const rows = key === "st" ? sets.st : sets.cmp;
      return { title: `${pendingName} · ${key === "st" ? "ST register" : "CMP register"}`, summary: `${plural(rows.length, "case", "cases")} · longest in court first`, rows, daysHeader: inCourt, details: pastNote };
    }
    if (key === "stDisposed" || key === "cmpDisposed") {
      const rows = key === "stDisposed" ? stDisposed : cmpDisposed;
      return { title: `Disposed from the ${key === "stDisposed" ? "ST" : "CMP"} register · ${period}`, summary: plural(rows.length, "case", "cases"), rows, daysHeader: "Days from filing to disposal" };
    }
    if (key === "cohortAll") {
      return { title: `Filed ${cohortRangeName}, still pending`, summary: `${plural(cohortPending.length, "case", "cases")} of ${formatCount(cohortTotal.filed)} filed · longest in court first`, rows: cohortPending, daysHeader: inCourt };
    }
    if (key.startsWith("cohort-")) {
      const cohort = cohorts.find((c) => `cohort-${c.g}` === key);
      if (!cohort) return null;
      return { title: `Filed ${cohort.label}, still pending`, summary: `${plural(cohort.pending.length, "case", "cases")} of ${formatCount(cohort.filed)} filed · longest in court first`, rows: cohort.pending, daysHeader: inCourt };
    }
    if (key === "contested" || key === "uncontested" || key.startsWith("method-")) {
      const rows =
        key === "contested" ? contestedRows : key === "uncontested" ? uncontestedRows : disposedRows.filter((r) => `method-${r.method}` === key);
      const what = key === "contested" ? "Contested" : key === "uncontested" ? "Uncontested" : key.slice(7);
      return { title: `Disposed · ${what} · ${period}`, summary: plural(rows.length, "case", "cases"), rows, daysHeader: "Days from filing to disposal" };
    }
    if (key === "filed") {
      const rows = filedCases(docket, reading.selection);
      return { title: `Cases filed · ${period}`, summary: plural(rows.length, "case", "cases"), rows, daysHeader: "Days since filing", details: pastNote };
    }
    if (key === "closed") {
      const rows = closedCases(docket, reading.selection);
      return {
        title: `Cases closed · ${period}`,
        summary: `${plural(rows.length, "case", "cases")} · ${formatCount(disposed)} disposed, ${formatCount(out.toLongPending)} to long pending`,
        rows,
        daysHeader: "Days from filing to closing",
      };
    }
    if (key === "pending" || key === "awaiting") {
      const rows = key === "pending" ? sets.all : sets.awaitingRegistration;
      const what = key === "pending" ? "" : " · waiting to be registered";
      return { title: `${pendingName}${what}`, summary: `${plural(rows.length, "case", "cases")} · longest in court first`, rows, daysHeader: inCourt, details: pastNote };
    }
    if (key === "disposed" || key === "toLongPending") {
      const moved = key === "toLongPending";
      const rows = closedCases(docket, reading.selection).filter((r) => (r.outcome === "toLongPending") === moved);
      return {
        title: `${moved ? "Moved to long pending" : "Disposed"} · ${period}`,
        summary: plural(rows.length, "case", "cases"),
        rows,
        daysHeader: "Days from filing to closing",
      };
    }
    if (key === "longPending") {
      const rows = longPendingCases(docket, to);
      return {
        title: `On the long pending register · ${formatDayShort(to)}`,
        summary: `${plural(rows.length, "case", "cases")} · not counted as pending · longest in court first`,
        rows,
        daysHeader: inCourt,
        details: pastNote,
      };
    }
    if (key.startsWith("cell-")) {
      const [, stageKey, group] = key.split("-") as [string, StageKey, string];
      const stage = STAGES.find((x) => x.key === stageKey);
      const i = Number(group) as 0 | 1 | 2 | 3;
      if (!stage) return null;
      const rows = sets.byStage[stage.key].filter((r) => pendingAgeGroup(r.case.filed, to) === i);
      return {
        title: `${pendingName} · ${stage.label} · in court ${PENDING_AGE_GROUPS[i].toLowerCase()}`,
        summary: `${plural(rows.length, "case", "cases")} · longest in court first`,
        rows,
        daysHeader: inCourt,
        details: pastNote,
      };
    }
    if (key.startsWith("stage-")) {
      const stage = STAGES.find((x) => `stage-${x.key}` === key);
      if (!stage) return null;
      const rows = sets.byStage[stage.key];
      return {
        title: `${pendingName} · ${stage.label}`,
        summary: `${plural(rows.length, "case", "cases")} · ${STAGE_DESCRIPTION[stage.key].toLowerCase()} · longest in court first`,
        rows,
        daysHeader: inCourt,
        details: pastNote,
      };
    }
    if (key.startsWith("age-")) {
      const i = Number(key.slice(4)) as 0 | 1 | 2 | 3;
      return {
        title: `In court ${PENDING_AGE_GROUPS[i].toLowerCase()}, still pending`,
        summary: `${plural(sets.ages[i].length, "case", "cases")} of ${formatCount(end.pending)} pending · longest in court first`,
        rows: sets.ages[i],
        daysHeader: inCourt,
        details: pastNote,
      };
    }
    return null;
  };
  const spec = list.open ? resolve(list.open) : null;
  /* Cards by default; the table is the same cases cut both ways at once. */
  const [pendingView, setPendingView] = React.useState<"cards" | "table">("cards");
  const viewSwitch = (
    <SegmentedControl
      type="single"
      size="compact"
      value={pendingView}
      onValueChange={(next) => {
        if (next === "cards" || next === "table") setPendingView(next);
      }}
      aria-label="Show pending cases as"
    >
      <SegmentedControlItem value="cards">Cards</SegmentedControlItem>
      <SegmentedControlItem value="table">Table</SegmentedControlItem>
    </SegmentedControl>
  );
  const opener = (key: OverviewList) => ({
    expanded: list.open === key,
    controls: listId,
    onOpen: (from: HTMLElement) => list.toggle(key, from),
  });

  /**
   * The one way the Overview shows change: arrow and amount, then what it is compared
   * with. Colour only when the change is worse (destructive ink); a better or neutral
   * change keeps the line's muted ink, so only a worse change stands out (owner,
   * 2026-11-10).
   */
  const change = (diff: number, base: string, goodUp: boolean | null) => {
    if (!diff) return <p className="text-body-compact text-muted-foreground tabular-nums">No change {base}</p>;
    const up = diff > 0;
    const worse = goodUp !== null && up !== goodUp;
    return (
      <p className="text-body-compact text-muted-foreground tabular-nums">
        <span className={cn("font-semibold", worse && "text-destructive-ink")}>
          <span aria-hidden>{up ? "▲ " : "▼ "}</span>
          <span className="sr-only">{up ? "Up " : "Down "}</span>
          {formatCount(Math.abs(diff))}
          {worse ? <span className="sr-only">, worse</span> : null}
        </span>{" "}
        {base}
      </p>
    );
  };
  /* Every number in a fact line opens its cases, the same as the card's big number; a
     zero has nothing to open and stays plain (owner, 2026-11-10). */
  const factCount = (n: number, label: string, key: OverviewList) =>
    n ? (
      <CountButton name={label} className="-my-3 font-semibold" {...opener(key)}>
        {formatCount(n)}
      </CountButton>
    ) : (
      <span className="font-semibold">0</span>
    );
  const versus = (current: number, baseline: number | undefined, goodUp: boolean | null) => {
    if (reading.compare === "none") return null;
    if (baseline === undefined || name === null) {
      return <p className="text-body-compact text-muted-foreground">No earlier data to compare</p>;
    }
    const b = Math.round(baseline);
    return change(current - b, `vs ${name} (${formatCount(b)})`, goodUp);
  };

  /* A median against the baseline: more days is worse, so only a rise is coloured. */
  const medianVersus = (current: number | null, baseline: number | null) => {
    if (reading.compare === "none" || current === null) return null;
    if (baseline === null || name === null) {
      return <p className="text-body-compact text-muted-foreground">No earlier data to compare</p>;
    }
    return change(current - baseline, `vs ${name} (${formatCount(baseline)})`, false);
  };
  const days = (n: number | null) =>
    n === null ? (
      <span className="inline-flex min-h-10 items-center text-title-l font-semibold text-muted-foreground">–</span>
    ) : (
      <span className="inline-flex min-h-10 items-baseline gap-1.5 text-title-l font-semibold tabular-nums">
        {formatCount(n)}
        <span className="text-body font-medium text-muted-foreground">days</span>
      </span>
    );
  const shown = METHODS.map((m) => ({ ...m, n: methodCount(m.key) }));
  /* Four columns fit a phone only with narrower cell padding, and headings allowed to
     wrap, there. */
  const TIGHT = "max-sm:px-2 max-sm:whitespace-normal";
  /* The baseline column: each count averaged over the baseline's windows. */
  const showBase = reading.compare !== "none" && name !== null && reading.baseline.length > 0;
  const baseCount = (key: "contested" | "uncontested" | "all" | DisposalMethod) => {
    const rows =
      key === "all" ? baseDisposed : key === "contested" ? baseContested : key === "uncontested" ? baseDisposed.filter((r) => !isContested(r.method)) : baseDisposed.filter((r) => r.method === key);
    return Math.round(rows.length / Math.max(1, reading.baseline.length));
  };
  /* Contested in a fixed order; uncontested largest first. */
  const groups = [
    { key: "contested" as const, label: "Contested", rows: contestedRows, methods: shown.filter((m) => isContested(m.key)) },
    {
      key: "uncontested" as const,
      label: "Uncontested",
      rows: uncontestedRows,
      methods: shown.filter((m) => !isContested(m.key)).sort((a, b) => b.n - a.n),
    },
  ];
  /* Time to disposal, then how cases ended, in one container, each under its own heading,
     a hairline between them (owner, 2026-11-14). */
  const disposal = (
    <div className={cn(SECTION, "gap-6")}>
      <section aria-labelledby="dash-time-to-disposal" className="flex min-w-0 flex-col gap-4">
        <h3 id="dash-time-to-disposal" className="text-body font-semibold">
          Time to disposal
        </h3>
        {/* Three medians in the cards' own form: filing to disposal for all disposed cases,
            then for each kind, so a slower kind shows even when the overall figure holds. */}
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          <OverviewCard
            label="Median, all disposed"
            count={days(medians.all)}
            change={medianVersus(medians.all, baseMedians.all)}
            fact={<>{factCount(disposedRows.length, "disposed", "disposed")} disposed · filing to disposal</>}
          />
          <OverviewCard
            label="Median, contested"
            count={days(medians.contested)}
            change={medianVersus(medians.contested, baseMedians.contested)}
            fact={
              <>
                {factCount(contestedRows.length, "contested", "contested")} contested
                {contestedRows.length ? ` · ${pct(methodCount("Convicted") / contestedRows.length)} convicted` : null}
              </>
            }
          />
          <OverviewCard
            label="Median, uncontested"
            count={days(medians.uncontested)}
            change={medianVersus(medians.uncontested, baseMedians.uncontested)}
            fact={<>{factCount(uncontestedRows.length, "uncontested", "uncontested")} uncontested</>}
          />
        </div>

        {/* By when cases were filed: its own range (see cohortPresets). */}
        <section aria-labelledby="dash-cohorts" className="flex min-w-0 flex-col gap-3 pt-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h4 id="dash-cohorts" className="text-body-compact font-semibold">
              By when cases were filed
            </h4>
            <DashboardDatePicker
              docket={docket}
              value={cohortRange}
              defaultValue={cohortOpening}
              defaultLabel="All records"
              presets={cohortPresets}
              idPrefix="dash-cohort-picker"
              dayNote="cases filed on this day"
              daysNote="of filings"
              onChange={(next) => setCohortPick(next.from === cohortOpening.from && next.to === cohortOpening.to ? null : next)}
            />
          </div>
          <p className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1 text-body-compact text-muted-foreground tabular-nums">
            <span>
              <span className="mr-1 text-title-s font-semibold text-foreground">{formatCount(cohortTotal.filed)}</span>filed
            </span>
            <span>
              <span className="mr-1 text-title-s font-semibold text-foreground">
                {cohortTotal.filed ? pct(cohortTotal.disposed / cohortTotal.filed) : "–"}
              </span>
              disposed
            </span>
            <span className="inline-flex items-center gap-1">
              {cohortPending.length ? (
                <CountButton name="still pending" className="text-title-s font-semibold" {...opener("cohortAll")}>
                  {formatCount(cohortPending.length)}
                </CountButton>
              ) : (
                <span className="text-title-s font-semibold text-foreground">0</span>
              )}
              still pending
            </span>
            {cohortTotal.lpr ? (
              <span>
                <span className="mr-1 text-title-s font-semibold text-foreground">{formatCount(cohortTotal.lpr)}</span>on LPR
              </span>
            ) : null}
          </p>
          {cohorts.length ? (
            /* A row per month or quarter. From sm: name, lane, pending in one line; on
               phones the lane drops under the name and count, full width. */
            <div className="flex min-w-0 flex-col gap-2 text-body-compact tabular-nums">
              <div className={cn(COHORT_ROW, "text-caption font-semibold text-muted-foreground")}>
                <span>Filed in</span>
                <span className="max-sm:hidden">Days since filing</span>
                <span className="text-right">Pending</span>
              </div>
              {cohorts.map((c) => (
                <div key={c.g} className={COHORT_ROW}>
                  <span className="font-semibold">{c.label}</span>
                  <div
                    role="img"
                    aria-label={`${c.label}: ${formatCount(c.disposed)} of ${formatCount(c.filed)} disposed, ${c.median === null ? "none yet" : `median ${formatCount(c.median)} days`}; the oldest are ${formatCount(c.age)} days old`}
                    className="relative h-5 min-w-0 max-sm:col-span-2 max-sm:row-start-2"
                  >
                    <span className="absolute inset-y-1 left-0 rounded-full bg-surface-sunken" style={{ width: atDays(c.age) }} />
                    <span
                      className="absolute inset-y-1 left-0 rounded-full bg-brand-muted-foreground"
                      style={{ width: `calc(${atDays(c.age)} * ${c.disposed / Math.max(1, c.filed)})` }}
                    />
                    {c.median !== null ? (
                      <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: atDays(c.median) }} />
                    ) : null}
                    <span aria-hidden className="absolute -inset-y-1 border-l border-dashed border-muted-foreground" style={{ left: atDays(typicalDays) }} />
                  </div>
                  <span className="text-right max-sm:col-start-2 max-sm:row-start-1">
                    {c.pending.length ? (
                      <CountButton name={`filed ${c.label}, still pending`} className="-my-3" {...opener(`cohort-${c.g}`)}>
                        {formatCount(c.pending.length)}
                      </CountButton>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </span>
                </div>
              ))}
              <div className={COHORT_ROW}>
                <span className="max-sm:hidden" />
                <div aria-hidden className="relative h-4 text-caption text-muted-foreground max-sm:col-span-2">
                  {cohortTicks.map((t, i) => (
                    <span key={t} className={cn("absolute -translate-x-1/2 whitespace-nowrap", i % 2 === 1 && "max-sm:hidden")} style={{ left: atDays(t) }}>
                      {t === 0 ? "0" : t === 360 ? "1 yr" : t === 720 ? "2 yrs" : `${t} d`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-body-compact text-muted-foreground">No cases filed in this range</p>
          )}
          <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-4 rounded-full bg-brand-muted-foreground" />
              Share disposed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-0.5 rounded-full bg-foreground" />
              Median days
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-3 border-l border-dashed border-muted-foreground" />
              Typical, {formatCount(typicalDays)} days
            </span>
          </p>
        </section>

      </section>

      <section aria-labelledby="dash-ended" className="flex min-w-0 flex-col gap-4 border-t border-hairline pt-6">
        <h3 id="dash-ended" className="text-body font-semibold">
          How cases ended
        </h3>
        <div className="flex min-w-0 flex-col gap-3">
          {disposedRows.length ? (
            /* One table: the two groups as subtotal rows with their methods under them,
               then all disposed, then moves to the long pending register, which are not
               disposals and stay out of the shares. A column for the baseline gives every
               row its comparison (owner, 2026-11-14; replaces the method cards and the
               separate long-pending container). */
            <div className="min-w-0 rounded-xl border border-hairline p-2">
              <Table aria-labelledby="dash-ended" className="tabular-nums">
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT)}>Outcome</TableHead>
                    <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT, "text-right")}>Cases</TableHead>
                    <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT, "text-right")}>Share</TableHead>
                    {showBase ? (
                      <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT, "text-right")}>
                        {/* Breaks only at a space on phones: "1–14" over "Oct". */}
                        {name?.split(" ").map((word, k) => (
                          <React.Fragment key={k}>
                            {k ? " " : null}
                            <span className="whitespace-nowrap">{word}</span>
                          </React.Fragment>
                        ))}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: false })}>
                  {groups.map((g) => (
                    <React.Fragment key={g.key}>
                      <TableRow className={tableRowClass({ hover: false })}>
                        <th scope="row" className={cn(TABLE_CELL, TIGHT, "font-semibold")}>{g.label}</th>
                        <TableCell className={cn(TABLE_CELL, TIGHT, "text-right font-semibold")}>
                          {g.rows.length ? (
                            <CountButton name={g.key} {...opener(g.key)}>
                              {formatCount(g.rows.length)}
                            </CountButton>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className={cn(TABLE_CELL, TIGHT, "text-right font-semibold")}>{shareOf(g.rows.length, disposedRows.length)}%</TableCell>
                        {showBase ? <TableCell className={cn(TABLE_CELL, TIGHT, "text-right text-muted-foreground")}>{formatCount(baseCount(g.key))}</TableCell> : null}
                      </TableRow>
                      {g.methods.map((m) => (
                        <TableRow key={m.key} className={tableRowClass({ hover: false })}>
                          <th scope="row" className={cn(TABLE_CELL, TIGHT, "pl-8 font-normal")}>{m.key}</th>
                          <TableCell className={cn(TABLE_CELL, TIGHT, "text-right")}>
                            {m.n ? (
                              <CountButton name={m.key.toLowerCase()} {...opener(`method-${m.key}`)}>
                                {formatCount(m.n)}
                              </CountButton>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className={cn(TABLE_CELL, TIGHT, "text-right", !m.n && "text-muted-foreground")}>
                            {m.n ? `${shareOf(m.n, disposedRows.length)}%` : "–"}
                          </TableCell>
                          {showBase ? <TableCell className={cn(TABLE_CELL, TIGHT, "text-right text-muted-foreground")}>{formatCount(baseCount(m.key))}</TableCell> : null}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                  <TableRow className={tableRowClass({ hover: false })}>
                    <th scope="row" className={cn(TABLE_CELL, TIGHT, "font-semibold", !out.toLongPending && "border-b-0")}>All disposed</th>
                    <TableCell className={cn(TABLE_CELL, TIGHT, "text-right font-semibold", !out.toLongPending && "border-b-0")}>{formatCount(disposedRows.length)}</TableCell>
                    <TableCell className={cn(TABLE_CELL, TIGHT, "text-right font-semibold", !out.toLongPending && "border-b-0")}>100%</TableCell>
                    {showBase ? <TableCell className={cn(TABLE_CELL, TIGHT, "text-right font-semibold", !out.toLongPending && "border-b-0")}>{formatCount(baseCount("all"))}</TableCell> : null}
                  </TableRow>
                  {out.toLongPending ? (
                    <TableRow className={tableRowClass({ hover: false })}>
                      <th scope="row" className={cn(TABLE_CELL, TIGHT, "border-b-0 font-normal")}>
                        <span className="flex flex-col">
                          Moved to the long pending register
                          <span className="text-caption text-muted-foreground">Not a disposal</span>
                        </span>
                      </th>
                      <TableCell className={cn(TABLE_CELL, TIGHT, "border-b-0 text-right")}>
                        <CountButton name="moved to long pending" {...opener("toLongPending")}>
                          {formatCount(out.toLongPending)}
                        </CountButton>
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, TIGHT, "border-b-0 text-right text-muted-foreground")}>–</TableCell>
                      {showBase ? (
                        <TableCell className={cn(TABLE_CELL, TIGHT, "border-b-0 text-right text-muted-foreground")}>{formatCount(baseToLongPending ?? 0)}</TableCell>
                      ) : null}
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-body-compact text-muted-foreground">No cases disposed in this period</p>
          )}
        </div>
      </section>
    </div>
  );

  return (
    <section aria-labelledby="dash-overview" className="flex min-w-0 flex-col gap-4">
      <div className={SECTION}>
      <PanelHeader id="dash-overview" title="Overview">
        {picker}
      </PanelHeader>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          <OverviewCard
            label="Cases filed"
            count={<CountButton name="cases filed" className="text-title-l font-semibold" {...opener("filed")}><CountUp value={now.filed} format={countText} /></CountButton>}
            change={versus(now.filed, base?.filed, null)}
            fact={
              sets.awaitingRegistration.length ? (
                <>
                  {factCount(sets.awaitingRegistration.length, "waiting to be registered", "awaiting")} still waiting to be registered
                </>
              ) : (
                "All registered"
              )
            }
          />
          <OverviewCard
            label="Cases closed"
            count={<CountButton name="cases closed" className="text-title-l font-semibold" {...opener("closed")}><CountUp value={now.closed} format={countText} /></CountButton>}
            change={versus(now.closed, base?.closed, true)}
            fact={
              <>
                {factCount(disposed, "disposed", "disposed")} disposed ·{" "}
                {factCount(out.toLongPending, "moved to long pending", "toLongPending")} to long pending
              </>
            }
          />
          <OverviewCard
            label={pendingName}
            count={<CountButton name="pending" className="text-title-l font-semibold" {...opener("pending")}><CountUp value={end.pending} format={countText} /></CountButton>}
            change={
              opening === null ? (
                <p className="text-body-compact text-muted-foreground">No earlier data to compare</p>
              ) : (
                change(end.pending - opening, `since ${since} (${formatCount(opening)})`, false)
              )
            }
            fact={
              <>
                {factCount(end.longPending, "on the long pending register", "longPending")} more on the long pending register, not counted
              </>
            }
          />
        </div>
      </div>

      {/* The registers (note 1.2, all users a(i)): the counts staff check against the paper
          registers. Pending is read on the period's last day; disposed and judgments over the
          period. Judgments carry the last 12 months as small bars (owner, 2026-11-14). */}
      <section aria-labelledby="dash-registers" className="flex min-w-0 flex-col gap-3 border-t border-hairline pt-6">
        <h3 id="dash-registers" className="text-body font-semibold">
          Registers
        </h3>
        <ul className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ["ST pending", sets.st.length, "st", "after cognizance"],
              ["ST disposed", stDisposed.length, "stDisposed", spanShort],
              ["CMP pending", sets.cmp.length, "cmp", "awaiting cognizance"],
              ["CMP disposed", cmpDisposed.length, "cmpDisposed", spanShort],
              ["LPR", end.longPending, "longPending", `on the register · ${formatCount(out.toLongPending)} moved in`],
            ] as [string, number, OverviewList, string][]
          ).map(([label, n, key, sub]) => (
            <li key={label} className="flex min-w-0 flex-col items-start gap-1 rounded-xl bg-surface-sunken p-4">
              <span className="text-body-compact font-semibold">{label}</span>
              {n ? (
                <CountButton name={label.toLowerCase()} className="text-title-s font-semibold" {...opener(key)}>
                  {formatCount(n)}
                </CountButton>
              ) : (
                <span className="inline-flex min-h-10 items-center text-title-s font-semibold text-muted-foreground">0</span>
              )}
              <span className="text-caption text-muted-foreground">{sub}</span>
            </li>
          ))}
          <li className="flex min-w-0 flex-col items-start gap-1 rounded-xl bg-surface-sunken p-4">
            <span className="text-body-compact font-semibold">Judgments</span>
            {contestedRows.length ? (
              <CountButton name="judgments" className="text-title-s font-semibold" {...opener("contested")}>
                {formatCount(contestedRows.length)}
              </CountButton>
            ) : (
              <span className="inline-flex min-h-10 items-center text-title-s font-semibold text-muted-foreground">0</span>
            )}
            <div
              role="img"
              aria-label={`Judgments each month: ${judgmentMonths.map((m) => `${MONTHS_SHORT[m.key % 12]} ${m.n}`).join(", ")}`}
              className="flex h-10 w-full items-end gap-0.5"
            >
              {judgmentMonths.map((m) => (
                <span
                  key={m.key}
                  style={{ height: `${Math.max(4, (m.n / judgmentMax) * 100)}%` }}
                  className={cn("flex-1 rounded-t-sm", m.partial ? "bg-brand-accent" : "bg-brand-muted-foreground")}
                />
              ))}
            </div>
            <span className="text-caption text-muted-foreground">Last 12 months</span>
          </li>
        </ul>
        {sets.awaitingRegistration.length ? (
          <p className="text-caption text-muted-foreground tabular-nums">
            {factCount(sets.awaitingRegistration.length, "waiting to be registered", "awaiting")} filed cases are on no register yet: they are waiting to be registered.
          </p>
        ) : null}
      </section>
      </div>

      {/* The two ways the pending cases split, one under the other, in the same cells; or,
          by the toggle, as one table of stage by time in court (owner, 2026-11-10: round 5,
          option A with option C as a table view). Both read the Pending card's cases on
          its day, so neither repeats the total or the day. Stage comes first: for every
          user, the overview cards then pending by stage lead the dashboard (11 Nov call
          with Satya; owner, 2026-11-14). The switch sits on the first heading's row. Both
          pending sections come before how cases ended (owner, 2026-11-14). */}
      {pendingView === "cards" ? (
        <>
          {/* One section, one heading: the stage cells, then the time table under a rule, in
              one container (owner, 2026-11-14). */}
          <section aria-labelledby="dash-pending-split" className={SECTION}>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h3 id="dash-pending-split" className="text-body font-semibold">
                Pending cases by stage and time
              </h3>
              {viewSwitch}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
            {/* The same cells, grouped either side of cognizance: one row from xl, the
                groups stacked below that. Cases at registration are not on the CMP register
                yet, so the groups are named by cognizance, not by register. */}
            <div aria-label="By stage" role="group" className="flex min-w-0 flex-col gap-6 xl:grid xl:grid-cols-6 xl:gap-0">
              {STAGE_GROUPS.map((group, g) => {
                const stages = STAGES.filter((stage) => group.keys.includes(stage.key));
                const count = stages.reduce((sum, stage) => sum + sets.byStage[stage.key].length, 0);
                const id = `dash-by-stage-${group.keys[0]}`;
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex min-w-0 flex-col gap-3",
                      g === 0 ? "xl:col-span-2 xl:pr-4" : "xl:col-span-4 xl:border-l xl:border-hairline xl:pl-4",
                    )}
                  >
                    <p id={id} className="border-b border-hairline pb-1.5 text-caption text-muted-foreground tabular-nums">
                      {group.label} · {formatCount(count)}
                    </p>
                    <ul
                      aria-labelledby={id}
                      className={cn("grid grid-cols-2 gap-y-4 tabular-nums md:grid-cols-4", g === 0 && "xl:grid-cols-2")}
                    >
                      {stages.map((stage, i) => (
                        <PendingCount
                          key={stage.key}
                          label={stage.label}
                          count={sets.byStage[stage.key].length}
                          total={end.pending}
                          name={`pending at ${stage.label.toLowerCase()}`}
                          opener={opener(`stage-${stage.key}`)}
                          index={i}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            {/* A plain table, oldest last: an ordered split of one total reads as rows, and an
                empty group is a quiet row rather than a card with a 0 in it. It replaces the
                four cards, which gave the empty groups as much room as the full ones (owner,
                2026-11-14). Every non-zero count opens its cases. */}
            <div className="min-w-0 border-t border-hairline pt-4">
              <Table aria-label="Pending cases by time in court" className="tabular-nums">
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead scope="col" className={TABLE_HEAD}>Time in court</TableHead>
                    <TableHead scope="col" className={cn(TABLE_HEAD, "text-right sm:w-1/4")}>Cases</TableHead>
                    <TableHead scope="col" className={cn(TABLE_HEAD, "text-right sm:w-1/4")}>Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: false })}>
                  {PENDING_AGE_GROUPS.map((label, i) => {
                    const n = ages[i];
                    return (
                      <TableRow key={label} className={tableRowClass({ hover: false })}>
                        <th scope="row" className={cn(TABLE_CELL, "font-semibold")}>{label}</th>
                        <TableCell className={cn(TABLE_CELL, "text-right")}>
                          {n ? (
                            <CountButton name={`in court ${label.toLowerCase()}`} {...opener(`age-${i as 0 | 1 | 2 | 3}`)}>
                              {formatCount(n)}
                            </CountButton>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className={cn(TABLE_CELL, "text-right", !n && "text-muted-foreground")}>
                          {n ? pct(n / Math.max(1, end.pending)) : "–"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className={tableRowClass({ hover: false })}>
                    <th scope="row" className={cn(TABLE_CELL, "border-b-0 font-semibold")}>All pending</th>
                    <TableCell className={cn(TABLE_CELL, "border-b-0 text-right font-semibold")}>{formatCount(end.pending)}</TableCell>
                    <TableCell className={cn(TABLE_CELL, "border-b-0 text-right font-semibold")}>100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            </div>
          </section>

          {disposal}
        </>
      ) : (
        <>
        <section aria-labelledby="dash-pending-table" className={SECTION}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h3 id="dash-pending-table" className="text-body font-semibold">
              Pending cases by stage and time
            </h3>
            {viewSwitch}
          </div>
          <div className="min-w-0">
            <Table aria-labelledby="dash-pending-table" className="tabular-nums">
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  <TableHead scope="col" className={TABLE_HEAD}>Stage</TableHead>
                  {PENDING_AGE_GROUPS.map((label) => (
                    <TableHead key={label} scope="col" className={cn(TABLE_HEAD, "text-right")}>{label}</TableHead>
                  ))}
                  <TableHead scope="col" className={cn(TABLE_HEAD, "text-right")}>All</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ hover: false })}>
                {STAGES.map((stage) => {
                  const rows = sets.byStage[stage.key];
                  const split = [0, 0, 0, 0];
                  for (const r of rows) split[pendingAgeGroup(r.case.filed, to)]++;
                  return (
                    <TableRow key={stage.key} className={tableRowClass({ hover: false })}>
                      <th scope="row" className={cn(TABLE_CELL, "font-semibold")}>{stage.label}</th>
                      {split.map((n, i) => (
                        <TableCell key={i} className={cn(TABLE_CELL, "text-right")}>
                          {n ? (
                            <CountButton
                              name={`at ${stage.label.toLowerCase()}, in court ${PENDING_AGE_GROUPS[i].toLowerCase()}`}
                              {...opener(`cell-${stage.key}-${i as 0 | 1 | 2 | 3}`)}
                            >
                              {formatCount(n)}
                            </CountButton>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className={cn(TABLE_CELL, "text-right")}>
                        {rows.length ? (
                          <CountButton name={`pending at ${stage.label.toLowerCase()}`} className="font-semibold" {...opener(`stage-${stage.key}`)}>
                            {formatCount(rows.length)}
                          </CountButton>
                        ) : (
                          <span className="font-semibold text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className={tableRowClass({ hover: false })}>
                  <th scope="row" className={cn(TABLE_CELL, "border-b-0 font-semibold")}>All pending</th>
                  {ages.map((n, i) => (
                    <TableCell key={i} className={cn(TABLE_CELL, "border-b-0 text-right font-semibold", !n && "text-muted-foreground")}>
                      {formatCount(n)}
                    </TableCell>
                  ))}
                  <TableCell className={cn(TABLE_CELL, "border-b-0 text-right font-semibold")}>{formatCount(end.pending)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
        {disposal}
        </>
      )}

      <div id={listId} className="min-w-0 empty:hidden">
        {spec && list.open ? (
          <CaseListBox
            key={list.open}
            id={`dash-overview-${list.open}`}
            title={spec.title}
            summary={spec.summary}
            details={spec.details}
            rows={spec.rows}
            daysHeader={spec.daysHeader}
            onClose={list.close}
          />
        ) : null}
      </div>
    </section>
  );
}

/** One Overview card: label, count, change, and one fact line — the same parts on all three. */
/** The two groups of the stage card, either side of cognizance. */
const STAGE_GROUPS: { label: string; keys: StageKey[] }[] = [
  { label: "Before cognizance", keys: ["registration", "cognizance"] },
  { label: "After cognizance", keys: ["appearance", "bail", "trial", "judgement"] },
];

/**
 * One count in the age and stage cards: label, number that opens its cases, share of
 * pending. Rules between columns: every second one on phones, all but the first from md.
 */
function PendingCount({
  label,
  count,
  total,
  name,
  opener,
  index,
  className,
}: {
  label: string;
  count: number;
  total: number;
  name: string;
  opener: { expanded: boolean; controls: string; onOpen: (from: HTMLElement) => void };
  index: number;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col items-start gap-1 px-4",
        index % 2 === 1 ? "border-l border-hairline" : "max-md:pl-0",
        index === 0 && "pl-0",
        index === 2 && "md:border-l md:border-hairline",
        className,
      )}
    >
      <span className="text-caption text-muted-foreground">{label}</span>
      {count ? (
        <CountButton name={name} className="text-title-l font-semibold" {...opener}>
          {formatCount(count)}
        </CountButton>
      ) : (
        <span className="inline-flex min-h-10 items-center text-title-l font-semibold text-muted-foreground">0</span>
      )}
      <span className="text-caption text-muted-foreground">
        {count ? `${pct(count / Math.max(1, total))} of pending` : "None"}
      </span>
    </li>
  );
}

function OverviewCard({
  label,
  count,
  change,
  fact,
}: {
  label: string;
  count: React.ReactNode;
  change: React.ReactNode;
  fact: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1 rounded-xl bg-surface-sunken p-4 sm:px-6">
      <p className="text-body-compact font-semibold">{label}</p>
      {count}
      {change}
      <p className="mt-2 w-full border-t border-hairline pt-2 text-caption text-muted-foreground tabular-nums">{fact}</p>
    </div>
  );
}

/**
 * Where the pending cases are: the stage path, in its own panel since 2026-11-10. It is
 * the material of the note's 1.2 C (outlier cases), so it left the Overview (owner); its
 * content is redesigned next. It reads its own period from its own picker.
 */
function StagesPanel({ docket }: { docket: CourtDocket }) {
  const [picked, setPicked] = React.useState<Period | null>(null);
  const opening = defaultSelection(docket);
  const reading = periodReading(picked ?? opening, docket, "none");
  const { to } = reading.selection;
  const latest = docket.today;
  const end = positionOn(docket, to);
  const list = useCaseList<StageList>();
  const listId = "dash-stages-cases";
  const pastNote = reading.live
    ? undefined
    : [`Days are counted to ${formatDay(to)}. Stage and next hearing are as they stand on ${formatDay(latest)}.`];

  const resolve = (key: StageList): ListSpec => {
    const [kind, stageKey, bin] = key.split("-") as [string, StageKey, string | undefined];
    const stage = STAGES.find((x) => x.key === stageKey)!;
    const limit = COURT_LIMITS.stages[stage.key];
    const path = stagePathFor(docket, reading.selection)[stage.key];
    const on = reading.live ? "" : ` · on ${formatDayShort(to)}`;
    if (kind === "stage") {
      return { title: `${stage.label}: all pending${on}`, summary: `${plural(path.rows.length, "case", "cases")} · longest in the stage first`, rows: path.rows, daysHeader: "Days in stage", details: pastNote };
    }
    if (kind === "bin") {
      const b = path.bins[Number(bin)];
      const span = b.to === null ? `${formatCount(b.from)}+ days` : b.from === b.to ? `${formatCount(b.from)} days` : `${formatCount(b.from)}–${formatCount(b.to)} days`;
      return { title: `${stage.label}: ${span} in the stage${on}`, summary: plural(b.rows.length, "case", "cases"), rows: b.rows, daysHeader: "Days in stage", details: pastNote };
    }
    return { title: `${stage.label} over ${limit} days${on}`, summary: `${plural(end.overdue[stage.key].length, "case", "cases")} · longest first`, rows: end.overdue[stage.key], daysHeader: "Days in stage", details: pastNote };
  };
  const spec = list.open ? resolve(list.open) : null;
  const opener: Opener = (key) => ({
    expanded: list.open === key,
    controls: listId,
    onOpen: (from: HTMLElement) => list.toggle(key, from),
  });

  return (
    <section aria-labelledby="dash-stages" className={PANEL}>
      <PanelHeader id="dash-stages" title="Where the pending cases are" note="Select a stage for its details.">
        <DashboardDatePicker
          docket={docket}
          value={reading.selection}
          defaultValue={opening}
          idPrefix="dash-stages-picker"
          dayNote="stages are read on this day"
          rangeNote={() => "counted on its last day; moves in and out across the range"}
          onChange={(next) => {
            list.setOpen(null);
            setPicked(next.from === opening.from && next.to === opening.to ? null : next);
          }}
        />
      </PanelHeader>
      <StagePath docket={docket} reading={reading} opener={opener} />
      <div id={listId} className="min-w-0 empty:hidden">
        {spec && list.open ? (
          <CaseListBox
            key={list.open}
            id={`dash-stages-${list.open}`}
            title={spec.title}
            summary={spec.summary}
            details={spec.details}
            rows={spec.rows}
            daysHeader={spec.daysHeader}
            onClose={list.close}
          />
        ) : null}
      </div>
    </section>
  );
}

type Opener = (key: StageList) => {
  expanded: boolean;
  controls: string;
  onOpen: (from: HTMLElement) => void;
};

/** "0–10 days", "141+ days", "4 days". */
function binSpan(from: number, to: number | null): string {
  if (to === null) return `${formatCount(from)}+ days`;
  return from === to ? `${formatCount(from)} days` : `${formatCount(from)}–${formatCount(to)} days`;
}

/**
 * Bars past the review point, and their legend swatch. Warning amber is only 1.54:1 on
 * the card, so it carries the warning-ink edge the DS warning Button uses; ink alone is
 * text colour and never a fill. The baseline is the chart's own bottom border.
 */
const LATE_BAR = "border border-b-0 border-warning-ink bg-warning";
const LATE_SWATCH = "border border-warning-ink bg-warning";

/**
 * Where the pending cases are (Case Flow v4): the six stages as a path of selectable
 * cards. Each card shows the stage's cases, its share of all pending, how long they have
 * been in the stage (bins that line up with the review point, past it in warning amber),
 * what came in and left in the period, and the typical days there. Between stages,
 * the cases that moved on in the period — with a trickle of dots that plays when the
 * period changes and stops within five seconds. A selected stage opens in detail below.
 */
const WIDE_PATH = "(min-width: 80rem)";
const subscribeWide = (notify: () => void) => {
  const media = window.matchMedia(WIDE_PATH);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

/**
 * Whether the stage path lays its cards out in a row. In a row the stage's detail opens
 * below the path; stacked, it opens under the card that was selected, so it is not a
 * screen or more away from the tap.
 */
function useWidePath(): boolean {
  return React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_PATH).matches,
    () => false,
  );
}

function StagePath({
  docket,
  reading,
  opener,
}: {
  docket: CourtDocket;
  reading: PeriodReading;
  opener: Opener;
}) {
  const end = positionOn(docket, reading.end);
  const before = reading.overdueSince === null ? null : positionOn(docket, reading.overdueSince);
  const path = stagePathFor(docket, reading.selection);
  const [selected, setSelected] = React.useState<StageKey | null>(null);
  const most = Math.max(1, ...STAGES.map((s) => path[s.key].rows.length));
  const since = reading.kind === "day" ? "in 30 days" : `since ${formatDayShort(reading.selection.from)}`;
  const during = reading.kind === "day" ? "that day" : "in this period";
  const detailId = "dash-stage-detail";
  const trigger = `${reading.selection.from}:${reading.selection.to}`;
  const box = React.useRef<HTMLDivElement>(null);
  useGrowIn(box, trigger);
  const wide = useWidePath();
  const detail = selected ? (
    <StageDetailView
      key={selected}
      docket={docket}
      reading={reading}
      stage={selected}
      opener={opener}
      onClose={() => setSelected(null)}
      className={wide ? undefined : "mx-0"}
    />
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div ref={box} className={cn(BOX, "flex flex-col pt-3")}>
        <div aria-hidden className="hidden grid-cols-6 px-2 pb-2 text-caption text-muted-foreground xl:grid">
          <span className="col-span-2 mx-1 border-b border-hairline px-3 pb-1.5">CMP · before cognizance</span>
          <span className="col-span-4 mx-1 border-b border-hairline px-3 pb-1.5">ST · after cognizance</span>
        </div>
        <ol className="grid min-w-0 xl:grid-cols-6 xl:px-2 xl:pt-4">
          {STAGES.map((stage, i) => {
            const p = path[stage.key];
            const n = p.rows.length;
            const late = end.overdue[stage.key].length;
            const then = before?.overdue[stage.key].length;
            const diff = then === undefined ? null : late - then;
            const on = selected === stage.key;
            const prev = STAGES[i - 1];
            const moved = prev ? path[prev.key].movedOn : 0;
            const binMost = Math.max(1, ...p.bins.map((b) => b.rows.length));
            return (
              <li
                key={stage.key}
                className={cn("relative flex min-w-0 flex-col gap-1.5 px-3 py-2", i > 0 && "border-hairline max-xl:border-t xl:border-l")}
              >
                {prev ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        role="img"
                        tabIndex={0}
                        aria-label={`${plural(moved, "case", "cases")} moved from ${prev.label} to ${stage.label} ${during}`}
                        className="z-10 flex w-fit items-center gap-1 rounded-full border border-hairline bg-card px-1.5 py-0.5 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring xl:absolute xl:-top-3.5 xl:left-0 xl:-translate-x-1/2"
                      >
                        <TrickleDots count={moved} trigger={trigger} />
                        <span className="text-caption font-semibold tabular-nums">{formatCount(moved)}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="tabular-nums">
                      {plural(moved, "case", "cases")} moved from {prev.label} to {stage.label} {during}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                <button
                  type="button"
                  aria-expanded={on}
                  aria-controls={detailId}
                  aria-label={`${stage.label}: ${plural(n, "case", "cases")} pending, ${formatCount(late)} over ${p.limit} days. ${on ? "Close" : "Open"} the details`}
                  onClick={() => setSelected(on ? null : stage.key)}
                  className={cn(
                    "-mx-1 flex flex-col gap-1.5 rounded-lg border border-transparent px-2 pt-2 pb-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none",
                    on && "border-primary bg-brand-muted ring-1 ring-primary ring-inset hover:bg-brand-muted",
                  )}
                >
                  <span className="text-body font-semibold">{stage.label}</span>
                  <CountUp value={n} format={countText} className="text-title font-semibold tabular-nums" />
                  <span aria-hidden className="h-1 overflow-hidden rounded-full bg-track">
                    <span data-grow="x" className="block h-full origin-left rounded-full bg-muted-foreground" style={{ width: `${(n / most) * 100}%` }} />
                  </span>
                  <span aria-hidden className="relative mt-1 flex h-11 items-end gap-0.5 border-b border-border">
                    {p.bins.map((b, j) => (
                      <span
                        key={j}
                        data-grow="y"
                        className={cn("block min-h-px flex-1 origin-bottom rounded-t-xs", b.late ? LATE_BAR : "bg-brand-accent")}
                        style={{ height: `${(b.rows.length / binMost) * 100}%` }}
                      />
                    ))}
                    <span
                      className="absolute -top-1 bottom-0 w-0 border-l border-dashed border-foreground"
                      style={{ left: `${(p.reviewAfter / p.bins.length) * 100}%` }}
                    />
                  </span>
                  <span className="flex gap-2.5 text-caption text-muted-foreground tabular-nums">
                    <span>+{formatCount(p.cameIn)} in</span>
                    <span>−{formatCount(p.left)} out</span>
                  </span>
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {p.median === null ? "No cases" : `Typically here ${plural(p.median, "day", "days")}`}
                  </span>
                </button>
                <span>
                  {late ? (
                    <CountButton name={`at ${stage.label}`} className="-my-2 text-body-compact text-warning-ink" {...opener(`late-${stage.key}`)}>
                      <span>
                        <strong className="font-semibold">{formatCount(late)}</strong> over {p.limit} days
                      </span>
                    </CountButton>
                  ) : (
                    <span className="text-body-compact text-success-ink">None over {p.limit} days</span>
                  )}
                </span>
                {diff !== null ? (
                  <span
                    className={cn(
                      "text-caption tabular-nums",
                      diff > 0 ? "text-destructive-ink" : diff < 0 ? "text-success-ink" : "text-muted-foreground",
                    )}
                  >
                    {diff ? (
                      <>
                        <span aria-hidden>{diff > 0 ? "▲ " : "▼ "}</span>
                        <span className="sr-only">{diff > 0 ? "Up " : "Down "}</span>
                        {formatCount(Math.abs(diff))} over the limit {since}
                      </>
                    ) : (
                      `No change ${since}`
                    )}
                  </span>
                ) : null}
                {!wide && on ? <div id={detailId}>{detail}</div> : null}
              </li>
            );
          })}
        </ol>
        {wide ? (
          <div id={detailId} className="empty:hidden">
            {detail}
          </div>
        ) : null}
        <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-hairline px-4 py-3 text-caption text-muted-foreground sm:px-6">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-3.5 rounded-xs bg-brand-accent" />
            Days in the stage, within the review point
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className={cn("h-2.5 w-3.5 rounded-xs", LATE_SWATCH)} />
            Past the review point
          </span>
          <span className="tabular-nums">
            Not counted above: {plural(end.longPending, "case", "cases")} on the long pending register.
          </span>
        </p>
      </div>
    </div>
  );
}

function StageDetailView({
  docket,
  reading,
  stage: key,
  opener,
  onClose,
  className,
}: {
  docket: CourtDocket;
  reading: PeriodReading;
  stage: StageKey;
  opener: Opener;
  onClose: () => void;
  className?: string;
}) {
  const stage = STAGES.find((s) => s.key === key)!;
  const p = stagePathFor(docket, reading.selection)[key];
  const end = positionOn(docket, reading.end);
  const next = nextDates(docket);
  const late = end.overdue[key].length;
  const n = p.rows.length;
  const most = Math.max(1, ...p.bins.map((b) => b.rows.length));
  const usual = key === "registration" ? null : next.usual[key];
  const box = React.useRef<HTMLElement>(null);
  useGrowIn(box, `${key}:${reading.selection.from}:${reading.selection.to}`);
  const fact = (label: string, value: React.ReactNode, sub?: string) => (
    <div className="flex flex-col">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-title-s font-semibold tabular-nums">{value}</dd>
      {sub ? <dd className="text-caption text-muted-foreground">{sub}</dd> : null}
    </div>
  );
  return (
    <section
      ref={box}
      aria-labelledby="dash-stage-detail-title"
      className={cn(BOX, RESOLVE_IN_PLACE, "mx-2 mt-3 flex flex-col gap-4 bg-card p-4 sm:p-6", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 id="dash-stage-detail-title" className="text-body font-semibold">
            {stage.label}
          </h4>
          <p className="text-body-compact text-muted-foreground">
            {STAGE_DESCRIPTION[key]}. Review point: {p.limit} days in the stage.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-caption text-muted-foreground">Days in the stage, {plural(n, "case", "cases")}</span>
          <div role="group" aria-label={`${stage.label}: days in the stage`} className="relative mt-6 flex h-36 items-end gap-1 border-b border-border">
            {p.bins.map((b, i) => {
              const c = b.rows.length;
              const tip = `${plural(c, "case", "cases")} · ${binSpan(b.from, b.to)} in ${stage.label.toLowerCase()}`;
              const o = opener(`bin-${key}-${i}`);
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    {c ? (
                      <button
                        type="button"
                        data-grow="y"
                        aria-label={`${tip}, ${o.expanded ? "hide" : "show"} the cases`}
                        aria-expanded={o.expanded}
                        aria-controls={o.controls}
                        onClick={(event) => o.onOpen(event.currentTarget)}
                        className={cn(
                          "relative flex-1 origin-bottom cursor-pointer rounded-t-xs outline-hidden hover:outline-2 hover:outline-solid hover:outline-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:outline-2 aria-expanded:outline-solid aria-expanded:outline-foreground",
                          b.late ? LATE_BAR : "bg-brand-accent",
                        )}
                        style={{ height: `${(c / most) * 100}%` }}
                      >
                        <span aria-hidden className="absolute bottom-full left-1/2 -translate-x-1/2 pb-0.5 text-caption text-muted-foreground tabular-nums">
                          {formatCount(c)}
                        </span>
                      </button>
                    ) : (
                      <span role="img" tabIndex={0} aria-label={tip} className="h-px flex-1 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent className="tabular-nums">{tip}</TooltipContent>
                </Tooltip>
              );
            })}
            <span
              aria-hidden
              className="absolute -top-5 bottom-0 w-0 border-l border-dashed border-foreground"
              style={{ left: `${(p.reviewAfter / p.bins.length) * 100}%` }}
            >
              <span className="absolute top-0 left-1 text-caption whitespace-nowrap">Review point · {p.limit} days</span>
            </span>
          </div>
          <div aria-hidden className="flex justify-between text-caption text-muted-foreground tabular-nums">
            <span>0 days</span>
            <span>{formatCount(p.limit * 2)}+ days</span>
          </div>
          <p className="flex flex-wrap gap-x-4 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-3.5 rounded-xs bg-brand-accent" />
              Within {p.limit} days
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("h-2.5 w-3.5 rounded-xs", LATE_SWATCH)} />
              Past the review point
            </span>
          </p>
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-3">
          {fact(
            "Pending",
            n ? (
              <CountButton name={`pending at ${stage.label}`} className="-my-2" {...opener(`stage-${key}`)}>
                {formatCount(n)}
              </CountButton>
            ) : (
              "0"
            ),
            `${Math.round((n / Math.max(1, end.pending)) * 100)}% of all pending`,
          )}
          {fact(
            "Past the review point",
            late ? (
              <CountButton name={`over ${p.limit} days at ${stage.label}`} className="-my-2" {...opener(`late-${key}`)}>
                {formatCount(late)}
              </CountButton>
            ) : (
              "0"
            ),
            n ? `${Math.round((late / n) * 100)}% of this stage` : "–",
          )}
          {fact("Typical time here", p.median === null ? "–" : plural(p.median, "day", "days"), "median, cases there now")}
          {fact(
            reading.kind === "day" ? "That day" : "This period",
            `+${formatCount(p.cameIn)} / −${formatCount(p.left)}`,
            "came in / left the stage",
          )}
          {usual !== null
            ? fact(
                "Usual gap between hearings",
                plural(usual, "day", "days"),
                reading.live ? undefined : `on ${formatDayShort(docket.today)} only`,
              )
            : null}
        </dl>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption text-muted-foreground">Waiting longest</span>
          <ol className="flex flex-col">
            {p.rows.slice(0, 5).map((r) => (
              <li key={r.case.id} className="flex justify-between gap-3 border-t border-hairline py-1.5 text-body-compact">
                <span className="min-w-0 truncate">
                  <span className="font-semibold tabular-nums">{r.case.caseNumber}</span> {r.case.title}
                </span>
                <span className={cn("shrink-0 tabular-nums", r.days > p.limit ? "font-semibold text-warning-ink" : "")}>
                  {plural(r.days, "day", "days")}
                </span>
              </li>
            ))}
          </ol>
          {late ? (
            <Button
              type="button"
              variant="link"
              className="h-10 w-fit px-0 text-body-compact"
              aria-expanded={opener(`late-${key}`).expanded}
              aria-controls={opener(`late-${key}`).controls}
              onClick={(event) => opener(`late-${key}`).onOpen(event.currentTarget)}
            >
              Show all {formatCount(late)} past the review point
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
