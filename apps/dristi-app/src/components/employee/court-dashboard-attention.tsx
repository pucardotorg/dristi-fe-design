"use client";

import * as React from "react";

import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import { CountUp, useGrowIn } from "@/components/employee/court-dashboard-motion";
import { DashboardDatePicker } from "@/components/employee/dashboard-date-picker";
import { DocketCaseList } from "@/components/employee/docket-table";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CourtDocket, DocketCase } from "@/lib/employee/court-docket";
import {
  attentionFor,
  formatDay,
  formatDayShort,
  type AttentionCheck,
  type AttentionCheckId,
  type Period,
} from "@/lib/employee/court-flow";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * "Needs attention" on the magistrate dashboard (Case Flow v4), and the pieces every panel
 * shares.
 *
 * The checks are the hearing-date checks (note B) and the process checks (note D),
 * counted on one day: today by default, or the last day of a range, compared with its
 * first. Each check shows its cases and how long they have waited, as a small histogram
 * whose bars open exactly those cases. Hearing-date checks need next dates, kept for the
 * latest day only, so on a past day they say so instead of showing nought.
 *
 * Shared pieces — the dashboard's one way of being interactive:
 *
 * - `CountButton` — a count that opens its cases: the DS primary ink, underlined.
 * - `SegmentBar` — a bar whose segments tell their exact value in a DS tooltip on hover and
 *   keyboard focus, keep it in their accessible name, and (where they count cases) open
 *   them on a click or a tap.
 * - `CaseListBox` and `useCaseList` — one in-panel case list per panel, focus back on
 *   whatever opened it when it closes.
 */

/** A top-level section of the dashboard: a lifted card on the work canvas. */
export const PANEL = cn("flex min-w-0 flex-col gap-6 rounded-xl border bg-card p-6 max-sm:p-4", PANEL_CLASS);

/** A bordered box inside a panel. */
export const BOX = "min-w-0 rounded-xl border border-hairline";

export function PanelHeader({
  id,
  title,
  line,
  note,
  children,
}: {
  id: string;
  title: string;
  /** The period or scope the panel reads, under the title. */
  line?: React.ReactNode;
  note?: React.ReactNode;
  /** A control at the top right: a date picker. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {/* The title block gives way first, so a long line wraps beside the picker
            rather than pushing it onto a row of its own. */}
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
          <h2 id={id} className="text-title-s font-semibold">
            {title}
          </h2>
          {line ? <p className="text-body tabular-nums">{line}</p> : null}
        </div>
        {children}
      </div>
      {note ? <p className="text-body-compact text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** The dashboard's count treatment: the DS primary ink, underlined, with focus and hover. */
export const COUNT_LINK =
  "cursor-pointer rounded-sm text-primary underline decoration-border underline-offset-4 outline-none hover:decoration-current focus-visible:ring-3 focus-visible:ring-focus-ring aria-expanded:decoration-current aria-expanded:decoration-2";

/** A count that opens its cases. Its accessible name starts with what it shows. */
export function CountButton({
  children,
  name,
  expanded,
  controls,
  onOpen,
  className,
}: {
  children: React.ReactNode;
  /** Read after the visible text: "cases filed, show the cases". */
  name: string;
  expanded: boolean;
  controls: string;
  onOpen: (trigger: HTMLElement) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={(event) => onOpen(event.currentTarget)}
      className={cn(COUNT_LINK, "inline-flex min-h-10 items-center text-left tabular-nums", className)}
    >
      {children}
      <span className="sr-only">
        {" "}
        {name}, {expanded ? "hide" : "show"} the cases
      </span>
    </button>
  );
}

export type Segment = {
  key: string;
  value: number;
  /** Fill classes. */
  className: string;
  /** The exact value, as the tooltip and the accessible name say it. */
  tip: string;
  /** Opens the segment's cases; a segment without it only tells its value. */
  onOpen?: (trigger: HTMLElement) => void;
  expanded?: boolean;
  /** A label drawn on the segment; the accessible name stays the tip. */
  content?: React.ReactNode;
  /** Extra attributes, such as the outcome a segment belongs to. */
  data?: Record<string, string>;
  onHover?: (on: boolean) => void;
};

/**
 * Proportional segments, each one focusable. A segment that counts cases is a button and
 * opens them; one that does not is an image with its value as its name. Either way the
 * DS tooltip shows the value on hover and on keyboard focus. The visible bar is thin, so a
 * button's hit area reaches 40px tall through its `after` layer.
 */
export function SegmentBar({
  label,
  segments,
  controls,
  className,
  style,
  grow,
}: {
  label: string;
  segments: Segment[];
  controls?: string;
  /** Height and rounding. */
  className?: string;
  style?: React.CSSProperties;
  /** Marks the segments to grow in from their start. */
  grow?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 gap-0.5", className)} style={style}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => {
          const hover = s.onHover
            ? {
                onMouseEnter: () => s.onHover!(true),
                onMouseLeave: () => s.onHover!(false),
                onFocus: () => s.onHover!(true),
                onBlur: () => s.onHover!(false),
              }
            : {};
          const shared = {
            "data-grow": grow ? "x" : undefined,
            ...Object.fromEntries(Object.entries(s.data ?? {}).map(([k, v]) => [`data-${k}`, v])),
            ...hover,
          };
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger asChild>
                {s.onOpen ? (
                  <button
                    type="button"
                    aria-label={`${s.tip}, ${s.expanded ? "hide" : "show"} the cases`}
                    aria-expanded={s.expanded ?? false}
                    aria-controls={controls}
                    onClick={(event) => s.onOpen!(event.currentTarget)}
                    className={cn(
                      "relative block h-full min-w-1 origin-left cursor-pointer outline-hidden after:absolute after:inset-x-0 after:-inset-y-3.5 hover:outline-2 hover:outline-solid hover:outline-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:outline-2 aria-expanded:outline-solid aria-expanded:outline-foreground",
                      s.className,
                    )}
                    style={{ flex: s.value }}
                    {...shared}
                  >
                    {s.content}
                  </button>
                ) : (
                  <span
                    role="img"
                    tabIndex={0}
                    aria-label={s.tip}
                    className={cn(
                      "block h-full min-w-1 origin-left outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
                      s.className,
                    )}
                    style={{ flex: s.value }}
                    {...shared}
                  >
                    {s.content}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent className="tabular-nums">{s.tip}</TooltipContent>
            </Tooltip>
          );
        })}
    </div>
  );
}

