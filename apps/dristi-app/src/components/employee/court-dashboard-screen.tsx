"use client";

import * as React from "react";
import { ChevronRightIcon } from "lucide-react";

import { useCourtText } from "@/components/court/court-provider";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import {
  BOX,
  CaseListBox,
  CountButton,
  NeedsAttention,
  PANEL,
  PanelHeader,
  plural,
  SegmentBar,
  useCaseList,
} from "@/components/employee/court-dashboard-attention";
import { Closures } from "@/components/employee/court-dashboard-closures";
import { CountUp, TrickleDots, useGrowIn } from "@/components/employee/court-dashboard-motion";
import { Trends } from "@/components/employee/court-dashboard-trends";
import { DashboardDatePicker } from "@/components/employee/dashboard-date-picker";
import { useCourtDocket } from "@/components/employee/docket-table";
import { useCourtSession } from "@/components/employee/use-court-role";
import { useCourtToday } from "@/components/employee/use-court-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  COURT_LIMITS,
  DAY_MS,
  monthKey,
  msToDay,
  STAGES,
  type CourtDocket,
  type DocketCase,
  type StageKey,
} from "@/lib/employee/court-docket";
import {
  averageOver,
  baselineWindows,
  closedCases,
  defaultSelection,
  filedAndClosed,
  filedCases,
  formatDay,
  formatDayShort,
  formatSpan,
  formatSpanFull,
  nextDates,
  outcomesIn,
  pendingSets,
  periodReading,
  positionOn,
  stagePathFor,
  type CompareMode,
  type Period,
  type PeriodReading,
} from "@/lib/employee/court-flow";
import { formatCourtDay } from "@/lib/employee/hearings";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * `/employee` — the magistrate dashboard, built to the owner's Case Flow design, version
 * 4 (2026-10-19), with its interaction and motion. Four panels on the work canvas:
 *
 * 1. **Overview** — the period under review (this month so far by default, set by the
 *    date picker in the panel), what was filed and closed against a chosen baseline, what
 *    is pending and how long it has been in court, and the stage path: each stage's cases,
 *    how long they have waited, what came in and left, and what moved on. A stage opens
 *    in detail below the path. Every count opens its cases in the panel.
 * 2. **Needs attention** — the hearing-date and process checks, on its own date.
 * 3. **Trends** — five measures month by month, one at a time in detail.
 * 4. **How cases were closed** — outcomes against the baseline, and when they happened.
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

/** One baseline window by name: "Thu 8 Oct", "September 2025", "1–19 Sep 2026". */
function windowName(reading: PeriodReading, w: Period, latest: number): string {
  if (reading.kind === "day") return weekdayDay(w.from, latest, reading.compare === "year");
  /* Month to date and whole months both baseline against whole months. */
  if (reading.kind === "full" || reading.kind === "month") return monthLong(monthKey(w.from));
  return formatSpanFull(w.from, w.to);
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
  if (reading.kind === "full" || reading.kind === "month") return monthLong(monthKey(w.from));
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
        <NeedsAttention docket={docket} />
        <Trends docket={docket} />
        <ClosuresPanel docket={docket} />
      </div>
    </TooltipProvider>
  );
}

/**
 * How cases were closed reads its own period and comparison, from its own picker: this
 * month and no comparison to begin with, and Reset in the picker returns there.
 */
