"use client";

import * as React from "react";
import { ChevronRightIcon } from "lucide-react";

import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import {
  BOX,
  CaseListBox,
  CountButton,
  PANEL,
  PanelHeader,
  plural,
  SegmentBar,
  useCaseList,
} from "@/components/employee/court-dashboard-attention";
import { CountUp, useGrowIn } from "@/components/employee/court-dashboard-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type CourtDocket } from "@/lib/employee/court-docket";
import {
  averageOver,
  closedCases,
  closureBaseline,
  closureSummary,
  closureTimeline,
  formatDay,
  formatDayShort,
  formatSpan,
  outcomeDetail,
  outcomesIn,
  type OutcomeKey,
  type Outcomes,
  type PeriodReading,
  type TimelineColumn,
} from "@/lib/employee/court-flow";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * "How cases were closed" (Case Flow v4): four figures against the baseline, the outcome
 * mix as 100% bars, one row per outcome that opens in place, and when the closures
 * happened. Pointing at or focusing an outcome anywhere in the section picks it out
 * everywhere else. Follows the Overview's period and comparison.
 *
 * Palette (owner's v4): two teals for the decided outcomes, neutrals for the rest — as DS
 * tokens, darkest first in light mode:
 *
 * - Convicted `brand-muted-foreground` (#0a6969 / dark #0bd8b6), label in the solid ink:
 *   6.49:1 light, 10.85:1 dark.
 * - Acquitted `brand-accent` (#12a594 both), label in foreground light (5.65:1) and the
 *   solid ink dark (6.44:1).
 * - Settled `border`, ended early `track`, to long pending `accent-strong`, labels in the
 *   foreground (8.9:1 and above light, 5.4:1 and above dark).
 *
 * Every value is also text: the outcome rows and the key carry each count and share.
 */

type Outcome = {
  key: OutcomeKey;
  name: string;
  short: string;
  group?: string;
  fill: string;
  ink: string;
};

export const OUTCOMES: Outcome[] = [
  {
    key: "Convicted",
    name: "Convicted",
    short: "Convicted",
    group: "Decided at trial",
    fill: "bg-brand-muted-foreground",
    ink: "text-primary-foreground",
  },
  {
    key: "Acquitted",
    name: "Acquitted",
    short: "Acquitted",
    group: "Decided at trial",
    fill: "bg-brand-accent",
    ink: "text-foreground dark:text-primary-foreground",
  },
  { key: "Settled", name: "Settled or compounded", short: "Settled", fill: "bg-border", ink: "text-foreground" },
  { key: "early", name: "Ended early", short: "Ended early", fill: "bg-track", ink: "text-foreground" },
  {
    key: "toLongPending",
    name: "To long pending register",
    short: "Long pending",
    fill: "bg-accent-strong",
    ink: "text-foreground",
  },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const totalOf = (o: Outcomes) => OUTCOMES.reduce((sum, x) => sum + o[x.key], 0);
const count = (n: number) => formatCount(Math.round(n));

type ClosureList = "all" | OutcomeKey | `age-${OutcomeKey}-${number}` | `col-${number}`;

/** Dims every outcome mark but the one picked out; a transient interaction layer. */
const dim = (picked: OutcomeKey | null, key: OutcomeKey) =>
  cn("transition-opacity duration-150 motion-reduce:transition-none", picked && picked !== key && "opacity-25");

export function Closures({
  docket,
  reading,
  period,
  current,
  baselineLabel,
  averaged,
  picker,
}: {
  docket: CourtDocket;
  reading: PeriodReading;
  /** The period by name: "1–19 October 2026". */
  period: string;
  /** The period, short, as the label of its bar: "19 Oct", "1–19 Oct". */
  current: string;
  /** The panel's own date picker: its period and comparison are its own. */
  picker: React.ReactNode;
  /** The baseline by name, or `null` without one. */
  baselineLabel: string | null;
  averaged: boolean;
}) {
  const now = outcomesIn(docket, reading.selection);
  const base = averageOver(reading.baseline, (p) => outcomesIn(docket, p));
  const summary = closureSummary(docket, reading.selection);
  const baseSummary = closureBaseline(docket, reading.baseline);
  const total = totalOf(now);
  const baseTotal = base ? totalOf(base) : 0;
  const rows = closedCases(docket, reading.selection);
  const timeline = closureTimeline(docket, reading.selection);
  const list = useCaseList<ClosureList>();
  const listId = "dash-closures-cases";
  const [open, setOpen] = React.useState<OutcomeKey | null>(null);
  const [picked, setPicked] = React.useState<OutcomeKey | null>(null);
  const section = React.useRef<HTMLElement>(null);
  useGrowIn(section, `${reading.selection.from}:${reading.selection.to}:${reading.compare}`);
  const vs = baselineLabel ? (averaged ? `the ${baselineLabel.toLowerCase()}` : baselineLabel) : "";
  const hover = (key: OutcomeKey) => (on: boolean) => setPicked(on ? key : null);
  const opener = (key: ClosureList) => ({
    expanded: list.open === key,
    controls: listId,
    onOpen: (from: HTMLElement) => list.toggle(key, from),
  });

  const judged = summary.judgements;
  const baseJudged = baseSummary?.judgements ?? 0;
  const delta = (current: number | null, previous: number | null | undefined, unit: (v: number) => string, goodUp: boolean | null) => {
    if (current === null || previous === null || previous === undefined || !baselineLabel) return null;
    const d = current - previous;
    if (Math.abs(d) < 1e-9) return <span className="text-caption text-muted-foreground">Same as {vs}</span>;
    const tone = goodUp === null ? "flat" : d > 0 === goodUp ? "good" : "bad";
    return (
      <span
        className={cn(
          "text-caption tabular-nums",
          tone === "good" ? "font-semibold text-success-ink" : tone === "bad" ? "font-semibold text-destructive-ink" : "text-muted-foreground",
        )}
      >
        <span aria-hidden>{d > 0 ? "▲ " : "▼ "}</span>
        <span className="sr-only">{d > 0 ? "Up " : "Down "}</span>
        {unit(Math.abs(d))} vs {vs}
      </span>
    );
  };
  const share = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

  const spec = (() => {
    const key = list.open;
    if (!key) return null;
    if (key === "all") return { title: `Cases closed · ${period}`, rows };
    if (key.startsWith("col-") && timeline) {
      const col = timeline.columns[Number(key.slice(4))];
      return {
        title: `Closed ${timeline.unit === "day" ? `on ${formatDay(col.from)}` : formatSpan(col.from, col.to, docket.today)}`,
        rows: rows.filter((r) => r.closedOn >= col.from && r.closedOn <= col.to),
      };
    }
    if (key.startsWith("age-")) {
      const [, outcome, band] = key.split("-") as [string, OutcomeKey, string];
      const x = OUTCOMES.find((o) => o.key === outcome)!;
      const detail = outcomeDetail(rows.filter((r) => r.outcome === outcome));
      const b = detail.ages[Number(band)];
      return { title: `${x.name} · ${b.label.toLowerCase()} from filing · ${period}`, rows: b.rows };
    }
    const x = OUTCOMES.find((o) => o.key === key)!;
    return { title: `${x.name} · ${period}`, rows: rows.filter((r) => r.outcome === key) };
  })();

  return (
    <section ref={section} aria-labelledby="dash-closures" className={PANEL}>
      <PanelHeader
        id="dash-closures"
        title="How cases were closed"
        line={`Judgements, settlements, early endings and transfers to the long pending register${
          baselineLabel ? `, compared with ${vs}` : ""
        }`}
      >
        {picker}
      </PanelHeader>

      <div className="grid min-w-0 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Cases closed">
          <CountButton name="cases closed" className="text-title font-semibold" {...opener("all")}>
            <CountUp value={summary.total} format={count} />
          </CountButton>
          {delta(summary.total, baseSummary?.total, (v) => formatCount(Math.round(v)), true)}
          <span className="text-caption text-muted-foreground tabular-nums">
            {plural(summary.toLongPending, "of them", "of them")} to the long pending register
          </span>
        </Figure>
        <Figure label="Decided at trial">
          <span className="text-title font-semibold tabular-nums">{total ? pct(judged / total) : "–"}</span>
          {delta(share(judged, total), baseSummary ? share(baseJudged, baseSummary.total) : null, (v) => `${Math.round(v)} pts`, null)}
          <span className="text-caption text-muted-foreground tabular-nums">{plural(judged, "judgement", "judgements")}</span>
        </Figure>
        <Figure label="Conviction rate">
          <span className="text-title font-semibold tabular-nums">{judged ? pct(summary.convicted / judged) : "–"}</span>
          {delta(
            share(summary.convicted, judged),
            baseSummary && baseJudged ? share(baseSummary.convicted, baseJudged) : null,
            (v) => `${Math.round(v)} pts`,
            null,
          )}
          <span className="text-caption text-muted-foreground tabular-nums">
            {judged ? `${formatCount(summary.convicted)} of ${plural(judged, "judgement", "judgements")}` : "No judgements"}
          </span>
        </Figure>
        <Figure label="Median time to close">
          <span className="text-title font-semibold tabular-nums">
            {summary.medianDays === null ? "–" : plural(summary.medianDays, "day", "days")}
          </span>
          {delta(summary.medianDays, baseSummary?.medianDays, (v) => plural(Math.round(v), "day", "days"), false)}
          <span className="text-caption text-muted-foreground">From filing, disposed cases only</span>
        </Figure>
      </div>

      <div className={cn(BOX, "grid min-w-0 items-center gap-x-4 gap-y-1.5 p-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:px-6")}>
        <div className="flex min-w-0 flex-col">
          <span className="text-body-compact font-semibold tabular-nums">{current}</span>
          <span className="text-caption text-muted-foreground tabular-nums">{formatCount(total)} closed</span>
        </div>
        {total ? (
          <SegmentBar
            label={`Cases closed, ${period}, by outcome`}
            controls={listId}
            grow
            className="h-8 [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md"
            segments={OUTCOMES.map((x) => {
              const s = now[x.key] / total;
              const text = s >= 0.16 ? `${x.short} ${pct(s)}` : s >= 0.06 ? pct(s) : null;
              return {
                key: x.key,
                value: now[x.key],
                className: cn("flex items-center justify-center overflow-hidden", x.fill, dim(picked, x.key)),
                tip: `${x.name}: ${plural(now[x.key], "case", "cases")} (${pct(s)})`,
                content: text ? (
                  <span aria-hidden className={cn("pointer-events-none truncate px-1.5 text-caption font-semibold", x.ink)}>
                    {text}
                  </span>
                ) : null,
                onHover: hover(x.key),
                ...opener(x.key),
              };
            })}
          />
        ) : (
          <span className="text-body-compact text-muted-foreground">No closures</span>
        )}
        {base && baselineLabel ? (
          <>
            <div className="flex min-w-0 flex-col max-sm:mt-2">
              <span className="text-body-compact text-muted-foreground">{baselineLabel}</span>
              <span className="text-caption text-muted-foreground tabular-nums">
                {formatCount(Math.round(baseTotal))} closed{averaged ? " on average" : ""}
              </span>
            </div>
            {baseTotal ? (
              <SegmentBar
                label={`Cases closed, ${baselineLabel}, by outcome`}
                grow
                className="h-4 [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md"
                segments={OUTCOMES.map((x) => ({
                  key: x.key,
                  value: base[x.key],
                  className: cn(x.fill, dim(picked, x.key)),
                  tip: `${baselineLabel} · ${x.name}: ${averaged ? base[x.key].toFixed(1) : formatCount(Math.round(base[x.key]))}${averaged ? " on average" : ""} (${pct(base[x.key] / baseTotal)})`,
                  onHover: hover(x.key),
                }))}
              />
            ) : (
              <span className="text-body-compact text-muted-foreground">No closures</span>
            )}
          </>
        ) : null}
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ul className={cn(BOX, "flex flex-col overflow-hidden")}>
          {OUTCOMES.map((x) => (
            <OutcomeRow
              key={x.key}
              outcome={x}
              value={now[x.key]}
              total={total}
              base={base ? base[x.key] : null}
              baseTotal={baseTotal}
              most={Math.max(1, ...OUTCOMES.map((o) => Math.max(now[o.key], base ? base[o.key] : 0)))}
              baselineLabel={baselineLabel}
              open={open === x.key}
              onToggle={() => setOpen((cur) => (cur === x.key ? null : x.key))}
              picked={picked}
              onHover={hover(x.key)}
              rows={rows.filter((r) => r.outcome === x.key)}
              now={now}
              opener={opener}
            />
          ))}
        </ul>
        {timeline ? (
          <Timeline timeline={timeline} picked={picked} opener={opener} latest={docket.today} />
        ) : null}
      </div>

      <p className="text-body-compact text-muted-foreground">
        Select an outcome for its details and cases.
        {baselineLabel
          ? ` The short line on each bar marks ${vs}; ▲ ▼ show the change in its share of closures, in percentage points.`
          : " To compare with another period, choose it in the calendar."}
      </p>

      <div id={listId} className="min-w-0 empty:hidden">
        {spec && list.open ? (
          <CaseListBox
            key={list.open}
            id={`dash-closures-${list.open}`}
            title={spec.title}
            summary={`${plural(spec.rows.length, "case", "cases")} · longest in court first`}
            rows={spec.rows}
            daysHeader="Days from filing to closing"
            onClose={list.close}
          />
        ) : null}
      </div>
    </section>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5 bg-surface-sunken px-4 py-3">
      <span className="text-body-compact text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

type Opener = (key: ClosureList) => { expanded: boolean; controls: string; onOpen: (from: HTMLElement) => void };

function OutcomeRow({
  outcome: x,
  value,
  total,
  base,
  baseTotal,
  most,
  baselineLabel,
  open,
  onToggle,
  picked,
  onHover,
  rows,
  now,
  opener,
}: {
  outcome: Outcome;
  value: number;
  total: number;
  base: number | null;
  baseTotal: number;
  most: number;
  baselineLabel: string | null;
  open: boolean;
  onToggle: () => void;
  picked: OutcomeKey | null;
  onHover: (on: boolean) => void;
  rows: ReturnType<typeof closedCases>;
  now: Outcomes;
  opener: Opener;
}) {
  const share = total ? value / total : 0;
  const change = base !== null && baseTotal && total ? Math.round((share - base / baseTotal) * 100) : null;
  const detail = open ? outcomeDetail(rows) : null;
  const panelId = `dash-outcome-${x.key}`;
  const subs: [string, number][] | null =
    x.key === "early"
      ? [
          ["Withdrawn", now.Withdrawn],
          ["Dismissed", now.Dismissed],
          ["Returned", now.Returned],
        ]
      : null;
  return (
    <li className="border-hairline not-first:border-t">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className="group grid w-full cursor-pointer grid-cols-[0.75rem_minmax(0,1fr)_auto_1rem] items-center gap-x-3 gap-y-2 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:ring-inset aria-expanded:bg-muted sm:grid-cols-[0.75rem_minmax(11rem,1fr)_minmax(5rem,1fr)_4.5rem_4rem_1rem]"
      >
        <span aria-hidden className={cn("size-3 rounded-xs", x.fill, dim(picked, x.key))} />
        <span className="flex min-w-0 flex-col">
          <span className="text-body-compact font-semibold">{x.name}</span>
          {x.group ? <span className="text-caption text-muted-foreground">{x.group}</span> : null}
        </span>
        <span aria-hidden className="relative h-2.5 rounded-full bg-muted group-hover:bg-card group-aria-expanded:bg-card max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2">
          <span
            data-grow="x"
            className={cn("absolute inset-y-0 left-0 origin-left rounded-full", x.fill, dim(picked, x.key))}
            style={{ width: `${(value / most) * 100}%` }}
          />
          {base !== null ? (
            <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${(base / most) * 100}%` }} />
          ) : null}
        </span>
        <span className="text-right text-caption text-muted-foreground tabular-nums whitespace-nowrap">
          <strong className="mr-1 text-body font-semibold text-foreground">{formatCount(value)}</strong>
          {total ? pct(share) : ""}
        </span>
        {change !== null ? (
          <span className="text-right text-caption text-muted-foreground tabular-nums whitespace-nowrap max-sm:hidden">
            <span aria-hidden>{change > 0 ? "▲ " : change < 0 ? "▼ " : ""}</span>
            {change ? plural(Math.abs(change), "pt", "pts") : "±0 pts"}
          </span>
        ) : (
          <span className="max-sm:hidden" />
        )}
        <ChevronRightIcon
          aria-hidden
          className={cn("size-4 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-90")}
        />
        <span className="sr-only">
          {base !== null && baselineLabel
            ? `${baselineLabel}: ${pct(base / Math.max(1, baseTotal))} of closures. ${change ? `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} points.` : "No change."}`
            : ""}
        </span>
      </button>
      <div id={panelId} className="empty:hidden">
        {detail ? (
          <div className={cn(RESOLVE_IN_PLACE, "flex flex-col gap-4 px-4 pt-1 pb-4 sm:ml-6")}>
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex flex-col">
                <dt className="text-caption text-muted-foreground">Median time to close</dt>
                <dd className="text-body font-semibold tabular-nums">
                  {detail.medianDays === null ? "–" : plural(detail.medianDays, "day", "days")}
                </dd>
              </div>
              {x.key !== "toLongPending" ? (
                <div className="flex flex-col">
                  <dt className="text-caption text-muted-foreground">Closed before cognizance</dt>
                  <dd className="text-body font-semibold tabular-nums">
                    {formatCount(detail.beforeCognizance)} <span className="font-normal text-muted-foreground">of {formatCount(rows.length)}</span>
                  </dd>
                </div>
              ) : null}
            </dl>
            {subs ? <Bands label={`${x.name}, by how`} rows={subs.map(([l, n]) => ({ label: l, value: n }))} of={value} /> : null}
            {rows.length ? (
              <div className="flex max-w-md flex-col gap-1">
                <span className="text-caption text-muted-foreground">Time from filing</span>
                <ul aria-label={`${x.name}, time from filing`} className="flex flex-col">
                  {detail.ages.map((band, i) => {
                    const most = Math.max(1, ...detail.ages.map((b) => b.rows.length));
                    return (
                      <li key={band.label} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 text-body-compact">
                        <span>{band.label}</span>
                        <span aria-hidden className="h-2 overflow-hidden rounded-full bg-track">
                          <span data-grow="x" className="block h-full origin-left rounded-full bg-brand-accent" style={{ width: `${(band.rows.length / most) * 100}%` }} />
                        </span>
                        {band.rows.length ? (
                          <CountButton
                            name={`${x.name}, ${band.label.toLowerCase()} from filing`}
                            className="justify-end font-semibold"
                            {...opener(`age-${x.key}-${i}`)}
                          >
                            {formatCount(band.rows.length)}
                          </CountButton>
                        ) : (
                          <span className="inline-flex min-h-10 items-center justify-end text-muted-foreground tabular-nums">0</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {rows.length ? (
              <Button
                type="button"
                variant="link"
                className="h-10 w-fit px-0 text-body-compact"
                aria-expanded={opener(x.key).expanded}
                aria-controls={opener(x.key).controls}
                onClick={(event) => opener(x.key).onOpen(event.currentTarget)}
              >
                Show the {plural(rows.length, "case", "cases")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Bands({ label, rows, of }: { label: string; rows: { label: string; value: number }[]; of: number }) {
  return (
    <ul aria-label={label} className="flex max-w-md flex-col gap-1">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 text-body-compact">
          <span>{r.label}</span>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-track">
            <span data-grow="x" className="block h-full origin-left rounded-full bg-brand-accent" style={{ width: `${of ? (r.value / of) * 100 : 0}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{formatCount(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Weekend columns are hatched in the hairline colour, so they read as a backdrop, never as a bar. */
const WEEKEND_HATCH: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, var(--color-border) 0 1px, transparent 1px 6px)",
};

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Timeline({
  timeline,
  picked,
  opener,
  latest,
}: {
  timeline: NonNullable<ReturnType<typeof closureTimeline>>;
  picked: OutcomeKey | null;
  opener: Opener;
  latest: number;
}) {
  const { unit, columns, busiest } = timeline;
  const most = Math.max(1, ...columns.map((c) => c.total));
  const name = (c: TimelineColumn) =>
    unit === "day" ? formatDay(c.from) : unit === "week" ? formatSpan(c.from, c.to, latest) : monthName(c.from);
  const step = Math.ceil(columns.length / (unit === "day" ? 8 : 6));
  return (
    <div className={cn(BOX, "flex min-w-0 flex-col gap-2 p-4")}>
      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-body-compact font-semibold">Closures by {unit}</span>
        <span className="text-caption text-muted-foreground tabular-nums">
          Busiest: {name(busiest)}, {formatCount(busiest.total)}
        </span>
      </div>
      <div role="group" aria-label={`Closures by ${unit}`} className="flex h-44 items-end gap-0.5 border-b border-border">
        {columns.map((c, i) => {
          const parts = OUTCOMES.filter((o) => c.by[o.key]).map((o) => `${o.short} ${c.by[o.key]}`);
          const tip = `${name(c)}: ${plural(c.total, "closure", "closures")}${parts.length ? ` · ${parts.join(", ")}` : ""}${c.weekend ? ` · ${WEEKDAY[new Date(c.from).getUTCDay()]}` : ""}`;
          return (
            <Tooltip key={c.from}>
              <TooltipTrigger asChild>
                {c.total ? (
                  <button
                    type="button"
                    aria-label={`${tip}, ${opener(`col-${i}`).expanded ? "hide" : "show"} the cases`}
                    aria-expanded={opener(`col-${i}`).expanded}
                    aria-controls={opener(`col-${i}`).controls}
                    onClick={(event) => opener(`col-${i}`).onOpen(event.currentTarget)}
                    className={cn(
                      "flex h-full min-w-1 flex-1 cursor-pointer items-end rounded-t-sm outline-hidden hover:bg-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:bg-muted",
                    )}
                    style={c.weekend ? WEEKEND_HATCH : undefined}
                  >
                    <span
                      data-grow="y"
                      className="flex w-full origin-bottom flex-col-reverse gap-px overflow-hidden rounded-t-sm"
                      style={{ height: `${(c.total / most) * 100}%` }}
                    >
                      {OUTCOMES.filter((o) => c.by[o.key]).map((o) => (
                        <span key={o.key} className={cn("block w-full", o.fill, dim(picked, o.key))} style={{ flex: c.by[o.key] }} />
                      ))}
                    </span>
                  </button>
                ) : (
                  <span
                    role="img"
                    tabIndex={0}
                    aria-label={tip}
                    className={cn(
                      "h-full min-w-1 flex-1 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
                    )}
                    style={c.weekend ? WEEKEND_HATCH : undefined}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent className="tabular-nums">{tip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div aria-hidden className="relative h-4 text-caption text-muted-foreground">
        {columns.map((c, i) =>
          (i % step === 0 && columns.length - 1 - i >= step * 0.6) || i === columns.length - 1 ? (
            <span
              key={c.from}
              className={cn(
                "absolute -translate-x-1/2 whitespace-nowrap tabular-nums",
                /* A phone has room for every other label. */
                i % (2 * step) !== 0 && i !== columns.length - 1 && "max-sm:hidden",
              )}
              style={{ left: `${((i + 0.5) / columns.length) * 100}%` }}
            >
              {unit === "month" ? monthName(c.from).slice(0, 3) : formatDayShort(c.from)}
            </span>
          ) : null,
        )}
      </div>
      {unit === "day" ? (
        <p className="text-caption text-muted-foreground">Hatched columns are Saturdays and Sundays.</p>
      ) : null}
    </div>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthName(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
