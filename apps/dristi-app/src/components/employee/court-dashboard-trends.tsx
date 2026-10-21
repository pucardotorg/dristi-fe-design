"use client";

import * as React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { STAGE_SLIDE } from "@/components/chrome/motion";
import { BOX, PANEL, PanelHeader } from "@/components/employee/court-dashboard-attention";
import { CountUp, useReducedMotion } from "@/components/employee/court-dashboard-motion";
import { DashboardDatePicker } from "@/components/employee/dashboard-date-picker";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { monthShortLabel, type CourtDocket } from "@/lib/employee/court-docket";
import {
  formatDayShort,
  monthlyTrends,
  trendBreakdown,
  trendDetail,
  trendMonths,
  trendOpening,
  trendPresets,
  type Period,
  type Trend,
  type TrendId,
  type TrendPoint,
} from "@/lib/employee/court-flow";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * Trends on the magistrate dashboard (Case Flow v4): one measure at a time, in detail.
 *
 * A rail of the five measures (a tablist: arrow keys, Home and End), each with its latest
 * value, a mini line and its verdict; the selected measure opens beside it with its note,
 * its value against the month before, a one-line story, a full chart and four facts. The
 * chart is the DS chart primitive: axes, the 100% line for clearance, the 3-month average
 * the verdict uses, the best and worst months, the unfinished month dashed, and a
 * crosshair whose tooltip breaks the month down — on hover, on touch, and from the
 * keyboard (focus the chart, then the arrow keys).
 *
 * The months come from the Trends date picker; Trends always reads up to today.
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
const monthLong = (key: number) => `${MONTHS_LONG[key % 12]} ${Math.floor(key / 12)}`;

