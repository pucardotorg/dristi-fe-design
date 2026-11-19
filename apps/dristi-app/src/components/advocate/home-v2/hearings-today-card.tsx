"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon, CalendarXIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { RefreshIcon, useRefreshPhase } from "@/components/advocate/refresh-button";
import { advHome, fillCopy } from "@/lib/advocate/content";
import { type Locale, pick } from "@/lib/onboarding/content";
import { useLocale } from "@/components/shell/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type CourtHearings,
  type HearingMine,
  type TrackPart,
  cost,
  courtLine,
  courtStatus,
  hearingCount,
  isTomorrow,
  nextWorkingDay,
  orderCourts,
  shortDate,
} from "./hearings-today";

/** Courts shown before "Show N more courts". */
const SHOWN = 3;
/** While a court sits, the card refreshes itself this often (owner, 2026-11-19). */
const AUTO_REFRESH_MS = 2 * 60 * 1000;

type Day = "today" | "next";
type Dates = { today: string; next: string; /** The next working day is tomorrow. */ tomorrow: boolean };

/**
 * Card 1, draft 2: "Your hearings" (owner design 2026-11-18, lead designer review 2026-11-19).
 * One line per court, court name above it. Item 1, everything heard as one dotted line, the live
 * item as a green pill (pills line up on one column across courts), then the items to come with
 * yours as rings, ending on the list's last item.
 */
