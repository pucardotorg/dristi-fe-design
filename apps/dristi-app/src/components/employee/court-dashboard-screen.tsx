"use client";

import * as React from "react";
import { ChevronRightIcon } from "lucide-react";

import { useCourtText } from "@/components/court/court-provider";
import {
  BOX,
  CaseListBox,
  NeedsAttention,
  OwnerChip,
  PANEL,
  PanelHeader,
} from "@/components/employee/court-dashboard-attention";
import { DashboardDatePicker } from "@/components/employee/dashboard-date-picker";
import { useCourtDocket } from "@/components/employee/docket-table";
import { useCourtSession } from "@/components/employee/use-court-role";
import { useCourtToday } from "@/components/employee/use-court-today";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COURT_LIMITS,
  DAY_MS,
  monthKey,
  monthLabel,
  msToDay,
  STAGES,
  type CourtDocket,
  type StageKey,
} from "@/lib/employee/court-docket";
import {
  averageOver,
  defaultSelection,
  filedAndClosed,
  formatDay,
  formatDayShort,
  formatSpan,
  formatSpanFull,
  monthlyTrends,
  nextDates,
  outcomesIn,
  pendingAges,
  periodReading,
  positionOn,
  STAGE_OWNER,
  type CompareMode,
  type Outcomes,
  type Period,
  type PeriodReading,
  type Trend,
} from "@/lib/employee/court-flow";
import { formatCourtDay } from "@/lib/employee/hearings";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * `/employee` — the magistrate dashboard, built to the owner's Case Flow design, version
 * 3 (2026-10-19). Four panels on the work canvas:
 *
 * 1. **Overview** — the period under review (this month so far by default, set by the
 *    date picker in the panel), what was filed and closed against a chosen baseline, what
 *    is pending and how long it has been in court, and where the pending cases are along
 *    the six stages.
 * 2. **Needs attention** — today's checks, grouped by who can act.
 * 3. **Trends** — five measures month by month, over a range of the reader's choosing.
 * 4. **How cases were closed** — the outcome mix for the period, against the baseline.
 *
 * Needs attention and Trends read the court as of today, whatever the period: they are
 * for acting now. The Overview and the closures follow the picker (`periodReading`).
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

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
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

/** What the baseline is called in a sentence: "1–19 Sep", "September 2025", "the 6-month average". */
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
      <Closures docket={docket} reading={reading} />
    </div>
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
  const ages = pendingAges(docket, reading.selection);
  const ageLabels = [
    reading.kind === "day" ? "Filed today" : "Filed in this period",
    "Filed up to 6 months earlier",
    "Filed more than 6 months earlier",
  ];
  const line =
    reading.kind === "month"
      ? `${periodName(reading)} · month to date`
      : reading.kind === "span"
        ? `${periodName(reading)} · ${plural(reading.length, "day", "days")}`
        : periodName(reading);

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
      <PanelHeader id="dash-overview" title="Overview" line={line}>
        {picker}
      </PanelHeader>

      <div className="grid min-w-0 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]">
        <div className="flex min-w-0 flex-col gap-1 bg-card p-4 sm:px-6">
          <p className="text-body-compact font-semibold">Cases filed</p>
          <p className="text-title-l font-semibold tabular-nums">{formatCount(now.filed)}</p>
          {versus(now.filed, base?.filed, null)}
        </div>
        <div className="flex min-w-0 flex-col gap-1 bg-card p-4 sm:px-6">
          <p className="text-body-compact font-semibold">Cases closed</p>
          <p className="text-title-l font-semibold tabular-nums">{formatCount(now.closed)}</p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {formatCount(disposed)} disposed
            {out.toLongPending ? ` · ${formatCount(out.toLongPending)} to long pending` : ""}
          </p>
          {versus(now.closed, base?.closed, true)}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1 bg-card p-4 max-xl:sm:col-span-2 sm:px-6">
          <p className="text-body-compact font-semibold">{reading.live ? "Pending today" : `Pending on ${formatDayShort(to)}`}</p>
          <p className="text-title-l font-semibold tabular-nums">{formatCount(end.pending)}</p>
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
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-3 bg-card p-4 sm:col-span-2 sm:px-6 xl:col-span-1">
          <p className="text-body-compact font-semibold">
            How long the {formatCount(end.pending)} pending cases have been in court
          </p>
          <div
            role="img"
            aria-label={ageLabels.map((label, i) => `${label}: ${formatCount(ages[i])}`).join(", ")}
            className="flex h-3.5 gap-0.5"
          >
            {ages.map((value, i) =>
              value ? (
                <span
                  key={i}
                  className={cn("block h-full min-w-1 first:rounded-l-sm last:rounded-r-sm", AGE_SHADE[i])}
                  style={{ flex: value }}
                />
              ) : null,
            )}
          </div>
          <ul className="flex flex-col gap-1 text-body-compact tabular-nums">
            {ageLabels.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span aria-hidden className={cn("size-3 shrink-0 rounded-xs", AGE_SHADE[i])} />
                <strong className="font-semibold">{formatCount(ages[i])}</strong> {label.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <StagePath docket={docket} reading={reading} />
    </section>
  );
}