function ClosuresPanel({ docket }: { docket: CourtDocket }) {
  const [picked, setPicked] = React.useState<Period | null>(null);
  const [compare, setCompare] = React.useState<CompareMode>("none");
  const opening = defaultSelection(docket);
  const reading = periodReading(picked ?? opening, docket, compare);
  const { from, to } = reading.selection;
  return (
    <Closures
      docket={docket}
      reading={reading}
      period={periodName(reading)}
      current={from === to ? formatDayShort(to) : formatSpan(from, to, docket.today)}
      baselineLabel={baselineName(reading, docket.today, true)}
      averaged={reading.baseline.length > 1}
      picker={
        <DashboardDatePicker
          docket={docket}
          value={reading.selection}
          compare={compare}
          defaultValue={opening}
          defaultCompare="none"
          idPrefix="dash-closures-picker"
          dayNote="closures on this day"
          daysNote="of closures"
          onChange={(next, mode) => {
            setPicked(next.from === opening.from && next.to === opening.to ? null : next);
            setCompare(mode);
          }}
        />
      }
    />
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

/**
 * How long the pending cases have been in court: an ordinal teal ramp, light to dark in
 * light mode (dark to light in dark mode, as the design has it). The lightest shade carries
 * a brand edge so it keeps a 3:1 boundary.
 */
const AGE_SHADE = [
  "bg-brand-muted ring-1 ring-brand-accent ring-inset",
  "bg-brand-accent",
  "bg-brand-muted-foreground",
] as const;

type OverviewList =
  | "filed"
  | "closed"
  | "pending"
  | "cmp"
  | "st"
  | "awaiting"
  | `age-${0 | 1 | 2}`
  | `stage-${StageKey}`
  | `late-${StageKey}`
  | `bin-${StageKey}-${number}`;

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
  const opening = from - DAY_MS < docket.start ? 0 : positionOn(docket, from - DAY_MS).pending;
  const net = end.pending - opening;
  const startWord =
    reading.kind === "day"
      ? "at the start of the day"
      : reading.kind === "month" || reading.kind === "full"
        ? `on 1 ${MONTHS_LONG[parts(to).month].slice(0, 3)}`
        : `on ${formatDayShort(from)}`;
  const sets = pendingSets(docket, reading.selection);
  const ages = sets.ages.map((a) => a.length);
  const ageLabels = [
    reading.kind === "day" ? "Filed today" : "Filed in this period",
    "Filed up to 6 months earlier",
    "Filed more than 6 months earlier",
  ];
  const period = periodName(reading);
  const list = useCaseList<OverviewList>();
  const listId = "dash-overview-cases";
  const pendingName = reading.live ? "Pending today" : `Pending on ${formatDayShort(to)}`;
  const pastNote = reading.live
    ? undefined
    : [`Days are counted to ${formatDay(to)}. Stage and next hearing are as they stand on ${formatDay(latest)}.`];

  const resolve = (key: OverviewList): ListSpec | null => {
    const inCourt = "Days in court";
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
    if (key === "pending" || key === "cmp" || key === "st" || key === "awaiting") {
      const rows = key === "pending" ? sets.all : key === "cmp" ? sets.cmp : key === "st" ? sets.st : sets.awaitingRegistration;
      const what = key === "pending" ? "" : key === "cmp" ? " · CMP" : key === "st" ? " · ST" : " · awaiting registration";
      return { title: `${pendingName}${what}`, summary: `${plural(rows.length, "case", "cases")} · longest in court first`, rows, daysHeader: inCourt, details: pastNote };
    }
    if (key.startsWith("age-")) {
      const i = Number(key.slice(4)) as 0 | 1 | 2;
      return {
        title: `${ageLabels[i]}, still pending`,
        summary: `${plural(sets.ages[i].length, "case", "cases")} of ${formatCount(end.pending)} pending · longest in court first`,
        rows: sets.ages[i],
        daysHeader: inCourt,
        details: pastNote,
      };
    }
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
  const opener = (key: OverviewList) => ({
    expanded: list.open === key,
    controls: listId,
    onOpen: (from: HTMLElement) => list.toggle(key, from),
  });

  const versus = (current: number, baseline: number | undefined, goodUp: boolean | null) => {
    if (reading.compare === "none") return null;
    if (baseline === undefined || name === null) {
      return <p className="text-body-compact text-muted-foreground">No earlier data to compare</p>;
    }
    const b = Math.round(baseline);
    const diff = current - b;
    if (!diff) {
      return (
        <p className="text-body-compact text-muted-foreground tabular-nums">
          Same as {name} ({formatCount(b)})
        </p>
      );
    }
    const share = b ? ` (${Math.round((Math.abs(diff) / b) * 100)}%)` : "";
    const tone = goodUp === null ? "flat" : diff > 0 === goodUp ? "good" : "bad";
    return (
      <p
        className={cn(
          "text-body-compact tabular-nums",
          tone === "good" ? "text-success-ink" : tone === "bad" ? "text-destructive-ink" : "text-muted-foreground",
        )}
      >
        <span aria-hidden>{diff > 0 ? "▲ " : "▼ "}</span>
        {formatCount(Math.abs(diff))}
        {share} {diff > 0 ? "more" : "fewer"} than {name}{" "}
        <span className="text-muted-foreground">({formatCount(b)})</span>
      </p>
    );
  };

  return (
    <section aria-labelledby="dash-overview" className={PANEL}>
      <PanelHeader id="dash-overview" title="Overview">
        {picker}
      </PanelHeader>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid min-w-0 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]">
          <div className="flex min-w-0 flex-col items-start gap-1 bg-card p-4 sm:px-6">
            <p className="text-body-compact font-semibold">Cases filed</p>
            <CountButton name="cases filed" className="text-title-l font-semibold" {...opener("filed")}>
              <CountUp value={now.filed} format={countText} />
            </CountButton>
            {versus(now.filed, base?.filed, null)}
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1 bg-card p-4 sm:px-6">
            <p className="text-body-compact font-semibold">Cases closed</p>
            <CountButton name="cases closed" className="text-title-l font-semibold" {...opener("closed")}>
              <CountUp value={now.closed} format={countText} />
            </CountButton>
            <p className="text-caption text-muted-foreground tabular-nums">
              {formatCount(disposed)} disposed
              {out.toLongPending ? ` · ${formatCount(out.toLongPending)} to long pending` : ""}
            </p>
            {versus(now.closed, base?.closed, true)}
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1 bg-card p-4 max-xl:sm:col-span-2 sm:px-6">
            <p className="text-body-compact font-semibold">{pendingName}</p>
            <CountButton name="pending" className="text-title-l font-semibold" {...opener("pending")}>
              <CountUp value={end.pending} format={countText} />
            </CountButton>
            <Badge
              variant={net < 0 ? "success" : net > 0 ? "destructive" : "secondary"}
              className="h-auto max-w-full justify-start py-0.5 text-left whitespace-normal tabular-nums"
            >
              <span aria-hidden>{net < 0 ? "▼" : net > 0 ? "▲" : "■"}</span>
              {net < 0
                ? `${formatCount(-net)} fewer than ${startWord}`
                : net > 0
                  ? `${formatCount(net)} more than ${startWord}`
                  : `Same as ${startWord}`}
            </Badge>
            <p className="flex flex-wrap gap-x-3 text-body-compact text-muted-foreground tabular-nums">
              {(
                [
                  ["cmp", "CMP", sets.cmp.length],
                  ["st", "ST", sets.st.length],
                  ["awaiting", "Awaiting registration", sets.awaitingRegistration.length],
                ] as const
              ).map(([key, label, n]) => (
                <span key={key} className="inline-flex items-center gap-1">
                  {label}
                  <CountButton name={`pending, ${label}`} className="font-semibold" {...opener(key)}>
                    {formatCount(n)}
                  </CountButton>
                </span>
              ))}
            </p>
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-3 bg-card p-4 sm:col-span-2 sm:px-6 xl:col-span-1">
            <p className="text-body-compact font-semibold">
              How long the {formatCount(end.pending)} pending cases have been in court
            </p>
            <SegmentBar
              label="Pending cases by when they were filed"
              controls={listId}
              className="h-3.5 [&>*:first-child]:rounded-l-sm [&>*:last-child]:rounded-r-sm"
              segments={ages.map((value, i) => ({
                key: String(i),
                value,
                className: AGE_SHADE[i],
                tip: `${ageLabels[i]}: ${plural(value, "case", "cases")} (${pct(value / Math.max(1, end.pending))})`,
                ...opener(`age-${i as 0 | 1 | 2}`),
              }))}
            />
            <ul className="flex flex-col text-body-compact tabular-nums">
              {ageLabels.map((label, i) => (
                <li key={label} className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-3 shrink-0 rounded-xs", AGE_SHADE[i])} />
                  <CountButton name={label.toLowerCase()} className="-my-1.5 font-semibold" {...opener(`age-${i as 0 | 1 | 2}`)}>
                    {formatCount(ages[i])}
                  </CountButton>
                  {label.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <BaselineBreakdown docket={docket} reading={reading} />
      </div>

      <StagePath docket={docket} reading={reading} opener={opener} />

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

/** What the comparison is made of: each baseline window, with its filed and closed counts. */
function BaselineBreakdown({ docket, reading }: { docket: CourtDocket; reading: PeriodReading }) {
  if (reading.compare === "none" || !reading.baseline.length) return null;
  const latest = docket.today;
  const windows = baselineWindows(docket, reading);
  const averaged = windows.length > 1;
  const avg = (key: "filed" | "closed") => windows.reduce((sum, w) => sum + w[key], 0) / windows.length;
  const one = (v: number) => (Number.isInteger(v) ? formatCount(v) : v.toFixed(1));
  return (
    <Collapsible className="flex min-w-0 flex-col gap-2">
      <CollapsibleTrigger asChild>
        <Button variant="link" className="group/base h-10 w-fit gap-1 px-0 text-body-compact">
          <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]/base:rotate-90 motion-reduce:transition-none" />
          {averaged ? `What the ${windows.length}-period average is made of` : "What the comparison is made of"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0">
        <div className="relative min-w-0 overflow-x-auto">
          <Table className="w-full border-separate border-spacing-0 text-body-compact">
            <caption className="sr-only">Comparison baseline, filed and closed in each window</caption>
            <TableHeader>
              <TableRow className={TABLE_HEAD_ROW}>
                <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
                  {averaged ? "Window" : "Compared with"}
                </TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Cases filed</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Cases closed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={tableBodyClass({ hover: false })}>
              <tr aria-hidden="true">
                <td colSpan={3} className="h-2 p-0" />
              </tr>
              {windows.map((w) => (
                <TableRow key={w.period.from} className={tableRowClass({ hover: false })}>
                  <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>{windowName(reading, w.period, latest)}</TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{formatCount(w.filed)}</TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{formatCount(w.closed)}</TableCell>
                </TableRow>
              ))}
              {averaged ? (
                <TableRow className={tableRowClass({ hover: false })}>
                  <TableCell className={cn(TABLE_CELL, "font-semibold")}>Average</TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right font-semibold tabular-nums")}>
                    {one(avg("filed"))}
                    <span className="font-normal text-muted-foreground"> · shown as {formatCount(Math.round(avg("filed")))}</span>
                  </TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right font-semibold tabular-nums")}>
                    {one(avg("closed"))}
                    <span className="font-normal text-muted-foreground"> · shown as {formatCount(Math.round(avg("closed")))}</span>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type Opener = (key: OverviewList) => {
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
      <h3 className="text-body font-semibold">
        Where the pending cases are{" "}
        <span className="text-body-compact font-normal text-muted-foreground">· select a stage for details</span>
      </h3>
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
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="relative block h-3 w-7 rounded-full border border-border bg-card">
              <span className="absolute top-1 left-1.5 size-1 rounded-full bg-primary" />
              <span className="absolute top-1 right-1.5 size-1 rounded-full bg-primary" />
            </span>
            Cases that moved to the next stage {during}
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
