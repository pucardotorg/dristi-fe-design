"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon, ChevronDownIcon } from "lucide-react";
import { RefreshIcon, useRefreshPhase } from "@/components/advocate/refresh-button";
import { advHome, fillCopy } from "@/lib/advocate/content";
import { type Locale, pick } from "@/lib/onboarding/content";
import { useLocale } from "@/components/shell/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type CourtHearings,
  type HearingMine,
  type TrackPart,
  cost,
  hearingCount,
  nextWorkingDay,
  nowLineParts,
  orderCourts,
  shortDate,
  trackParts,
} from "./hearings-today";

const SHOWN = 3;

/**
 * Card 1, draft 2: your hearings today (owner design, 2026-11-18, "sleek" round).
 * One line per court: bars for folded stretches, dots for single items, every number on one
 * baseline under the line. Your items are rings; the live item a green dot in a soft halo.
 */
type Day = "today" | "next";

export function HearingsTodayCard({ courts: today, nextCourts }: { courts: CourtHearings[]; nextCourts: CourtHearings[] }) {
  const { locale } = useLocale();
  const [all, setAll] = React.useState(false);
  /* Owner, 2026-11-19: the title's day menu switches to the next working day. It is called
     "Tomorrow" when that is tomorrow, and "Next working day" only when a weekend or holiday
     falls between. Same lines; nothing has sat yet. */
  const [day, setDay] = React.useState<Day>("today");
  const dates = React.useMemo<Dates>(() => {
    const now = new Date();
    const next = nextWorkingDay(now);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { today: shortDate(now), next: shortDate(next), tomorrow: next.getTime() === tomorrow.getTime() };
  }, []);
  /* Demo: refresh re-reads the same fixture; on main it reloads the day's hearings. */
  const [, setRefreshed] = React.useState(0);
  const courts = day === "today" ? today : nextCourts;
  /* Experiment only (owner, 2026-11-18): folds as solid bars, dotted lines joining two dots,
     or every live dot on one vertical "now" line. */
  const [fold, setFold] = React.useState<"bars" | "dotted" | "now">("now");
  /* Switch hidden for now (owner, 2026-11-18): set true to compare versions again. */
  const showSwitch = true;
  const ordered = React.useMemo(() => orderCourts(courts), [courts]);
  const shown = all ? ordered : ordered.slice(0, SHOWN);
  const hidden = ordered.length - SHOWN;

  return (
    <Card variant="raised" role="region" aria-labelledby="home-hearings" className="min-w-0 gap-4">
      <CardHeader className="items-center">
        <CardTitle className="min-w-0">
          <h2 id="home-hearings" className="flex flex-wrap items-center gap-x-1 text-title-s font-semibold">
            Your hearings
            <DayMenu day={day} setDay={(d) => { setDay(d); setAll(false); }} dates={dates} />
          </h2>
          {/* Phones: the stat sits under the title; the header row has no room for it. */}
          <Stat courts={ordered} className="mt-2 sm:hidden" />
        </CardTitle>
        {/* Phones: the button sits on the title's line (self-start, nudged to centre on its 28px
            line); from sm up the whole row centres. Stat sits close to the button (owner). */}
        <CardAction className="row-span-1 flex items-center gap-1 self-start max-sm:mt-[-2px] sm:self-center">
          <Stat courts={ordered} className="max-sm:hidden" />
          <CardRefresh locale={locale} onRefresh={() => setRefreshed((n) => n + 1)} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* Phones: the experiment switch sits under the title; the header has no room for it. */}
        {showSwitch ? <FoldSwitch fold={fold} setFold={setFold} className="mb-6 sm:hidden" /> : null}
        {shown.length ? (
          <ul className={cn("flex flex-col gap-12 pb-6", fold === "now" && SHOW_NOW_LINE && "sm:pt-8")}>
            {shown.map((c, i) => (
              fold === "now" ? (
                <NowLineTrack key={c.court} court={c} first={i === 0} today={day === "today"} />
              ) : (
                <CourtTrack key={c.court} court={c} connect={fold === "dotted"} today={day === "today"} />
              )
            ))}
          </ul>
        ) : (
          <p className="py-6 text-body-compact text-muted-foreground">
            {day === "today"
              ? "No hearings listed for you today."
              : dates.tomorrow
                ? "No hearings listed for you tomorrow."
                : `No hearings listed for you on ${dates.next}.`}
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-4 py-3">
        {hidden > 0 ? (
          <Button variant="ghost" size="sm" className="-ml-3" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show ${hidden} more ${hidden === 1 ? "court" : "courts"}`}
            <ChevronDownIcon
              data-icon="inline-end"
              aria-hidden="true"
              className={cn("motion-safe:transition-transform", all && "rotate-180")}
            />
          </Button>
        ) : (
          <span />
        )}
        {/* Experiment switch: in the footer on desktop so the header and its spacing stay as designed. */}
        {showSwitch ? <FoldSwitch fold={fold} setFold={setFold} className="-my-1 max-sm:hidden" /> : null}
        <Button asChild variant="outline" size="sm" className="-mr-3">
          <Link href="/advocate">
            Go to Hearings
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/** "14 hearings in 7 courts": your items across the day's courts. */
function Stat({ courts, className }: { courts: CourtHearings[]; className?: string }) {
  const n = hearingCount(courts);
  return (
    <p className={cn("text-caption font-medium text-muted-foreground tabular-nums", className)}>
      {n} {n === 1 ? "hearing" : "hearings"} in {courts.length} {courts.length === 1 ? "court" : "courts"}
    </p>
  );
}

type Dates = { today: string; next: string; /** The next working day is tomorrow. */ tomorrow: boolean };

/**
 * The title's day, read as one sentence: "Your hearings today ⌄", "Your hearings tomorrow ⌄",
 * or, when a weekend or holiday falls between, "Your hearings on Mon, 23 Nov ⌄". Same size and
 * weight as the heading; the chevron sits in a small circle so the menu is easy to spot. The
 * menu names each day with its date, the chosen one ticked (DS radio item, as in the court switch).
 */
function DayMenu({ day, setDay, dates }: { day: Day; setDay: (d: Day) => void; dates: Dates }) {
  const nextName = dates.tomorrow ? "Tomorrow" : "Next working day";
  /* Phones drop the weekday ("on 23 Nov") so the title stays on one line. */
  const label = day === "today" ? "today" : dates.tomorrow ? "tomorrow" : (
    <>
      on <span className="max-sm:hidden">{dates.next}</span>
      <span className="sm:hidden">{dates.next.replace(/^\w+, /, "")}</span>
    </>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${day === "today" ? `Today, ${dates.today}` : `${nextName}, ${dates.next}`}. Change day`}
          className="-mx-1 h-auto gap-1.5 px-1 py-0 text-title-s font-semibold"
        >
          {label}
          <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border border-input bg-accent-strong">
            <ChevronDownIcon className="size-3" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        <DropdownMenuRadioGroup value={day} onValueChange={(v) => setDay(v as Day)}>
          <DropdownMenuRadioItem value="today">Today ({dates.today})</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="next">
            {nextName} ({dates.next})
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Refresh: the Hearings home's gesture (spin, tick, "Refreshed") and copy, as a bare icon
 * button so it sits quietly in the card header (owner, 2026-11-19). The caption appears BELOW
 * the button: "Refreshed" in green right after, "Last refreshed …" on hover (mouse only).
 */
function CardRefresh({ onRefresh, locale }: { onRefresh: () => void; locale: Locale }) {
  const [lastAt, setLastAt] = React.useState(() => Date.now());
  const { phase, trigger } = useRefreshPhase(() => {
    onRefresh();
    setLastAt(Date.now());
  });
  const time = new Intl.DateTimeFormat(locale === "ml" ? "ml-IN" : "en-IN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(lastAt),
  );
  return (
    <div className="group/refresh relative">
      <Button variant="ghost" size="icon-xs" onClick={trigger} aria-label={pick(advHome.refreshHearings, locale)} className="-mr-2">
        <RefreshIcon phase={phase} className="size-3.5" />
      </Button>
      <span
        aria-hidden="true"
        className={cn(
          /* 11px, reviewed: a passing status note under a 32px icon; caption (12px, the DS's
             smallest role) read too heavy there (owner, 2026-11-19). ds-typography-allow */
          // ds-typography-allow (11px status note, see above)
          "pointer-events-none absolute top-full right-0 -mt-1 text-[11px] leading-4 whitespace-nowrap transition-all duration-200 ease-out",
          phase === "done"
            ? "translate-y-0 font-medium text-success-ink opacity-100"
            : "-translate-y-1 text-muted-foreground opacity-0 [@media(hover:hover)]:group-hover/refresh:translate-y-0 [@media(hover:hover)]:group-hover/refresh:opacity-100",
        )}
      >
        {phase === "done" ? pick(advHome.refreshedDone, locale) : fillCopy(advHome.lastRefreshed, locale, { time })}
      </span>
    </div>
  );
}

type Fold = "bars" | "dotted" | "now";

/** Experiment only: switch between fold styles. Remove once one is picked. */
function FoldSwitch({ fold, setFold, className }: { fold: Fold; setFold: (f: Fold) => void; className?: string }) {
  return (
    <SegmentedControl
      type="single"
      size="compact"
      value={fold}
      onValueChange={(v) => v && setFold(v as Fold)}
      aria-label="Fold style (experiment)"
      className={className}
    >
      <SegmentedControlItem value="bars">Bars</SegmentedControlItem>
      <SegmentedControlItem value="dotted">Dotted</SegmentedControlItem>
      <SegmentedControlItem value="now">Now line</SegmentedControlItem>
    </SegmentedControl>
  );
}

/** Pulse period. Every live pill keys its pulse to the wall clock, so all courts pulse together. */
const PULSE_MS = 2400;

/**
 * The live item: a green circle with its number inside, and a slow pulse around it.
 * 20px for one or two digits, 24px for three. The slot stays a dot's 16px, so spacing around
 * it matches the other dots; the circle just spills over evenly.
 */
function LivePill({ item }: { item: number }) {
  const ring = React.useRef<HTMLSpanElement>(null);
  /* Pin the pulse to the page's clock start: every pill, whenever it mounts, sits at the same
     point of the same cycle. */
  React.useEffect(() => {
    ring.current?.getAnimations().forEach((a) => {
      a.startTime = 0;
    });
  }, []);
  const size = String(item).length > 2 ? "size-6" : "size-5";
  return (
    <span aria-hidden="true" className="relative flex size-4 shrink-0 items-center justify-center">
      <span
        ref={ring}
        className={cn("absolute rounded-full bg-success motion-safe:animate-ping", size)}
        style={{ animationDuration: `${PULSE_MS}ms` }}
      />
      {/* 10px numeral, reviewed: an annotation inside a 20px marker, not screen copy; caption
          size filled the circle. Same call as the rail badge. ds-typography-allow */}
      <span
        className={cn(
          // ds-typography-allow (see note above)
          // ds-typography-allow (10px numeral, see above)
          "relative flex shrink-0 items-center justify-center rounded-full bg-success text-[10px] leading-none font-semibold text-success-foreground tabular-nums",
          size,
        )}
      >
        {item}
      </span>
    </span>
  );
}

/** A dotted line drawn as an SVG stroke with round caps: smooth, evenly spaced 1.5px dots. */
function DottedLine({ vertical, className }: { vertical?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={className}>
      <svg className="block size-full overflow-visible" fill="none">
        <line
          x1={vertical ? "50%" : "0"}
          y1={vertical ? "0" : "50%"}
          x2={vertical ? "50%" : "100%"}
          y2={vertical ? "100%" : "50%"}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="0 5"
        />
      </svg>
    </span>
  );
}

/** A dot's room: a 16px slot plus the 8px gap after it. Fixed, so spacing matches on every row. */
const DOT_PITCH = 24;
const GAP = 8;

/** How many dots fit the track's real width; follows the card as it resizes. */
function useBudget() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [budget, setBudget] = React.useState<number | undefined>(undefined);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBudget(Math.max(6, Math.floor((el.clientWidth + GAP) / DOT_PITCH)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, budget] as const;
}

function CourtTrack({ court: c, connect, today = true }: { court: CourtHearings; connect: boolean; today?: boolean }) {
  const [trackRef, budget] = useBudget();
  const parts = trackParts(c, budget, connect);

  return (
    <li className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
      {/* The name sits on the dot line: same 16px line height as the track. */}
      <div className="flex min-w-0 shrink-0 items-start sm:h-4 sm:w-24">
        <CourtName name={c.court} said={courtSaid(c, today)} />
      </div>
      <div className="flex h-4 min-w-0 flex-1 items-center gap-2">
        {/* On the next working day every court is not started, so the tag would only repeat. */}
        {c.now || !today ? null : (
          <Hint text="Not in session yet">
            <span className="shrink-0 text-caption font-medium whitespace-nowrap text-muted-foreground">Not started</span>
          </Hint>
        )}
        <div ref={trackRef} className="flex h-4 min-w-0 flex-1 items-center">
          <Zone parts={parts} budget={budget ?? 0} spreadable connect={connect} />
        </div>
      </div>
    </li>
  );
}

/**
 * Now-line row: [ 1 ━━ heard ━━ ] ● [ to come … last ]. The left zone is a third of the track on
 * every row, so the live dots stack on one vertical line drawn through them.
 */
function NowLineTrack({ court: c, first, today = true }: { court: CourtHearings; first?: boolean; today?: boolean }) {
  const [rightRef, rightBudget] = useBudget();
  const { left, right, heardMine } = nowLineParts(c, rightBudget ?? 18);
  const note = heardMine.length ? `includes your ${heardMine.join(", ")}` : undefined;
  return (
    /* Lead designer review (2026-11-19): the court name sits above its line at every width, as on
       phones, so names never truncate and the line gets the full card width. */
    <li className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <CourtName name={c.court} said={courtSaid(c, today)} />
        {/* Owner, 2026-11-19: a court not in session says so right after its name, as a small
            neutral tag. It never shrinks; a long name wraps beside it instead. 20px tall, -my-0.5
            keeps it centred on the 16px name line, so the row is as tall as every other. */}
        {/* On the next working day every court is not started, so the tag would only repeat. */}
        {c.now || !today ? null : (
          <Hint text="Not in session yet">
            <Badge variant="secondary" className="-my-0.5 h-5 px-1.5">
              Not started
            </Badge>
          </Hint>
        )}
      </div>
      {c.now ? (
        <div className="flex h-4 min-w-0 items-center">
          <div
            className={cn(
              /* A quarter of the line (phones a fifth): the heard bar only says "done", its length
                 means nothing. */
              "flex h-4 w-1/4 min-w-0 shrink-0 items-center justify-end max-sm:w-1/5",
            )}
          >
            {left.map((p, i) => (
              <React.Fragment key={p.kind === "bar" ? "heard" : p.item}>
                {/* The dotted line runs right up to the dot at 1 (2px), as in the dotted version. */}
                {i > 0 ? <span aria-hidden="true" className="h-px w-0.5 shrink-0" /> : null}
                {p.kind === "bar" ? <Bar part={p} note={note} dotted /> : <Dot part={p} />}
              </React.Fragment>
            ))}
          </div>
          {/* Same gap on every row (even with nothing heard yet), so the line stays perfectly straight. */}
          <span aria-hidden="true" className="h-px w-1.5 shrink-0" />
          <NowOnLine item={c.now} first={first} />
          <div ref={rightRef} className="flex h-4 min-w-0 flex-1 items-center">
            {/* `lead`: the gap after the live pill follows the same rule as every other gap, so it
                spreads with them when a short court spreads its dots. */}
            <Zone parts={right} budget={rightBudget ?? 0} spreadable lead connect />
          </div>
        </div>
      ) : (
        /* Not started: nothing heard and nothing live, so the line simply runs from item 1 at
           the start, like every other court's, and folds the same way. */
        <div ref={rightRef} className="flex h-4 min-w-0 items-center">
          <Zone parts={right} budget={rightBudget ?? 0} spreadable connect />
        </div>
      )}
    </li>
  );
}

/** The live dot on the now line. The line runs through it, up and down into the rows around it
    (rows are 48px apart, so 24px each way meets the next row's segment). Its number masks the line. */
/* Lead designer review (2026-11-19): no drawn line or tag; the live pills still stack on one
   invisible column. Set true to bring the line and "Happening now" tag back. */
const SHOW_NOW_LINE = false;

function NowOnLine({ item, first }: { item: number; first?: boolean }) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      {/* The now line: a single 1px green line through every row; folds in this tab are dotted (rows are 48px apart: 24px each way). */}
      {SHOW_NOW_LINE ? (
        <span aria-hidden="true" className="absolute -top-6 -bottom-6 left-1/2 w-px -translate-x-1/2 bg-success max-sm:hidden" />
      ) : null}
      {first && SHOW_NOW_LINE ? (
        <span className="absolute bottom-full left-1/2 mb-6 -translate-x-1/2 rounded-full bg-success-muted px-2 py-0.5 text-caption font-medium whitespace-nowrap text-success-ink max-sm:hidden">
          Happening now
        </span>
      ) : null}
      {item ? (
        <Hint text={`Happening now · Item ${item}`}>
          <span className="relative">
            <LivePill item={item} />
          </span>
        </Hint>
      ) : (
        <Hint text="Not in session yet">
          <span aria-hidden="true" className="relative size-2 rounded-full border border-input bg-card" />
        </Hint>
      )}
    </span>
  );
}

/** A court's line: dots and bars with the fixed gaps (6px beside a bar, 8px between dots). */
function Zone({
  parts,
  budget,
  spreadable,
  connect,
  lead,
}: {
  parts: TrackPart[];
  budget: number;
  spreadable: boolean;
  connect?: boolean;
  /** Also draw the gap before the first part (it follows a dot outside the zone). */
  lead?: boolean;
}) {
  const spread = spreadable && !parts.some((p) => p.kind === "bar");
  /* Even the tightest fold does not fit (a narrow phone, many of your items): everything squeezes. */
  const squeeze = budget > 0 && cost(parts) > budget;
  return (
    <>
      {parts.map((p, i) => {
        const prev = parts[i - 1];
        const byBar = p.kind === "bar" || prev?.kind === "bar";
        return (
          <React.Fragment key={p.kind === "bar" ? `b${p.from}` : p.item}>
            {i > 0 || lead ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px",
                  /* A dotted line runs right up to the dots it joins (4px); a bar keeps 6px; dots 8px. */
                  spread ? "min-w-px flex-1" : byBar ? (connect ? "w-0.5 shrink" : "w-1.5 shrink") : "w-2 shrink",
                  squeeze && "min-w-0",
                )}
              />
            ) : null}
            {p.kind === "bar" ? <Bar part={p} squeeze={squeeze} dotted={connect} /> : <Dot part={p} />}
          </React.Fragment>
        );
      })}
    </>
  );
}