function StagePath({ docket, reading }: { docket: CourtDocket; reading: PeriodReading }) {
  const latest = docket.today;
  const end = positionOn(docket, reading.end);
  const before = reading.overdueSince === null ? null : positionOn(docket, reading.overdueSince);
  const next = nextDates(docket);
  const [open, setOpen] = React.useState<StageKey | null>(null);
  const most = Math.max(1, ...STAGES.map((s) => end.byStage[s.key].length));
  const since = reading.kind === "day" ? "in the last 30 days" : `since ${formatDayShort(reading.selection.from)}`;
  const listId = "dash-stage-cases";
  const openStage = STAGES.find((s) => s.key === open) ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-body font-semibold">Where the pending cases are</h3>
      <div className={cn(BOX, "flex flex-col pt-3")}>
        <div aria-hidden className="hidden grid-cols-6 px-2 pb-2 text-caption text-muted-foreground xl:grid">
          <span className="col-span-2 mx-1 border-b border-hairline px-3 pb-1.5">CMP · before cognizance</span>
          <span className="col-span-4 mx-1 border-b border-hairline px-3 pb-1.5">ST · after cognizance</span>
        </div>
        <ol className="grid min-w-0 xl:grid-cols-6 xl:px-2">
          {STAGES.map((stage, i) => {
            const n = end.byStage[stage.key].length;
            const late = end.overdue[stage.key].length;
            const limit = COURT_LIMITS.stages[stage.key];
            const then = before?.overdue[stage.key].length;
            const diff = then === undefined ? null : late - then;
            const usual = stage.key === "registration" ? null : next.usual[stage.key];
            return (
              <li
                key={stage.key}
                className={cn(
                  "relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] content-start items-start gap-x-3 gap-y-1.5 px-4 py-3 xl:flex xl:flex-col xl:py-2",
                  i > 0 && "border-hairline max-xl:border-t xl:border-l",
                )}
              >
                {i > 0 ? (
                  <ChevronRightIcon
                    aria-hidden
                    className="absolute top-3 -left-2 hidden size-4 bg-card text-muted-foreground xl:block"
                  />
                ) : null}
                <span className="text-body font-semibold">{stage.label}</span>
                <span className="col-start-1 text-caption text-muted-foreground xl:min-h-12">
                  {STAGE_DESCRIPTION[stage.key]}
                </span>
                <span className="col-start-2 row-span-2 row-start-1 text-right text-title font-semibold tabular-nums xl:text-left">
                  {formatCount(n)}
                </span>
                <span
                  aria-hidden
                  className="col-span-2 flex h-2.5 gap-0.5"
                  style={{ width: `${Math.max(4, (n / most) * 100)}%` }}
                >
                  {n - late > 0 ? <span className="block h-full bg-brand-accent" style={{ flex: n - late }} /> : null}
                  {late ? <span className="block h-full rounded-r-sm bg-warning-ink" style={{ flex: late }} /> : null}
                </span>
                <span className="col-span-2">
                  {late ? (
                    <button
                      type="button"
                      aria-expanded={open === stage.key}
                      aria-controls={listId}
                      data-stage-trigger={stage.key}
                      onClick={() => setOpen((current) => (current === stage.key ? null : stage.key))}
                      className="-my-2 inline-flex min-h-10 cursor-pointer items-center rounded-sm text-left text-body-compact text-warning-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus-ring"
                    >
                      <span>
                        <strong className="font-semibold underline underline-offset-4">{formatCount(late)}</strong> waiting
                        over {limit} days
                        <span className="sr-only">
                          {" "}
                          at {stage.label}, {open === stage.key ? "hide" : "show"} the cases
                        </span>
                      </span>
                    </button>
                  ) : (
                    <span className="text-body-compact text-success-ink">None waiting over {limit} days</span>
                  )}
                </span>
                {diff !== null ? (
                  <span
                    className={cn(
                      "col-span-2 text-caption tabular-nums",
                      diff > 0 ? "text-destructive-ink" : diff < 0 ? "text-success-ink" : "text-muted-foreground",
                    )}
                  >
                    {diff ? (
                      <>
                        <span aria-hidden>{diff > 0 ? "▲ " : "▼ "}</span>
                        <span className="sr-only">{diff > 0 ? "Up " : "Down "}</span>
                        {formatCount(Math.abs(diff))} {since}
                      </>
                    ) : (
                      `No change ${since}`
                    )}
                  </span>
                ) : null}
                {reading.live && usual !== null ? (
                  <span className="col-span-2 text-caption text-muted-foreground">
                    Next hearing usually within {plural(usual, "day", "days")}
                  </span>
                ) : null}
                <span className="col-span-2">
                  <OwnerChip owner={STAGE_OWNER[stage.key]} />
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-hairline px-4 py-3 text-caption text-muted-foreground sm:px-6">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-3.5 rounded-xs bg-brand-accent" />
            Within the stage’s review period
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-3.5 rounded-xs bg-warning-ink" />
            Waiting longer than the review period
          </span>
          <span className="tabular-nums">
            Not counted above: {plural(end.longPending, "case", "cases")} on the long pending register, where the
            accused could not be produced.
          </span>
        </p>
      </div>
      <div id={listId} className="min-w-0 empty:hidden">
        {openStage ? (
          <CaseListBox
            key={openStage.key}
            id={`dash-stage-${openStage.key}`}
            title={`${openStage.label} over ${COURT_LIMITS.stages[openStage.key]} days${reading.live ? "" : ` · on ${formatDayShort(reading.end)}`}`}
            summary={`${plural(end.overdue[openStage.key].length, "case", "cases")} · longest first`}
            details={
              reading.live
                ? undefined
                : [
                    `Days are counted to ${formatDay(reading.end)}. Stage and next hearing are as they stand on ${formatDay(latest)}.`,
                  ]
            }
            rows={end.overdue[openStage.key]}
            daysHeader="Days in stage"
            onClose={() => {
              const key = open;
              setOpen(null);
              document.querySelector<HTMLElement>(`[data-stage-trigger="${key}"]`)?.focus();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- trends */

type TrendRange = "6" | "12" | "all" | "custom";

function trendValue(trend: Trend, value: number): string {
  switch (trend.unit) {
    case "count":
      return formatCount(Math.round(value));
    case "percent":
      return `${Math.round(value)}%`;
    case "days":
      return `${formatCount(Math.round(value))} days`;
    case "days-decimal":
      return `${value.toFixed(1)} days`;
  }
}

const VERDICT: Record<NonNullable<Trend["verdict"]>, { label: string; variant: "success" | "destructive" | "secondary" }> = {
  better: { label: "Improving", variant: "success" },
  worse: { label: "Worsening", variant: "destructive" },
  steady: { label: "Steady", variant: "secondary" },
};

function Trends({ docket }: { docket: CourtDocket }) {
  const latest = docket.today;
  const last = monthKey(latest);
  const first = monthKey(docket.start);
  const [mode, setMode] = React.useState<TrendRange>("12");
  const [custom, setCustom] = React.useState<{ from: number; to: number }>({
    from: Math.max(first, last - 11),
    to: last,
  });
  const range =
    mode === "6"
      ? { from: Math.max(first, last - 5), to: last }
      : mode === "12"
        ? { from: Math.max(first, last - 11), to: last }
        : mode === "all"
          ? { from: first, to: last }
          : { from: Math.min(custom.from, custom.to), to: Math.max(custom.from, custom.to) };
  const trends = monthlyTrends(docket, latest, range);
  const months = range.to - range.from + 1;
  const name = (k: number) => (k === last ? `${monthLong(k)} (to ${formatDayShort(latest)})` : monthLong(k));
  const options = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <section aria-labelledby="dash-trends" className={PANEL}>
      <PanelHeader
        id="dash-trends"
        title="Trends"
        line={`Month by month, ${name(range.from)} to ${name(range.to)}`}
        note={
          months < 4
            ? "Pick at least 4 months to see whether a measure is improving."
            : "The tag on each chart compares the latest month with the average of the three before it."
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="dash-trend-range" className="text-body-compact font-normal text-muted-foreground">
              Show
            </Label>
            <Select value={mode} onValueChange={(next) => setMode(next as TrendRange)}>
              <SelectTrigger id="dash-trend-range" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="all">All months on record</SelectItem>
                <SelectItem value="custom">Custom range…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="dash-trend-from" className="text-body-compact font-normal text-muted-foreground">
                From
              </Label>
              <Select value={String(custom.from)} onValueChange={(v) => setCustom((c) => ({ ...c, from: Number(v) }))}>
                <SelectTrigger id="dash-trend-from" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((k) => (
                    <SelectItem key={k} value={String(k)}>
                      {monthLong(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label htmlFor="dash-trend-to" className="text-body-compact font-normal text-muted-foreground">
                to
              </Label>
              <Select value={String(custom.to)} onValueChange={(v) => setCustom((c) => ({ ...c, to: Number(v) }))}>
                <SelectTrigger id="dash-trend-to" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((k) => (
                    <SelectItem key={k} value={String(k)}>
                      {monthLong(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </PanelHeader>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {trends.map((trend, i) => (
          <article
            key={trend.id}
            aria-labelledby={`dash-trend-${trend.id}`}
            className={cn(BOX, "flex flex-col gap-2 p-4 sm:px-6", i === 0 && "md:col-span-2")}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id={`dash-trend-${trend.id}`} className="text-body font-semibold">
                {trend.label}
              </h3>
              {trend.verdict ? (
                <Badge variant={VERDICT[trend.verdict].variant}>{VERDICT[trend.verdict].label}</Badge>
              ) : null}
            </div>
            <p className="text-title font-semibold tabular-nums">
              {trend.last ? trendValue(trend, trend.last.value!) : "–"}
            </p>
            <Sparkline trend={trend} tall={i === 0} />
            <TrendAxis trend={trend} />
            {trend.note ? <p className="text-caption text-muted-foreground">{trend.note}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function pointName(p: Trend["points"][number]): string {
  return p.partial ? `1–${parts(p.at).day} ${monthLabel(p.month).slice(0, 3)}` : monthLabel(p.month);
}

function TrendAxis({ trend }: { trend: Trend }) {
  const L = trend.points.length;
  if (!L) return null;
  const at = L > 2 ? [0, Math.floor((L - 1) / 2), L - 1] : L === 2 ? [0, 1] : [0];
  return (
    <div aria-hidden className="flex justify-between text-caption text-muted-foreground tabular-nums">
      {at.map((i) => (
        <span key={i}>{pointName(trend.points[i])}</span>
      ))}
    </div>
  );
}

/**
 * A measure's months as a line over a filled area, its last month marked, on a faint
 * baseline — and a dashed reference where the measure has one (100% clearance). The
 * drawing stretches to the card, so the end point and the reference label are placed over
 * it rather than drawn in it. The months are the figure's text alternative.
 */
function Sparkline({ trend, tall }: { trend: Trend; tall: boolean }) {
  const real = trend.points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null);
  if (real.length < 2) return <p className="text-caption text-muted-foreground">Not enough months yet.</p>;
  const W = 480;
  const H = 110;
  const P = 6;
  const values = real.map((p) => p.value!).concat(trend.reference !== null ? [trend.reference] : []);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  const N = trend.points.length;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, N - 1);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const line = real.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.value!).toFixed(1)}`).join("");
  const end = real[real.length - 1];
  const area = `${line}L${x(end.i).toFixed(1)},${H - P}L${x(real[0].i).toFixed(1)},${H - P}Z`;
  const label = `${trend.label}, month by month: ${trend.points
    .map((p) => `${pointName(p)} ${p.value === null ? "no data" : trendValue(trend, p.value)}`)
    .join("; ")}`;
  const percent = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div role="img" aria-label={label} className={cn("relative w-full", tall ? "h-36" : "h-28")}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="stroke-hairline" vectorEffect="non-scaling-stroke" />
        {trend.reference !== null ? (
          <line
            x1={P}
            x2={W - P}
            y1={y(trend.reference)}
            y2={y(trend.reference)}
            className="stroke-muted-foreground"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path d={area} className="fill-brand-muted" />
        <path d={line} className="fill-none stroke-chart-1" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {trend.reference !== null ? (
        <span
          aria-hidden
          className="absolute left-1.5 -translate-y-full text-caption text-muted-foreground"
          style={{ top: percent(y(trend.reference), H) }}
        >
          {trendValue(trend, trend.reference)}
        </span>
      ) : null}
      <span
        aria-hidden
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
        style={{ left: percent(x(end.i), W), top: percent(y(end.value!), H) }}
      />
    </div>
  );
}

/* --------------------------------------------------- how cases were closed */

type OutcomeKey = "Convicted" | "Acquitted" | "Settled" | "early" | "toLongPending";

/**
 * Five outcomes in the DS categorical chart hues — "different series", never status.
 * Labels on the segments take whichever ink reaches 4.5:1 on that hue: the solid-
 * foreground on the first three in light mode and on all five in dark, the foreground on
 * the amber and pink in light.
 */
const OUTCOMES: {
  key: OutcomeKey;
  name: string;
  short: string;
  group?: string;
  fill: string;
  ink: string;
}[] = [
  { key: "Convicted", name: "Convicted", short: "Convicted", group: "Decided at trial", fill: "bg-chart-1", ink: "text-primary-foreground" },
  { key: "Acquitted", name: "Acquitted", short: "Acquitted", group: "Decided at trial", fill: "bg-chart-2", ink: "text-primary-foreground" },
  { key: "Settled", name: "Settled or compounded", short: "Settled", fill: "bg-chart-3", ink: "text-primary-foreground" },
  { key: "early", name: "Ended early", short: "Ended early", fill: "bg-chart-4", ink: "text-foreground dark:text-primary-foreground" },
  {
    key: "toLongPending",
    name: "To long pending register",
    short: "Long pending",
    fill: "bg-chart-5",
    ink: "text-foreground dark:text-primary-foreground",
  },
];

const totalOf = (o: Outcomes) => OUTCOMES.reduce((sum, x) => sum + o[x.key], 0);

function OutcomeBar({ outcomes, label, base }: { outcomes: Outcomes; label: string; base?: boolean }) {
  const total = totalOf(outcomes);
  return (
    <div
      role="img"
      aria-label={`${label}: ${OUTCOMES.map((x) => `${x.name} ${Math.round(outcomes[x.key])}`).join(", ")}`}
      className={cn("flex min-w-0 gap-0.5", base ? "h-4" : "h-8")}
    >
      {total ? (
        OUTCOMES.filter((x) => outcomes[x.key] > 0).map((x) => {
          const share = outcomes[x.key] / total;
          return (
            <span
              key={x.key}
              className={cn(
                "flex h-full min-w-1 items-center justify-center overflow-hidden first:rounded-l-md last:rounded-r-md",
                x.fill,
              )}
              style={{ flex: outcomes[x.key] }}
            >
              {base ? null : share >= 0.16 ? (
                <span aria-hidden className={cn("truncate px-1.5 text-caption font-semibold", x.ink)}>
                  {x.short} {pct(share)}
                </span>
              ) : share >= 0.06 ? (
                <span aria-hidden className={cn("truncate px-1.5 text-caption font-semibold", x.ink)}>
                  {pct(share)}
                </span>
              ) : null}
            </span>
          );
        })
      ) : (
        <span className="text-body-compact text-muted-foreground">No closures</span>
      )}
    </div>
  );
}

function Closures({ docket, reading }: { docket: CourtDocket; reading: PeriodReading }) {
  const latest = docket.today;
  const now = outcomesIn(docket, reading.selection);
  const base = averageOver(reading.baseline, (p) => outcomesIn(docket, p));
  const label = baselineName(reading, latest, true);
  const averaged = reading.baseline.length > 1;
  const total = totalOf(now);
  const baseTotal = base ? totalOf(base) : 0;
  const period = periodName(reading);
  const judged = now.Convicted + now.Acquitted;
  const baseJudged = base ? base.Convicted + base.Acquitted : 0;
  const against = label ? (averaged ? `the ${label.toLowerCase()}` : label) : "";

  return (
    <section aria-labelledby="dash-closures" className={PANEL}>
      <PanelHeader
        id="dash-closures"
        title="How cases were closed"
        line={`${period} · ${plural(total, "case", "cases")} closed`}
        note="Follows the period and comparison chosen in the Overview."
      />
      <div className={cn(BOX, "flex flex-col gap-4 p-4 sm:px-6")}>
        <div className="grid min-w-0 items-center gap-x-4 gap-y-1.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col">
            <span className="text-body-compact font-semibold">{period}</span>
            <span className="text-caption text-muted-foreground tabular-nums">{formatCount(total)} closed</span>
          </div>
          <OutcomeBar outcomes={now} label={period} />
          {base && label ? (
            <>
              <div className="flex min-w-0 flex-col max-sm:mt-2">
                <span className="text-body-compact text-muted-foreground">{label}</span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {formatCount(Math.round(baseTotal))} closed{averaged ? " on average" : ""}
                </span>
              </div>
              <OutcomeBar outcomes={base} label={label} base />
            </>
          ) : null}
        </div>
        <ul className="grid gap-x-4 gap-y-3 border-t border-hairline pt-4 sm:grid-cols-2 xl:grid-cols-5">
          {OUTCOMES.map((x) => {
            const share = total ? now[x.key] / total : 0;
            const change = base && baseTotal && total ? Math.round((share - base[x.key] / baseTotal) * 100) : null;
            return (
              <li key={x.key} className="grid grid-cols-[0.75rem_minmax(0,1fr)] content-start gap-x-2 gap-y-0.5">
                <span aria-hidden className={cn("mt-1 size-3 rounded-xs", x.fill)} />
                <span className="text-body-compact font-semibold">
                  {x.name}
                  {x.group ? <span className="block text-caption font-normal text-muted-foreground">{x.group}</span> : null}
                  {x.key === "early" ? (
                    <span className="block text-caption font-normal text-muted-foreground tabular-nums">
                      {formatCount(now.Withdrawn)} withdrawn · {formatCount(now.Dismissed)} dismissed ·{" "}
                      {formatCount(now.Returned)} returned
                    </span>
                  ) : null}
                </span>
                <span className="col-start-2 text-caption text-muted-foreground tabular-nums">
                  <strong className="mr-1 text-body font-semibold text-foreground">{formatCount(now[x.key])}</strong>
                  {total ? pct(share) : ""}
                </span>
                {change !== null ? (
                  <span className="col-start-2 text-caption text-muted-foreground tabular-nums">
                    {change ? (
                      <>
                        <span aria-hidden>{change > 0 ? "▲ " : "▼ "}</span>
                        <span className="sr-only">{change > 0 ? "Up " : "Down "}</span>
                        {plural(Math.abs(change), "pt", "pts")}
                      </>
                    ) : (
                      "±0 pts"
                    )}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {base && label ? (
          <p className="text-caption text-muted-foreground">
            ▲ ▼ show the change in each outcome’s share of closures, in percentage points, against {against}.
          </p>
        ) : null}
      </div>
      {judged ? (
        <p className="text-body-compact tabular-nums">
          Conviction rate: <strong className="font-semibold">{pct(now.Convicted / judged)}</strong> of{" "}
          {plural(judged, "judgement", "judgements")}
          {baseJudged && base ? (
            <span className="text-muted-foreground">
              {" "}
              · {pct(base.Convicted / baseJudged)} in {averaged ? "the average" : label}
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