type ListRow = { case: DocketCase; days: number };

/** One panel's open list: which one, and focus back on whatever opened it when it closes. */
export function useCaseList<K extends string>() {
  const [open, setOpen] = React.useState<K | null>(null);
  const trigger = React.useRef<HTMLElement | null>(null);
  const toggle = (key: K, from: HTMLElement) => {
    trigger.current = from;
    setOpen((current) => (current === key ? null : key));
  };
  const close = () => {
    setOpen(null);
    const from = trigger.current;
    if (from && from.isConnected) from.focus();
  };
  return { open, toggle, close, setOpen };
}

/** A list's cases inside its panel: name, size, Close, and the shared paged case table. */
export function CaseListBox({
  id,
  title,
  summary,
  details,
  rows,
  daysHeader,
  onClose,
}: {
  id: string;
  title: string;
  summary: string;
  /** Lines that spell out what the marks above show. */
  details?: string[];
  rows: ListRow[];
  daysHeader: string;
  onClose: () => void;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(BOX, RESOLVE_IN_PLACE, "flex flex-col gap-4 border-border p-4 sm:p-6")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`${id}-title`} className="text-body font-semibold">
            {title}
          </h3>
          <p aria-live="polite" className="text-body-compact text-muted-foreground tabular-nums">
            {summary}
          </p>
          {details?.map((line) => (
            <p key={line} className="text-body-compact text-muted-foreground tabular-nums">
              {line}
            </p>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <DocketCaseList id={`${id}-list`} caption={title} rows={rows} daysHeader={daysHeader} />
    </section>
  );
}

/* ------------------------------------------------------- needs attention */

const DAYS_HEADER: Record<AttentionCheckId, string> = {
  undated: "Days since last posting",
  long: "Days to next date",
  soon: "Days to hearing",
  pay: "Days unpaid",
  del: "Days undelivered",
};

type AttentionList = AttentionCheckId | `${AttentionCheckId}-${number}`;

const count = (n: number) => formatCount(Math.round(n));

export function NeedsAttention({ docket }: { docket: CourtDocket }) {
  const today = { from: docket.today, to: docket.today };
  const [picked, setPicked] = React.useState<Period | null>(null);
  const selection = picked ?? today;
  const reading = attentionFor(docket, selection);
  const list = useCaseList<AttentionList>();
  const listId = "dash-attention-cases";
  const range = reading.start !== null;
  const checks = reading.groups.flatMap((g) => g.checks);
  const anyMissing = checks.some((c) => !c.available);
  const day = formatDayShort(reading.day);
  const table = React.useRef<HTMLDivElement>(null);
  useGrowIn(table, `${selection.from}:${selection.to}`);

  const showToday = (
    <Button type="button" variant="link" className="h-auto px-0 py-0 text-body-compact" onClick={() => setPicked(null)}>
      Show today
    </Button>
  );

  const opened = (() => {
    if (!list.open) return null;
    const [id, bin] = list.open.split("-") as [AttentionCheckId, string | undefined];
    const check = checks.find((c) => c.id === id);
    if (!check || !check.available) return null;
    const b = bin === undefined ? null : check.bins[Number(bin)];
    const rows = b ? b.rows : check.rows;
    return {
      check,
      rows,
      title: b ? `${check.label} · ${b.label}` : check.label,
      summary: `${plural(rows.length, "case", "cases")} · ${check.id === "soon" ? "soonest" : "longest"} first${reading.live ? "" : ` · on ${day}`}`,
    };
  })();

  const columns = range ? 4 : 3;

  return (
    <section aria-labelledby="dash-attention" className={PANEL}>
      <PanelHeader
        id="dash-attention"
        title="Needs attention"
        line={`Cases missing a hearing date or waiting on process${
          range ? ` · counted on ${day}, compared with ${formatDayShort(reading.start!)}` : ""
        }`}
      >
        <DashboardDatePicker
          docket={docket}
          value={selection}
          defaultValue={today}
          defaultLabel="Today"
          idPrefix="dash-attention-picker"
          dayNote="counted on this day"
          rangeNote={() => "counted on its last day, compared with its first"}
          onChange={(next) => {
            list.setOpen(null);
            setPicked(next.from === docket.today && next.to === docket.today ? null : next);
          }}
        />
      </PanelHeader>

      <p aria-live="polite" className="text-body-compact tabular-nums">
        {checks.every((c) => c.available && !c.rows.length) ? (
          <span className="text-success-ink">No cases need attention on {day}.</span>
        ) : (
          <>
            <strong className="font-semibold">{formatCount(reading.distinct)}</strong>{" "}
            {anyMissing
              ? `${reading.distinct === 1 ? "case has" : "cases have"} a process issue. Hearing dates can only be checked for today.`
              : `${reading.distinct === 1 ? "case needs" : "cases need"} attention. Some appear in more than one row.`}
          </>
        )}
      </p>

      <div ref={table} className={cn(BOX, "relative overflow-x-auto")}>
        <table className="w-full min-w-2xl border-collapse text-body-compact">
          <caption className="sr-only">
            Needs attention, counted on {formatDay(reading.day)}
            {range ? `, compared with ${formatDay(reading.start!)}` : ""}
          </caption>
          <thead>
            <tr className="bg-surface-sunken text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 text-left font-normal">
                Issue
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-normal">
                Cases
              </th>
              <th scope="col" className="px-4 py-2.5 text-left font-normal">
                How long they have waited <span className="max-sm:sr-only">· select a bar to see those cases</span>
              </th>
              {range ? (
                <th scope="col" className="px-4 py-2.5 text-left font-normal">
                  Since {formatDayShort(reading.start!)}
                </th>
              ) : null}
            </tr>
          </thead>
          {reading.groups.map((group) => (
            <tbody key={group.key}>
              <tr>
                <th
                  colSpan={columns}
                  scope="rowgroup"
                  className="border-t border-hairline bg-muted px-4 py-2 text-left font-semibold"
                >
                  {group.label}
                </th>
              </tr>
              {group.checks.every((c) => !c.available) ? (
                <tr>
                  <td colSpan={columns} className="border-t border-hairline px-4 py-3 text-muted-foreground">
                    Hearing dates are only kept for today, so these can’t be shown for {day}. {showToday}
                  </td>
                </tr>
              ) : (
                group.checks.map((check) => (
                  <AttentionRow
                    key={check.id}
                    check={check}
                    range={range}
                    start={reading.start}
                    list={list}
                    controls={listId}
                    showToday={showToday}
                  />
                ))
              )}
            </tbody>
          ))}
        </table>
      </div>
      <p className="text-body-compact text-muted-foreground">Select a number or a bar to see the cases.</p>

      <div id={listId} className="min-w-0 empty:hidden">
        {opened && list.open ? (
          <CaseListBox
            key={list.open}
            id={`dash-attention-${list.open}`}
            title={opened.title}
            summary={opened.summary}
            rows={opened.rows}
            daysHeader={DAYS_HEADER[opened.check.id]}
            onClose={list.close}
          />
        ) : null}
      </div>
    </section>
  );
}

function AttentionRow({
  check,
  range,
  start,
  list,
  controls,
  showToday,
}: {
  check: AttentionCheck;
  range: boolean;
  start: number | null;
  list: ReturnType<typeof useCaseList<AttentionList>>;
  controls: string;
  showToday: React.ReactNode;
}) {
  const label = (
    <th scope="row" className="w-2/5 border-t border-hairline px-4 py-3 text-left align-top font-normal">
      <span className={cn("block font-semibold", !check.available || !check.rows.length ? "font-normal text-muted-foreground" : "")}>
        {check.label}
      </span>
      <span className="block text-caption text-muted-foreground">{check.rule}</span>
    </th>
  );
  if (!check.available) {
    return (
      <tr>
        {label}
        <td colSpan={range ? 3 : 2} className="border-t border-hairline px-4 py-3 align-top text-muted-foreground">
          Only available for today. {showToday}
        </td>
      </tr>
    );
  }
  const since =
    range ? (
      <td className="border-t border-hairline px-4 py-3 align-top whitespace-nowrap">
        {check.latestOnly || check.atStart === null ? (
          <span className="text-muted-foreground">
            {check.latestOnly ? "Not tracked before today" : `No data for ${formatDayShort(start!)}`}
          </span>
        ) : (
          <SinceCell now={check.rows.length} was={check.atStart} />
        )}
      </td>
    ) : null;
  if (!check.rows.length) {
    return (
      <tr>
        {label}
        <td className="border-t border-hairline px-4 py-3 text-right align-top text-success-ink">None</td>
        <td className="border-t border-hairline px-4 py-3" />
        {since}
      </tr>
    );
  }
  const most = Math.max(1, ...check.bins.map((b) => b.rows.length));
  return (
    <tr className="hover:bg-muted">
      {label}
      <td className="w-px border-t border-hairline px-4 py-2 text-right align-top">
        <CountButton
          name={check.label.toLowerCase()}
          className="-my-1 justify-end text-title-s font-semibold"
          expanded={list.open === check.id}
          controls={controls}
          onOpen={(from) => list.toggle(check.id, from)}
        >
          <CountUp value={check.rows.length} format={count} />
        </CountButton>
      </td>
      <td className="border-t border-hairline px-4 py-3 align-top">
        <div className="flex w-full max-w-xs flex-col gap-1">
          <div role="group" aria-label={`${check.label}, by how long they have waited`} className="flex h-10 items-end gap-0.5 border-b border-border">
            {check.bins.map((bin, i) => {
              const key = `${check.id}-${i}` as AttentionList;
              const n = bin.rows.length;
              if (!n) return <span key={i} aria-hidden className="flex-1" />;
              const tip = `${plural(n, "case", "cases")} · ${bin.label}`;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-grow="y"
                      aria-label={`${tip}, ${list.open === key ? "hide" : "show"} the cases`}
                      aria-expanded={list.open === key}
                      aria-controls={controls}
                      onClick={(event) => list.toggle(key, event.currentTarget)}
                      className="relative min-h-0.5 flex-1 origin-bottom cursor-pointer rounded-t-xs bg-brand-accent outline-hidden after:absolute after:inset-x-0 after:-top-3 after:bottom-0 hover:outline-2 hover:outline-solid hover:outline-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:outline-2 aria-expanded:outline-solid aria-expanded:outline-foreground"
                      style={{ height: `${(n / most) * 100}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="tabular-nums">{tip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div aria-hidden className="flex justify-between gap-2 text-caption text-muted-foreground tabular-nums">
            <span>{check.axis.low}</span>
            <span className="truncate">{check.axis.title}</span>
            <span>{check.axis.high}</span>
          </div>
          {check.fact ? <p className="text-body-compact tabular-nums">{check.fact}</p> : null}
        </div>
      </td>
      {since}
    </tr>
  );
}

function SinceCell({ now, was }: { now: number; was: number }) {
  const diff = now - was;
  return (
    <span className="tabular-nums">
      <span
        className={cn(
          "font-semibold",
          diff > 0 ? "text-destructive-ink" : diff < 0 ? "text-success-ink" : "text-muted-foreground",
        )}
      >
        {diff ? `${diff > 0 ? "Up" : "Down"} ${formatCount(Math.abs(diff))}` : "No change"}
      </span>{" "}
      <span className="text-muted-foreground">from {formatCount(was)}</span>
    </span>
  );
}