/* Quiet greys: everything that isn't yours or live. Heard one step darker than to come. */
const UPCOMING_FILL = "bg-border/70";
const HEARD_FILL = "bg-input";
const NUMBER = "absolute top-full mt-1 text-caption font-medium tabular-nums";

/** Plain dots and bars explain themselves on hover only; the row's screen-reader line already says it all. */
function Hint({ text, children }: { text: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** A folded stretch: a rounded bar thinner than the dots. Only the list's end shows a number. */
function Bar({
  part: p,
  squeeze,
  dotted,
  note,
}: {
  part: Extract<TrackPart, { kind: "bar" }>;
  squeeze?: boolean;
  dotted?: boolean;
  /** Added to the hover, e.g. "includes your 8, 12". */
  note?: string;
}) {
  const heard = p.state === "heard";
  return (
    <Hint text={`Items ${p.span?.from ?? p.from} to ${p.span?.to ?? p.to} · ${heard ? "Heard" : "Yet to be heard"}${note ? ` · ${note}` : ""}`}>
      <span aria-hidden="true" className={cn("relative flex h-4 flex-1 items-center", squeeze ? "min-w-6" : "min-w-8")}>
        {dotted ? (
          <DottedLine className={cn("h-1 w-full", heard ? "text-input" : "text-border")} />
        ) : (
          <span className={cn("h-0.75 w-full rounded-full", heard ? HEARD_FILL : UPCOMING_FILL)} />
        )}
        {p.startLabel ? <span className={cn(NUMBER, "left-0 text-muted-foreground")}>{p.from}</span> : null}
        {p.endLabel ? <span className={cn(NUMBER, "right-0 text-muted-foreground")}>{p.to}</span> : null}
      </span>
    </Hint>
  );
}

function Dot({ part: p }: { part: Extract<TrackPart, { kind: "dot" }> }) {
  const fill = p.state === "heard" ? HEARD_FILL : p.state === "now" ? "bg-success" : UPCOMING_FILL;
  const mark = (
    <span
      className={cn(
        "relative flex h-4 items-center justify-center",
        /* Plain dots give up width first, so a crowded court still fits its column. A numbered
           dot (1, the last) keeps its 16px, so its number never pokes past the line's end. */
        p.mine || p.state === "now" || p.label ? "w-4 shrink-0" : "w-4 min-w-2 shrink",
      )}
    >
      {p.mine ? (
        <Ring mine={p.mine} fill={fill} />
      ) : p.state === "now" ? (
        <LivePill item={p.item} />
      ) : (
        <span className={cn("relative size-2 rounded-full", fill)} />
      )}
      {p.label && !(p.state === "now" && !p.mine) ? (
        <span
          className={cn(
            NUMBER,
            p.mine ? (p.mine.pending ? "text-destructive-ink" : "text-success-ink") : "text-muted-foreground",
          )}
        >
          {p.item}
        </span>
      ) : null}
    </span>
  );

  if (p.mine) {
    const text = describe(p.item, p.state, p.mine);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            className="relative shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
          >
            {mark}
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Hint
      text={p.state === "now" ? `Happening now · Item ${p.item}` : `Item ${p.item} · ${p.state === "heard" ? "Heard" : "Yet to be heard"}`}
    >
      <span aria-hidden="true" className={cn("flex", p.state === "now" || p.label ? "shrink-0" : "min-w-2 shrink")}>
        {mark}
      </span>
    </Hint>
  );
}

/**
 * Your item: a 16px ring on the line (1.5 stroke), red with tasks pending, green when ready.
 * Inside: the item's own dot, or a small bookmark when the case is bookmarked.
 */
function Ring({ mine, fill }: { mine: HearingMine; fill: string }) {
  const tone = mine.pending ? "text-destructive" : "text-success";
  return (
    <span aria-hidden="true" className={cn("relative flex size-4 items-center justify-center", tone)}>
      <svg viewBox="0 0 16 16" className="absolute inset-0 size-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="8" cy="8" r="7.25" />
      </svg>
      {mine.bookmarked ? (
        <BookmarkIcon className="size-2 fill-current" strokeWidth={3} />
      ) : (
        <span className={cn("size-2 rounded-full", fill)} />
      )}
    </span>
  );
}

/**
 * Court name: up to two lines, then "…" with the full name on hover. The first line sits on the
 * dot line (caption's 16px line = the track's 16px line); a second line hangs below it, like the
 * numbers do, so row spacing never changes.
 */
export function CourtName({ name, said }: { name: string; said: string }) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const text = (
    <p ref={ref} className="line-clamp-2 text-caption font-semibold break-words text-muted-foreground">
      {name}
      <span className="sr-only">. {said}</span>
    </p>
  );
  /* Always the same tree, so the measured element never remounts; the tooltip just stays shut when not cut. */
  return (
    <Tooltip open={cut ? undefined : false}>
      <TooltipTrigger asChild>{text}</TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

/** The whole row in one sentence, for screen readers. */
export function courtSaid(c: CourtHearings, today = true) {
  return [
    c.now ? `Hearing item ${c.now} of ${c.last}.` : today ? `Not in session yet. ${c.last} items listed.` : `${c.last} items listed.`,
    `Your items: ${c.mine
      .map((m) => `${m.item}${m.bookmarked ? ", bookmarked" : ""}${m.pending ? `, ${pendingText(m.pending)}` : ""}`)
      .join("; ")}.`,
  ].join(" ");
}

export function describe(item: number, state: "heard" | "now" | "upcoming", m: HearingMine) {
  const when = state === "now" ? "Happening now" : state === "heard" ? "Heard" : null;
  return [`Your item ${item}`, when, m.bookmarked ? "Bookmarked case" : null, m.pending ? pendingText(m.pending) : null]
    .filter(Boolean)
    .join(" · ");
}

function pendingText(n: number) {
  return `${n} ${n === 1 ? "task" : "tasks"} pending`;
}
