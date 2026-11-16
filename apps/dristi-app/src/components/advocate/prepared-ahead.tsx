"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRightIcon } from "lucide-react";

import { useCanHover } from "@/components/advocate/use-can-hover";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { longDay, shortDay } from "@/lib/advocate/home-dashboard";
import {
  axisFor,
  type DayColumn,
  type PreparedAhead,
  type SegmentKey,
} from "@/lib/advocate/prepared-ahead";
import { cn } from "@/lib/utils";

/**
 * ② Must do today › Insights: "how do I work?" (prepared-ahead-widget-spec.md, §10).
 *
 *   Last week's score   tasks done at least a day ahead, of those due; change in points
 *   One bar per day     the last 10 working days and today: what was on the plate, and
 *                       what happened to it. Carried tasks repeat every day they stay open.
 *   Today               what is left now; opens Take action
 *
 * Colours map the spec's reference values onto DS tokens, each at least 3:1 on the card
 * (DS rule 9). The DS has three treatments per status and keeps `*-ink` for text, so the
 * spec's three corals become: carried = the destructive tint with its solid edge, expired =
 * the destructive solid, and overdue cleared = the chart amber (late, but done). The spec's
 * light grey becomes the muted ink, the lightest neutral that clears 3:1. Every colour is
 * also named in the legend, the breakdown and each bar's accessible name.
 */

type SegmentStyle = { label: string; fill: string; swatch: string };

export const SEGMENT_STYLE: Record<SegmentKey, SegmentStyle> = {
  ahead: { label: "Done ahead", fill: "bg-info", swatch: "bg-info" },
  onDay: { label: "Done on the day", fill: "bg-muted-foreground", swatch: "bg-muted-foreground" },
  cleared: { label: "Overdue cleared", fill: "bg-chart-4", swatch: "bg-chart-4" },
  carried: {
    label: "Carried to next day",
    fill: "border border-destructive bg-destructive-muted",
    swatch: "border border-destructive bg-destructive-muted",
  },
  expired: { label: "Expired", fill: "bg-destructive", swatch: "bg-destructive" },
  overdueTodo: {
    label: "Overdue, still to do",
    fill: "border border-dashed border-destructive",
    swatch: "border border-dashed border-destructive",
  },
  todo: { label: "Still to do", fill: "border border-dashed border-input", swatch: "border border-dashed border-input" },
};

/** Bottom to top (§10.2). */
const STACK: SegmentKey[] = ["ahead", "onDay", "cleared", "carried", "expired", "overdueTodo", "todo"];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Swatch({ k, className }: { k: SegmentKey; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2.5 shrink-0 rounded-xs", SEGMENT_STYLE[k].swatch, className)} />;
}

export function PreparedAheadInsights({ data, tasksHref }: { data: PreparedAhead; tasksHref: string }) {
  if (data.empty) {
    /* The same quiet well every Home card uses when it has nothing to show (§10.7). */
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg bg-surface-sunken p-6 text-center text-body-compact text-muted-foreground">
        Your preparation history will appear here once you have tasks due.
      </div>
    );
  }

  const present = STACK.filter((k) => data.columns.some((c) => c.counts[k] > 0));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Headline data={data} />
      {/* Only the segments in this window (§10.8). */}
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1">
        {present.map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
            <Swatch k={k} />
            {SEGMENT_STYLE[k].label}
          </li>
        ))}
      </ul>
      <Chart columns={data.columns} />
      <TodayLine data={data} href={tasksHref} />
      <Footnote data={data} />
    </div>
  );
}

/* ── Headline (§10.5) ─────────────────────────────────────────────────── */