export function trendValue(trend: Trend, value: number): string {
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

/** A difference in the measure's own terms: clearance moves in points. */
function trendDiff(trend: Trend, value: number): string {
  if (trend.unit === "percent") {
    const n = Math.round(value);
    return `${n} ${n === 1 ? "point" : "points"}`;
  }
  return trendValue(trend, value);
}

/** "1–19 Oct 2026" for the unfinished month, "November 2025" otherwise. */
function pointLong(p: TrendPoint): string {
  return p.partial
    ? `1–${new Date(p.at).getUTCDate()} ${monthShortLabel(p.month)} ${Math.floor(p.month / 12)}`
    : monthLong(p.month);
}

/** "Sep 2026", or "Oct (so far)". */
function pointShort(p: TrendPoint): string {
  return p.partial ? `${monthShortLabel(p.month)} (so far)` : `${monthShortLabel(p.month)} ${Math.floor(p.month / 12)}`;
}

/** The chart's axis name for a month: unique across the range. */
function axisName(p: TrendPoint, i: number): string {
  const yy = String(Math.floor(p.month / 12)).slice(2);
  /* A month not over carries its year so it stays unique; the key under the chart says it
     is not over. A long "so far" label here crowded out the month before it. */
  return i === 0 || p.partial || p.month % 12 === 0 ? `${monthShortLabel(p.month)} ’${yy}` : monthShortLabel(p.month);
}

const VERDICT: Record<NonNullable<Trend["verdict"]>, { label: string; variant: "success" | "destructive" | "secondary"; ink: string }> = {
  better: { label: "Improving", variant: "success", ink: "text-success-ink" },
  worse: { label: "Worsening", variant: "destructive", ink: "text-destructive-ink" },
  steady: { label: "Steady", variant: "secondary", ink: "text-muted-foreground" },
};

const NOTE: Record<TrendId, string> = {
  pending: "Cases still open at the end of each month",
  clearance: "Cases disposed for every 100 filed. Above 100% the backlog shrinks.",
  overdue: "Cases past their stage’s review point, all stages together",
  disposal: "Median days from filing to disposal, for cases disposed that month",
  serve: "Average days from paying the fee to delivery, for summons delivered that month",
};

export function Trends({ docket }: { docket: CourtDocket }) {
  const opening = trendOpening(docket);
  /* `null` until the reader picks, so the default follows the court's today. */
  const [picked, setPicked] = React.useState<Period | null>(null);
  const period = picked ?? opening;
  /* Charts are month by month: a picked range covers its months whole, and the last
     month is read up to the range's last day. */
  const range = trendMonths(period);
  const trends = monthlyTrends(docket, period.to, range);
  const months = range.to - range.from + 1;
  const monthSpan = (p: Period) => {
    const r = trendMonths(p);
    return r.from === r.to ? `charts show ${monthLong(r.from)}` : `charts show ${monthLong(r.from)} to ${monthLong(r.to)}`;
  };
  const [selected, setSelected] = React.useState<TrendId>("pending");
  const trend = trends.find((t) => t.id === selected) ?? trends[0];
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const lastMonth = trend.points.at(-1);
  const toName = (k: number) =>
    lastMonth && k === lastMonth.month && lastMonth.partial
      ? `${monthLong(k)} (to ${formatDayShort(lastMonth.at)})`
      : monthLong(k);

  const move = (to: number) => {
    const i = (to + trends.length) % trends.length;
    setSelected(trends[i].id);
    tabs.current[i]?.focus();
  };

  return (
    <section aria-labelledby="dash-trends" className={PANEL}>
      <PanelHeader
        id="dash-trends"
        title="Trends"
        line={`How the court is moving, month by month · ${toName(range.from)} to ${toName(range.to)}`}
        note={months < 4 ? "Pick at least 4 months to see whether a measure is improving." : undefined}
      >
        <DashboardDatePicker
          docket={docket}
          value={period}
          defaultValue={opening}
          defaultLabel="Last 12 months"
          presets={trendPresets(docket)}
          idPrefix="dash-trend-picker"
          dayNote="charts show that month, up to that day"
          rangeNote={monthSpan}
          onChange={(next) => setPicked(next.from === opening.from && next.to === opening.to ? null : next)}
        />
      </PanelHeader>

      <div className={cn(BOX, "grid items-start gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[16rem_minmax(0,1fr)]")}>
        <div
          role="tablist"
          aria-label="Measures"
          aria-orientation="vertical"
          className="flex min-w-0 self-start overflow-x-auto rounded-lg border border-hairline bg-muted lg:sticky lg:top-6 lg:flex-col lg:overflow-hidden"
        >
          {trends.map((t, i) => {
            const on = t.id === trend.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`dash-trend-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="dash-trend-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setSelected(t.id)}
                onKeyDown={(event) => {
                  const step: Record<string, number> = {
                    ArrowDown: i + 1,
                    ArrowRight: i + 1,
                    ArrowUp: i - 1,
                    ArrowLeft: i - 1,
                    Home: 0,
                    End: trends.length - 1,
                  };
                  if (event.key in step) {
                    event.preventDefault();
                    move(step[event.key]);
                  }
                }}
                className={cn(
                  "relative grid min-w-44 shrink-0 cursor-pointer gap-0.5 border-hairline px-4 py-3 text-left outline-none transition-colors not-last:border-b hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:ring-inset motion-reduce:transition-none max-lg:not-last:border-r max-lg:not-last:border-b-0",
                  "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:transition-transform before:duration-300 motion-reduce:before:transition-none max-lg:before:inset-x-0 max-lg:before:top-auto max-lg:before:bottom-0 max-lg:before:h-0.5 max-lg:before:w-auto",
                  on ? "bg-card before:scale-100" : "before:scale-0",
                )}
              >
                <span className={cn("text-body-compact", on ? "font-semibold" : "text-muted-foreground")}>{t.label}</span>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-title-s font-semibold tabular-nums">
                    {t.last ? trendValue(t, t.last.value!) : "–"}
                  </span>
                  <MiniLine trend={t} on={on} />
                </span>
                <span className={cn("text-caption", t.verdict ? VERDICT[t.verdict].ink : "text-muted-foreground")}>
                  {t.verdict ? VERDICT[t.verdict].label : "Too few months"}
                </span>
              </button>
            );
          })}
        </div>
        <TrendPanel key={`${trend.id}:${range.from}:${range.to}`} docket={docket} trend={trend} months={months} />
      </div>
    </section>
  );
}

function MiniLine({ trend, on }: { trend: Trend; on: boolean }) {
  const real = trend.points.map((p, i) => ({ p, i })).filter((x) => x.p.value !== null);
  if (real.length < 2) return null;
  const W = 120;
  const H = 32;
  const P = 3;
  const values = real.map((x) => x.p.value!);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const N = trend.points.length;
  const d = real
    .map(({ p, i }, j) => {
      const x = P + (i * (W - 2 * P)) / Math.max(1, N - 1);
      const y = H - P - ((p.value! - lo) / (hi - lo)) * (H - 2 * P);
      return `${j ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="h-6 w-20 shrink-0">
      <path
        d={d}
        className={cn("fill-none", on ? "stroke-chart-1" : "stroke-muted-foreground")}
        strokeWidth={on ? 2 : 1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || 1;
  const rough = span / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= rough) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) {
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

type ChartRow = {
  name: string;
  point: TrendPoint;
  value: number | null;
  solid: number | null;
  tail: number | null;
};

function TrendPanel({ docket, trend, months }: { docket: CourtDocket; trend: Trend; months: number }) {
  const reduced = useReducedMotion();
  const detail = trendDetail(trend);
  const last = trend.last;
  const first = detail.first;
  const prev = detail.previous;
  const good = (v: number) => (trend.better === "up" ? v : -v);
  const fmt = (v: number) => trendValue(trend, v);

  const rel = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : 0);
  const pct = (v: number) => `${Math.round(Math.abs(v) * 100)}%`;
  const story =
    !first || !last || first === last
      ? "Not enough months in this range to show a trend."
      : null;
  const rangeChange =
    first && last && first !== last
      ? trend.unit === "percent"
        ? `${last.value! >= first.value! ? "+" : "−"}${trendDiff(trend, Math.abs(last.value! - first.value!))}`
        : `${last.value! >= first.value! ? "+" : "−"}${pct(rel(last.value!, first.value!))}`
      : "–";

  const real = trend.points.filter((p) => p.value !== null);
  const partialLast = Boolean(last?.partial);
  const rows: ChartRow[] = trend.points.map((p, i) => {
    const isLast = p === last;
    const isPrev = p === prev;
    return {
      name: axisName(p, i),
      point: p,
      value: p.value,
      solid: partialLast && isLast ? null : p.value,
      tail: partialLast && (isLast || isPrev) ? p.value : null,
    };
  });
  const nameOf = (p: TrendPoint | null) => (p ? rows.find((r) => r.point === p)?.name : undefined);
  const values = real.map((p) => p.value!).concat(trend.reference !== null ? [trend.reference] : []);
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 1;
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const pad = (hi - lo) * 0.15;
  const ticks = niceTicks(Math.max(trend.unit === "percent" ? 0 : -Infinity, lo - pad), hi + pad);
  const base = detail.baseMonths;
  const config = { value: { label: trend.label, color: "var(--color-chart-1)" } } satisfies ChartConfig;
  const tick = (v: number) => (trend.unit === "percent" ? `${v}%` : formatCount(v));

  return (
    <div
      id="dash-trend-panel"
      role="tabpanel"
      aria-labelledby={`dash-trend-tab-${trend.id}`}
      className={cn(STAGE_SLIDE.arrive, "flex min-w-0 flex-col gap-3")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-body font-semibold">{trend.label}</h3>
          <p className="text-body-compact text-muted-foreground">{NOTE[trend.id]}</p>
        </div>
        {trend.verdict ? <Badge variant={VERDICT[trend.verdict].variant}>{VERDICT[trend.verdict].label}</Badge> : null}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {last ? <CountUp value={last.value!} format={fmt} className="text-title-l font-semibold tabular-nums" /> : "–"}
        {last ? <span className="text-body-compact text-muted-foreground">{pointLong(last)}</span> : null}
        {last && prev ? (
          <ChangeText trend={trend} change={last.value! - prev.value!} against={pointShort(prev)} good={good} />
        ) : null}
      </p>
      <p className="max-w-prose text-body-compact">
        {months < 4 ? "Pick at least 4 months to see whether this is improving. " : ""}
        {story ?? (
          <>
            {trend.label} went from <strong className="font-semibold">{fmt(first!.value!)}</strong> in {pointLong(first!)}{" "}
            to <strong className="font-semibold">{fmt(last!.value!)}</strong> in {pointLong(last!)},{" "}
            {last!.value! > first!.value! ? "up" : last!.value! < first!.value! ? "down" : "unchanged"}
            {last!.value! !== first!.value!
              ? ` ${trend.unit === "percent" ? trendDiff(trend, Math.abs(last!.value! - first!.value!)) : pct(rel(last!.value!, first!.value!))}`
              : ""}{" "}
            over the range. {trend.better === "up" ? "Higher" : "Lower"} is better.
          </>
        )}
      </p>

      {real.length >= 2 ? (
        <figure className="flex min-w-0 flex-col gap-1">
          <ChartContainer config={config} className="aspect-auto h-44 w-full">
            <ComposedChart
              accessibilityLayer
              data={rows}
              margin={{ top: 20, right: 16, left: 0, bottom: 0 }}
              title={`${trend.label} by month. Focus the chart and use the left and right arrow keys to read each month.`}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
              <YAxis
                width={52}
                tickLine={false}
                axisLine={false}
                ticks={ticks}
                domain={[ticks[0], ticks[ticks.length - 1]]}
                tickFormatter={tick}
              />
              {trend.reference !== null ? (
                <ReferenceLine
                  y={trend.reference}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="2 4"
                />
              ) : null}
              <Area
                dataKey="value"
                type="linear"
                stroke="none"
                fill="var(--color-brand-muted)"
                fillOpacity={1}
                isAnimationActive={false}
                connectNulls
                activeDot={false}
              />
              {trend.base !== null && base.length === 3 ? (
                <ReferenceLine
                  segment={[
                    { x: nameOf(base[0]), y: trend.base },
                    { x: nameOf(base[2]), y: trend.base },
                  ]}
                  stroke="var(--color-muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              ) : null}
              <Line
                dataKey="solid"
                type="linear"
                stroke="var(--color-value)"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 5, fill: "var(--color-value)", stroke: "var(--color-card)", strokeWidth: 2 }}
                isAnimationActive={!reduced}
                animationDuration={900}
              />
              {partialLast ? (
                <Line
                  dataKey="tail"
                  type="linear"
                  stroke="var(--color-value)"
                  strokeWidth={2.25}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ) : null}
              {detail.best && detail.best !== last ? (
                <ReferenceDot
                  x={nameOf(detail.best)}
                  y={detail.best.value!}
                  r={4}
                  fill="var(--color-card)"
                  stroke="var(--color-foreground)"
                  strokeWidth={1.5}
                />
              ) : null}
              {detail.worst && detail.worst !== last && detail.worst !== detail.best ? (
                <ReferenceDot
                  x={nameOf(detail.worst)}
                  y={detail.worst.value!}
                  r={4}
                  shape={WorstMark}
                />
              ) : null}
              {last ? (
                <ReferenceDot
                  x={nameOf(last)}
                  y={last.value!}
                  r={5}
                  fill="var(--color-value)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              ) : null}
              <ChartTooltip
                cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
                content={<MonthTip docket={docket} trend={trend} rows={rows} good={good} />}
              />
            </ComposedChart>
          </ChartContainer>
          {/* What the marks mean, said once under the chart. Labels drawn inside the plot
              collided whenever the reference, the average and the best month sat close
              together, as they do for clearance (owner, 2026-10-19). */}
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-caption text-muted-foreground tabular-nums">
            {trend.reference !== null ? (
              <KeyItem mark="reference">{trend.reference}%: filings and disposals level</KeyItem>
            ) : null}
            {trend.base !== null && base.length === 3 ? (
              <KeyItem mark="average">
                3-month average, {pointShort(base[0])} to {pointShort(base[2])}: {fmt(trend.base)}
              </KeyItem>
            ) : null}
            {detail.best && detail.best !== last ? (
              <KeyItem mark="best">
                Best: {pointLong(detail.best)}, {fmt(detail.best.value!)}
              </KeyItem>
            ) : null}
            {detail.worst && detail.worst !== last && detail.worst !== detail.best ? (
              <KeyItem mark="worst">
                Worst: {pointLong(detail.worst)}, {fmt(detail.worst.value!)}
              </KeyItem>
            ) : null}
            {last?.partial ? <KeyItem mark="partial">{pointLong(last)}: month not over yet</KeyItem> : null}
          </ul>
          <figcaption className="text-caption text-muted-foreground">
            Move along the chart, tap it, or focus it and use the arrow keys to read each month and what went into it.
          </figcaption>
        </figure>
      ) : (
        <p className="text-body-compact text-muted-foreground">Not enough months in this range to draw a line.</p>
      )}

      {real.length ? (
        <dl className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Compared with"
            value={trend.base !== null ? fmt(trend.base) : "–"}
            sub={trend.base !== null ? "average of the 3 months before" : "needs 4 months"}
          />
          <Stat label="Best month" value={detail.best ? fmt(detail.best.value!) : "–"} sub={detail.best ? pointLong(detail.best) : ""} />
          <Stat label="Worst month" value={detail.worst ? fmt(detail.worst.value!) : "–"} sub={detail.worst ? pointLong(detail.worst) : ""} />
          <Stat label="Change over the range" value={rangeChange} sub={first ? `since ${pointLong(first)}` : ""} />
        </dl>
      ) : null}
    </div>
  );
}

/** The worst month's mark: a square, so it reads apart from the best month's circle. */
function WorstMark({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return <g />;
  return (
    <rect
      x={cx - 4}
      y={cy - 4}
      width={8}
      height={8}
      fill="var(--color-card)"
      stroke="var(--color-foreground)"
      strokeWidth={1.5}
    />
  );
}

type KeyMark = "reference" | "average" | "best" | "worst" | "partial";

/** One entry in the chart's key: the mark as drawn on the chart, then what it means. */
function KeyItem({ mark, children }: { mark: KeyMark; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <svg aria-hidden width="20" height="10" viewBox="0 0 20 10" className="shrink-0 overflow-visible">
        {mark === "reference" ? (
          <line x1="0" x2="20" y1="5" y2="5" stroke="var(--color-muted-foreground)" strokeDasharray="2 4" />
        ) : mark === "average" ? (
          <line x1="0" x2="20" y1="5" y2="5" stroke="var(--color-muted-foreground)" strokeWidth="1.5" strokeDasharray="6 4" />
        ) : mark === "partial" ? (
          <line x1="0" x2="20" y1="5" y2="5" stroke="var(--color-chart-1)" strokeWidth="2.25" strokeDasharray="4 4" />
        ) : mark === "best" ? (
          <circle cx="10" cy="5" r="4" fill="var(--color-card)" stroke="var(--color-foreground)" strokeWidth="1.5" />
        ) : (
          <rect x="6" y="1" width="8" height="8" fill="var(--color-card)" stroke="var(--color-foreground)" strokeWidth="1.5" />
        )}
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col bg-card px-4 py-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body font-semibold tabular-nums">{value}</dd>
      {sub ? <dd className="text-caption text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

function ChangeText({
  trend,
  change,
  against,
  good,
}: {
  trend: Trend;
  change: number;
  against: string;
  good: (v: number) => number;
}) {
  const tone = change === 0 ? "flat" : good(change) > 0 ? "good" : "bad";
  return (
    <span
      className={cn(
        "text-body-compact font-semibold tabular-nums",
        tone === "good" ? "text-success-ink" : tone === "bad" ? "text-destructive-ink" : "text-muted-foreground",
      )}
    >
      <span aria-hidden>{change > 0 ? "▲ " : change < 0 ? "▼ " : "■ "}</span>
      <span className="sr-only">{change > 0 ? "Up " : change < 0 ? "Down " : "No change, "}</span>
      {change ? trendDiff(trend, Math.abs(change)) : ""} vs {against}
    </span>
  );
}

/** The crosshair's month: its value, the change from the month before, and its breakdown. */
function MonthTip({
  active,
  payload,
  docket,
  trend,
  rows,
  good,
}: {
  active?: boolean;
  payload?: { payload?: ChartRow }[];
  docket: CourtDocket;
  trend: Trend;
  rows: ChartRow[];
  good: (v: number) => number;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row || row.value === null) return null;
  const index = rows.indexOf(row);
  const before = rows
    .slice(0, index)
    .reverse()
    .find((r) => r.value !== null);
  const parts = trendBreakdown(docket, trend.id, row.point);
  return (
    <div className="flex min-w-48 flex-col gap-1 rounded-lg border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-overlay">
      <span className="text-caption text-muted-foreground">
        {pointLong(row.point)}
        {row.point.partial ? " · month not over" : ""}
      </span>
      <span className="text-body font-semibold tabular-nums">{trendValue(trend, row.value)}</span>
      {before ? (
        <ChangeText trend={trend} change={row.value - before.value!} against={pointShort(before.point)} good={good} />
      ) : (
        <span className="text-caption text-muted-foreground">First month in range</span>
      )}
      {parts.length ? (
        <dl className="mt-1 flex flex-col gap-0.5 border-t border-hairline pt-1.5">
          {parts.map((p) => (
            <div key={p.label} className="flex justify-between gap-4 text-caption">
              <dt className="text-muted-foreground">{p.label}</dt>
              <dd className="font-semibold tabular-nums">{p.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