export function HearingsTodayCard({ courts: today, nextCourts }: { courts: CourtHearings[]; nextCourts: CourtHearings[] }) {
  const { locale } = useLocale();
  const [all, setAll] = React.useState(false);
  /* The title's day menu: today, or the next working day. That is called "Tomorrow" when it is
     tomorrow, and "Next working day" only when a weekend or holiday falls between. */
  const [day, setDay] = React.useState<Day>("today");
  const dates = React.useMemo<Dates>(() => {
    const now = new Date();
    const next = nextWorkingDay(now);
    return { today: shortDate(now), next: shortDate(next), tomorrow: isTomorrow(now, next) };
  }, []);
  /* Demo: refresh re-reads the same fixture; on main it reloads the day's hearings. */
  const [, setRefreshed] = React.useState(0);
  const ordered = React.useMemo(() => orderCourts(day === "today" ? today : nextCourts), [day, today, nextCourts]);
  const shown = all ? ordered : ordered.slice(0, SHOWN);
  const hidden = ordered.length - SHOWN;

  return (
    <Card variant="raised" role="region" aria-labelledby="home-hearings" className="min-w-0 gap-4">
      <CardHeader className="items-center">
        <CardTitle className="min-w-0">
          <h2 id="home-hearings" className="flex flex-wrap items-center gap-x-1 text-title-s font-semibold">
            Your hearings
            <DayMenu
              day={day}
              setDay={(d) => {
                setDay(d);
                setAll(false);
              }}
              dates={dates}
            />
          </h2>
          {/* Phones: the stat sits under the title; the header row has no room for it. */}
          <Stat courts={ordered} className="mt-2 sm:hidden" />
        </CardTitle>
        {/* Phones: the button sits on the title's line (self-start, nudged to centre on its 28px
            line); from sm up the whole row centres. Stat sits close to the button (owner). */}
        <CardAction className="row-span-1 flex items-center gap-1 self-start max-sm:mt-[-2px] sm:self-center">
          <Stat courts={ordered} className="max-sm:hidden" />
          <CardRefresh
            locale={locale}
            onRefresh={() => setRefreshed((n) => n + 1)}
            auto={day === "today" && ordered.some((c) => courtStatus(c) === "live" || courtStatus(c) === "done")}
          />
        </CardAction>
      </CardHeader>
      {/* The card keeps its 3-court height whatever the day holds (owner rule: card sizes never
          change with data), so a quiet day or an empty one never squishes it. 252px = 3 rows. */}
      <CardContent className="flex min-h-63 flex-col">
        {shown.length ? (
          <ul className="flex flex-col gap-12 pb-6">
            {shown.map((c) => (
              <CourtRow key={c.court} court={c} today={day === "today"} />
            ))}
          </ul>
        ) : (
          /* Same empty state as the Hearings home's empty day: DS Empty on a sunken panel. */
          <Empty className="mb-6 bg-surface-sunken">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarXIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>
                {day === "today" ? "No hearings today" : dates.tomorrow ? "No hearings tomorrow" : `No hearings on ${dates.next}`}
              </EmptyTitle>
              <EmptyDescription>None of your cases is listed in any court that day.</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
  /* Nothing to count on an empty day: the empty state says it. The line keeps its space (hidden),
     so the card's height stays the same on phones, where the stat sits under the title. */
  if (!n) return <p aria-hidden="true" className={cn("invisible text-caption", className)}>0</p>;
  return (
    <p className={cn("text-caption font-medium text-muted-foreground tabular-nums", className)}>
      {n} {n === 1 ? "hearing" : "hearings"} in {courts.length} {courts.length === 1 ? "court" : "courts"}
    </p>
  );
}

/**
 * The title's day, read as one sentence: "Your hearings today ⌄", "Your hearings tomorrow ⌄",
 * or, when a weekend or holiday falls between, "Your hearings on Mon, 23 Nov ⌄". Same size and
 * weight as the heading; the chevron sits in a small circle so the menu is easy to spot. The
 * menu names each day with its date, the chosen one ticked (DS radio item, as in the court switch).
 */
function DayMenu({ day, setDay, dates }: { day: Day; setDay: (d: Day) => void; dates: Dates }) {
  const nextName = dates.tomorrow ? "Tomorrow" : "Next working day";
  /* Phones drop the weekday ("on 23 Nov") so the title stays on one line. */
  const label =
    day === "today" ? (
      "today"
    ) : dates.tomorrow ? (
      "tomorrow"
    ) : (
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
function CardRefresh({ onRefresh, locale, auto }: { onRefresh: () => void; locale: Locale; auto: boolean }) {
  const [lastAt, setLastAt] = React.useState(() => Date.now());
  const { phase, trigger } = useRefreshPhase(() => {
    onRefresh();
    setLastAt(Date.now());
  });
  /* Auto-refresh while a court sits: quietly (no spin), skipped while the tab is hidden, and once
     on coming back to the tab. "Last refreshed" on hover shows when it last ran. */
  const latest = React.useRef(onRefresh);
  React.useEffect(() => {
    latest.current = onRefresh;
  });
  React.useEffect(() => {
    if (!auto) return;
    const run = () => {
      if (document.hidden) return;
      latest.current();
      setLastAt(Date.now());
    };
    const id = window.setInterval(run, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [auto]);
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

/* ── One court ────────────────────────────────────────────────────────────── */

/** A dot's room: a 16px slot plus the 8px gap after it. Fixed, so spacing matches on every row. */
const DOT_PITCH = 24;
const GAP = 8;

/** How many dots fit an element's real width; follows the card as it resizes. */
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

/**
 * A court: its name (with a "Not started" tag today, before it sits), then its line.
 * In session: [ 1 ····· heard ] (live) [ to come … last ]. The heard side is a quarter of the line
 * (a fifth on phones) on every row, so the live pills stack on one column. Before the court sits,
 * the line simply runs from item 1, like every other court's.
 */
/** The tag after a court's name, and what its hover says. None for a court with your items to come. */
const TAGS = {
  notStarted: { label: "Not started", hint: "Not in session yet", tone: "court" },
  /* About YOU, not the court (owner, 2026-11-19: "Done" read the same as "Finished"). Green with a
     tick, like a ready ring, so it can't be mistaken for the court's grey state tags. */
  done: { label: "Your items heard", hint: "All your items in this court are heard", tone: "you" },
  finished: { label: "Finished", hint: "This court has finished for the day", tone: "court" },
} as const;

function CourtRow({ court: c, today }: { court: CourtHearings; today: boolean }) {
  const [aheadRef, budget] = useBudget();
  const { heard, live, ahead, heardMine } = courtLine(c, budget ?? 18);
  const note = heardMine.length ? `includes your ${heardMine.join(", ")}` : undefined;
  const status = courtStatus(c);
  /* Not on the next working day: every court is not started then, so the tag would only repeat. */
  const tag = status === "live" || (status === "notStarted" && !today) ? null : TAGS[status];
  return (
    <li className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <CourtName name={c.court} said={courtSaid(c, today)} />
        {/* A small neutral tag right after the name; it never shrinks, a long name wraps beside it.
            20px tall, -my-0.5 keeps it centred on the 16px name line. */}
        {tag ? (
          <Hint text={tag.hint}>
            <Badge variant={tag.tone === "you" ? "success" : "secondary"} className="-my-0.5 h-5 px-1.5">
              {tag.tone === "you" ? <CheckIcon data-icon="inline-start" aria-hidden="true" /> : null}
              {tag.label}
            </Badge>
          </Hint>
        ) : null}
      </div>
      {status === "finished" ? (
        /* Finished: no live pill; the heard line runs the whole row, 1 to the last. */
        <div className="flex h-4 min-w-0 items-center">
          {heard.map((p, i) => (
            <React.Fragment key={p.kind === "bar" ? "heard" : p.item}>
              {i > 0 ? <span aria-hidden="true" className="h-px w-0.5 shrink-0" /> : null}
              {p.kind === "bar" ? <Fold part={p} note={note} /> : <Dot part={p} />}
            </React.Fragment>
          ))}
        </div>
      ) : live.item ? (
        <div className="flex h-4 min-w-0 items-center">
          <div className="flex h-4 w-1/4 min-w-0 shrink-0 items-center justify-end max-sm:w-1/5">
            {heard.map((p, i) => (
              <React.Fragment key={p.kind === "bar" ? "heard" : p.item}>
                {/* The dotted line runs right up to the dot at 1 (2px). */}
                {i > 0 ? <span aria-hidden="true" className="h-px w-0.5 shrink-0" /> : null}
                {p.kind === "bar" ? <Fold part={p} note={note} /> : <Dot part={p} />}
              </React.Fragment>
            ))}
          </div>
          {/* Same gap on every row (even with nothing heard yet), so the pills stay on one column. */}
          <span aria-hidden="true" className="h-px w-1.5 shrink-0" />
          <Live item={live.item} mine={live.mine} />
          <div ref={aheadRef} className="flex h-4 min-w-0 flex-1 items-center">
            <Stretch parts={ahead} budget={budget ?? 0} lead />
          </div>
        </div>
      ) : (
        <div ref={aheadRef} className="flex h-4 min-w-0 items-center">
          <Stretch parts={ahead} budget={budget ?? 0} />
        </div>
      )}
    </li>
  );
}

/**
 * A run of dots and dotted folds with fixed gaps: 8px between dots, 2px where a dotted line meets
 * a dot. A run with nothing folded spreads its dots to fill the row; one that cannot fit even at
 * its tightest (a narrow phone, many of your items) lets plain dots and gaps squeeze.
 */
function Stretch({
  parts,
  budget,
  lead,
}: {
  parts: TrackPart[];
  budget: number;
  /** Also draw the gap before the first part (it follows the live pill). */
  lead?: boolean;
}) {
  const spread = !parts.some((p) => p.kind === "bar");
  const squeeze = budget > 0 && cost(parts) > budget;
  return (
    <>
      {parts.map((p, i) => {
        const byFold = p.kind === "bar" || parts[i - 1]?.kind === "bar";
        return (
          <React.Fragment key={p.kind === "bar" ? `b${p.from}` : p.item}>
            {i > 0 || lead ? (
              <span
                aria-hidden="true"
                className={cn("h-px", spread ? "min-w-px flex-1" : byFold ? "w-0.5 shrink" : "w-2 shrink", squeeze && "min-w-0")}
              />
            ) : null}
            {p.kind === "bar" ? <Fold part={p} squeeze={squeeze} /> : <Dot part={p} />}
          </React.Fragment>
        );
      })}
    </>
  );
}

/** Pulse period. Every live pill keys its pulse to the page clock, so all courts pulse together. */
const PULSE_MS = 2400;

/** Starts an element's pulse at the page clock's zero, the same point every other pill uses. */
function pinPulse(el: HTMLElement | null) {
  el?.getAnimations().forEach((a) => {
    if (a.startTime !== 0) a.startTime = 0;
  });
}

/**
 * The live item: a green circle with its number inside and a slow pulse around it. 20px for one
 * or two digits, 24px for three; the slot stays a dot's 16px so spacing matches. When the item
 * being heard is yours, the pill gets your ring's colour around it (red pending, green ready)
 * and, like your other items, is a focusable button that names it.
 */
function Live({ item, mine }: { item: number; mine?: HearingMine }) {
  const ring = React.useRef<HTMLSpanElement>(null);
  /* On first load the pulse starts with the server-rendered page, before React can hear its
     start event, so sync once after mount too (next frame: the animation exists by then). */
  React.useEffect(() => {
    const id = requestAnimationFrame(() => pinPulse(ring.current));
    return () => cancelAnimationFrame(id);
  }, []);
  const size = String(item).length > 2 ? "size-6" : "size-5";
  const pill = (
    <span aria-hidden="true" className="relative flex size-4 shrink-0 items-center justify-center">
      <span
        /* Pin every pulse to the page clock's start, so all courts pulse together. Done each time
           the animation actually starts (first paint, a remount, a court shown later), not once on
           mount: on a remount the animation may not exist yet when an effect runs, and that pill
           then drifted out of step (seen on the first court, 2026-11-19). */
        ref={ring}
        onAnimationStart={(e) => pinPulse(e.currentTarget)}
        className={cn("absolute rounded-full bg-success motion-safe:animate-ping", size)}
        style={{ animationDuration: `${PULSE_MS}ms` }}
      />
      {/* 10px numeral, reviewed: an annotation inside a 20px marker, not screen copy; caption
          size filled the circle. Same call as the rail badge. ds-typography-allow */}
      <span
        className={cn(
          // ds-typography-allow (10px numeral, see above)
          "relative flex shrink-0 items-center justify-center rounded-full bg-success text-[10px] leading-none font-semibold text-success-foreground tabular-nums",
          size,
          mine && "outline-2 outline-offset-1",
          mine && (mine.pending ? "outline-destructive" : "outline-success"),
        )}
      >
        {item}
      </span>
    </span>
  );
  if (mine) {
    const text = describe(item, "now", mine);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={text} className="relative shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-focus-ring">
            {pill}
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Hint text={`Happening now · Item ${item}`}>
      <span className="relative flex shrink-0">{pill}</span>
    </Hint>
  );
}

/** A dotted line drawn as an SVG stroke with round caps: smooth, evenly spaced 1.5px dots. */
function DottedLine({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={className}>
      <svg className="block size-full overflow-visible" fill="none">
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="0 5" />
      </svg>
    </span>
  );
}

/* Quiet greys: everything that isn't yours or live. Heard one step darker than to come. */
const UPCOMING_FILL = "bg-border/70";
const HEARD_FILL = "bg-input";
const NUMBER = "absolute top-full mt-1 text-caption font-medium tabular-nums";

/** Plain dots and folds explain themselves on hover only; the row's screen-reader line already says it all. */
function Hint({ text, children }: { text: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** A folded stretch: a dotted line between two dots. Hover names the stretch it stands for. */
function Fold({
  part: p,
  squeeze,
  note,
}: {
  part: Extract<TrackPart, { kind: "bar" }>;
  squeeze?: boolean;
  /** Added to the hover, e.g. "includes your 8, 12". */
  note?: string;
}) {
  const heard = p.state === "heard";
  return (
    <Hint text={`Items ${p.span.from} to ${p.span.to} · ${heard ? "Heard" : "Yet to be heard"}${note ? ` · ${note}` : ""}`}>
      <span aria-hidden="true" className={cn("relative flex h-4 flex-1 items-center", squeeze ? "min-w-6" : "min-w-8")}>
        <DottedLine className={cn("h-1 w-full", heard ? "text-input" : "text-border")} />
      </span>
    </Hint>
  );
}

function Dot({ part: p }: { part: Extract<TrackPart, { kind: "dot" }> }) {
  const fill = p.state === "heard" ? HEARD_FILL : UPCOMING_FILL;
  const mark = (
    <span
      className={cn(
        "relative flex h-4 items-center justify-center",
        /* Plain dots give up width first, so a crowded court still fits its row. A numbered dot
           (1, the last, yours) keeps its 16px, so its number never pokes past the line's end. */
        p.mine || p.label ? "w-4 shrink-0" : "w-4 min-w-2 shrink",
      )}
    >
      {p.mine ? <Ring mine={p.mine} fill={fill} /> : <span className={cn("relative size-2 rounded-full", fill)} />}
      {p.label ? (
        <span className={cn(NUMBER, p.mine ? (p.mine.pending ? "text-destructive-ink" : "text-success-ink") : "text-muted-foreground")}>
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
          <button type="button" aria-label={text} className="relative shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-focus-ring">
            {mark}
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Hint text={`Item ${p.item} · ${p.state === "heard" ? "Heard" : "Yet to be heard"}`}>
      <span aria-hidden="true" className={cn("flex", p.label ? "shrink-0" : "min-w-2 shrink")}>
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
      {mine.bookmarked ? <BookmarkIcon className="size-2 fill-current" strokeWidth={3} /> : <span className={cn("size-2 rounded-full", fill)} />}
    </span>
  );
}

/**
 * Court name above its line: one line at every real width; as a safety net, two lines then "…"
 * with the full name on hover.
 */
function CourtName({ name, said }: { name: string; said: string }) {
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
function courtSaid(c: CourtHearings, today: boolean) {
  const status = c.finished
    ? `Finished for the day. All ${c.last} items heard.`
    : c.now
      ? `Hearing item ${c.now} of ${c.last}.`
      : today
        ? `Not in session yet. ${c.last} items listed.`
        : `${c.last} items listed.`;
  if (!c.mine.length) return status;
  const items = c.mine
    .map((m) => {
      const when = c.now && m.item === c.now ? ", happening now" : c.now && m.item < c.now ? ", heard" : "";
      return `${m.item}${when}${m.bookmarked ? ", bookmarked" : ""}${m.pending ? `, ${pendingText(m.pending)}` : ""}`;
    })
    .join("; ");
  return `${status} Your items: ${items}.`;
}

function describe(item: number, state: "heard" | "now" | "upcoming", m: HearingMine) {
  const when = state === "now" ? "Happening now" : state === "heard" ? "Heard" : null;
  return [`Your item ${item}`, when, m.bookmarked ? "Bookmarked case" : null, m.pending ? pendingText(m.pending) : null]
    .filter(Boolean)
    .join(" · ");
}

function pendingText(n: number) {
  return `${n} ${n === 1 ? "task" : "tasks"} pending`;
}