function Headline({ data }: { data: PreparedAhead }) {
  const { lastWeek, change } = data;
  const range = `${shortDay(lastWeek.from)} to ${shortDay(lastWeek.to)}`;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-medium text-muted-foreground">Last week · {range}</p>
      {lastWeek.percent === null ? (
        <p className="text-body text-muted-foreground">Nothing was due last week.</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-title-l font-semibold tracking-tight tabular-nums">{lastWeek.percent}%</span>
          <span className="text-body-compact tabular-nums">
            {lastWeek.ahead} of {plural(lastWeek.eligible, "task")} done ahead
          </span>
          {change === null ? null : change === 0 ? (
            <span className="text-body-compact text-muted-foreground">Same as the week before</span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-body-compact font-medium tabular-nums",
                change > 0 ? "text-success-ink" : "text-destructive-ink",
              )}
            >
              {change > 0 ? <ArrowUpIcon aria-hidden="true" className="size-4" /> : <ArrowDownIcon aria-hidden="true" className="size-4" />}
              {change > 0 ? "Up" : "Down"} {plural(Math.abs(change), "point")} from the week before
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Chart (§10.3, §10.4) ─────────────────────────────────────────────── */

function Chart({ columns }: { columns: DayColumn[] }) {
  const canHover = useCanHover();
  const { max, cap } = axisFor(columns.map((c) => c.total));
  const past = columns.filter((c) => !c.isToday);
  const today = columns.find((c) => c.isToday);

  const plot = (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative flex min-w-0 gap-2">
        {/* Gridlines: zero, the clean maximum and its half, under the bars. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40">
          {[max, max / 2, 0].map((v) => (
            <div key={v} className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2" style={{ bottom: `${(v / max) * 100}%` }}>
              <span className="w-4 shrink-0 text-right text-caption font-medium text-muted-foreground tabular-nums">{v}</span>
              <span className={cn("h-px flex-1", v === 0 ? "bg-border" : "bg-hairline")} />
            </div>
          ))}
        </div>
        <span aria-hidden="true" className="w-4 shrink-0" />
        <ol aria-label="Your last 10 working days" className="grid min-w-0 flex-1 grid-cols-[repeat(10,minmax(0,1fr))] gap-1">
          {past.map((c) => (
            <Column key={c.day} column={c} max={max} cap={cap} interactive={canHover} />
          ))}
        </ol>
        {today ? (
          <ol aria-label="Today" className="flex w-14 shrink-0 border-l border-hairline pl-2 sm:w-16">
            <Column column={today} max={max} cap={cap} interactive={canHover} />
          </ol>
        ) : null}
      </div>
      <div aria-hidden="true" className="flex min-w-0 gap-2">
        <span className="w-4 shrink-0" />
        <div className="grid min-w-0 flex-1 grid-cols-[repeat(10,minmax(0,1fr))] gap-1">
          {past.map((c) => (
            <DayLabel key={c.day} day={c.day} />
          ))}
        </div>
        {today ? <span className="w-14 shrink-0 pl-2 text-center text-caption font-semibold sm:w-16">Today</span> : null}
      </div>
    </div>
  );

  if (canHover) return plot;

  /* Touch: eleven bars cannot each be a 40px target on a phone, so the whole chart is one
     target that opens every day's breakdown in a bottom drawer (the Home's phone pattern). */
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 flex-col gap-2 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
        >
          {plot}
          <span className="flex items-center justify-center gap-1 text-caption font-medium text-muted-foreground">
            Tap for each day
            <ChevronRightIcon aria-hidden="true" className="size-3.5" />
          </span>
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Each day</DrawerTitle>
          <DrawerDescription>Your last 10 working days and today, newest first.</DrawerDescription>
        </DrawerHeader>
        <ul className="flex flex-col divide-y divide-hairline overflow-y-auto px-4 pb-8">
          {[...columns].reverse().map((c) => (
            <li key={c.day} className="py-4">
              <Breakdown column={c} />
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}

function DayLabel({ day }: { day: string }) {
  const [weekday, date] = shortDay(day).split(" ");
  return (
    <span className="flex flex-col items-center text-caption font-medium text-muted-foreground tabular-nums lg:flex-row lg:justify-center lg:gap-1">
      {/* Phones: the weekday's initial; the date under it tells the two Ts and Ss apart. */}
      <span className="sm:hidden">{weekday.charAt(0)}</span>
      <span className="max-sm:hidden">{weekday}</span>
      <span>{date}</span>
    </span>
  );
}

/** The bar's accessible name: its visible number first (WCAG 2.5.3), then every segment in words. */
function describe(c: DayColumn): string {
  const parts = STACK.filter((k) => c.counts[k] > 0).map((k) => `${SEGMENT_STYLE[k].label} ${c.counts[k]}`);
  const shown = c.isToday ? `${doneOf(c)} done, ${toDoOf(c)} to do. ` : c.total ? `${c.total}. ` : "";
  const head = c.isToday ? "Today" : longDay(c.day);
  const tick = c.tick ? ". All tasks ready before this day" : "";
  return `${shown}${head}: ${parts.length ? parts.join(", ") : "nothing due or done"}${tick}`;
}

const doneOf = (c: DayColumn) => c.counts.ahead + c.counts.onDay + c.counts.cleared;
const toDoOf = (c: DayColumn) => c.counts.overdueTodo + c.counts.todo;

/** How long the breakdown waits before closing, so the pointer can cross from bar to card. */
const CLOSE_DELAY_MS = 150;

function Column({
  column: c,
  max,
  cap,
  interactive,
}: {
  column: DayColumn;
  max: number;
  cap: number | null;
  /** A fine pointer: the bar opens its own breakdown. On touch the chart is one target. */
  interactive: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const closing = React.useRef<number | undefined>(undefined);
  const blank = c.total === 0 && !c.tick;

  const show = () => {
    window.clearTimeout(closing.current);
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closing.current);
    closing.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  React.useEffect(() => () => window.clearTimeout(closing.current), []);

  const bar = <Bar column={c} max={max} cap={cap} />;

  if (!interactive || blank) {
    return (
      <li className="flex min-w-0 flex-1">
        <span role="img" aria-label={describe(c)} className="flex h-54 min-w-0 flex-1 flex-col justify-end">
          {bar}
        </span>
      </li>
    );
  }

  return (
    <li className="flex min-w-0 flex-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={describe(c)}
            onPointerEnter={show}
            onPointerLeave={hide}
            /* Hover already opened it: a click keeps it open rather than toggling it shut. */
            onClick={(e) => {
              e.preventDefault();
              show();
            }}
            className="flex h-54 min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-md outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring aria-expanded:bg-accent"
          >
            {bar}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          className="w-64"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={show}
          onPointerLeave={hide}
        >
          <Breakdown column={c} />
        </PopoverContent>
      </Popover>
    </li>
  );
}

function Bar({ column: c, max, cap }: { column: DayColumn; max: number; cap: number | null }) {
  const drawn = cap !== null && c.total > cap ? cap : c.total;
  const broken = drawn < c.total;
  const height = `${(drawn / max) * 100}%`;
  return (
    /* The plot: bars scale on this area only, so a label above never squeezes a bar. */
    <span aria-hidden="true" className="relative block h-40 w-full">
      <span className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-6 flex-col-reverse gap-0.5" style={{ height }}>
        {STACK.filter((k) => c.counts[k] > 0).map((k) => (
          <span key={k} className={cn("block w-full rounded-xs", SEGMENT_STYLE[k].fill)} style={{ flexGrow: c.counts[k], flexBasis: 0 }} />
        ))}
        {/* The outlier break: the bar is drawn short, its real number is on top. */}
        {broken ? <span className="absolute inset-x-0 top-2 h-1 -skew-y-12 bg-card" /> : null}
      </span>
      {/* Above the bar: the tick, then the total; today says done and to do (§10.3, §10.4). */}
      <span
        className="absolute inset-x-0 flex flex-col-reverse items-center gap-1 text-caption font-medium tabular-nums"
        style={{ bottom: `calc(${height} + 0.25rem)` }}
      >
        {c.tick ? (
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-info text-info-foreground">
            <CheckIcon className="size-3" strokeWidth={3} />
          </span>
        ) : null}
        {c.isToday ? (
          <span className="flex flex-col items-center whitespace-nowrap">
            <span className="text-muted-foreground">{doneOf(c)} done</span>
            <span>{toDoOf(c)} to do</span>
          </span>
        ) : c.total > 0 ? (
          <span>{c.total}</span>
        ) : null}
      </span>
    </span>
  );
}

function Breakdown({ column: c }: { column: DayColumn }) {
  const rows = STACK.filter((k) => c.counts[k] > 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-compact font-semibold">{c.isToday ? `Today, ${longDay(c.day)}` : longDay(c.day)}</p>
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((k) => (
            <li key={k} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5">
              <Swatch k={k} />
              <span className="text-body-compact">{SEGMENT_STYLE[k].label}</span>
              <span className="text-body-compact font-semibold tabular-nums">{c.counts[k]}</span>
              <span className="col-start-2 col-end-4 text-caption font-medium text-muted-foreground">
                {c.tasks[k]
                  .slice(0, 3)
                  .map((t) => t.title)
                  .join(" · ")}
                {c.tasks[k].length > 3 ? ` · +${c.tasks[k].length - 3} more` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-compact text-muted-foreground">Nothing was due or done this day.</p>
      )}
      {c.tick ? (
        <p className="flex items-center gap-2 text-caption font-medium text-info-ink">
          <CheckIcon aria-hidden="true" className="size-3.5" strokeWidth={3} />
          All tasks ready before this day
        </p>
      ) : null}
    </div>
  );
}

/* ── Today (§10.6) and footnote (§10.7) ───────────────────────────────── */

function TodayLine({ data, href }: { data: PreparedAhead; href: string }) {
  const t = data.today;
  const next = t.nextIsTomorrow ? "tomorrow" : shortDay(t.nextDay);
  const parts = [
    t.dueNext ? `${t.dueNext} due ${next}` : null,
    t.leftToday ? `${t.leftToday} left from today` : null,
    t.overdue ? `${t.overdue} overdue` : null,
  ].filter(Boolean);
  const lead = parts.length
    ? `Today: ${parts.join(", ")}.`
    : t.readyThrough
      ? `You're ready through ${longDay(t.readyThrough)}.`
      : "Nothing is waiting on a due date.";

  return (
    <Link
      href={href}
      className="group/today flex min-h-12 items-center gap-3 rounded-lg border border-hairline bg-surface-sunken px-4 py-2.5 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-compact font-medium tabular-nums">{lead}</span>
        {t.noDueDate ? (
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {plural(t.noDueDate, "task")} with no due date
          </span>
        ) : null}
      </span>
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/today:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

function Footnote({ data }: { data: PreparedAhead }) {
  const { inCourt, lateCreated, movedLate } = data.notCounted;
  const left = [
    inCourt ? plural(inCourt, "in-court task") : null,
    lateCreated ? `${plural(lateCreated, "task")} created on ${lateCreated === 1 ? "its" : "their"} due date` : null,
    movedLate ? `${plural(movedLate, "task")} moved to a date already reached` : null,
  ].filter(Boolean);
  return (
    <p className="mt-auto text-caption font-medium text-muted-foreground">
      Working days only.{left.length ? ` Not counted: ${left.join(", ")}.` : ""}
    </p>
  );
}
