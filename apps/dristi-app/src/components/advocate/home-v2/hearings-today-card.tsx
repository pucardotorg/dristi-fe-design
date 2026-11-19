"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon, CalendarXIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { RefreshIcon, useRefreshPhase } from "@/components/advocate/refresh-button";
import { advHome, fillCopy } from "@/lib/advocate/content";
import { type Locale, pick } from "@/lib/onboarding/content";
import { useLocale } from "@/components/shell/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PageOutcome } from "@/components/ui/outcome";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
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
  courtTimeline,
  hearingCount,
  type TimelineEntry,
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
          <Stat courts={ordered} className="mt-1 sm:hidden" />
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
          change with data), so a quiet day or an empty one never squishes it. Rows sit 48px apart
          on phones and 32px from tablets up (owner, 2026-11-19), so 3 rows = 264px / 220px (phones
          also keep 16px under each court name). */}
      {/* Phones: 8px more between the stat and the first court (owner, 2026-11-19), counted in
          the fixed height too (272px). */}
      <CardContent className="flex min-h-68 flex-col max-sm:pt-2 sm:min-h-59">
        {shown.length ? (
          <ul className="flex flex-col gap-12 pb-6 sm:gap-8">
            {shown.map((c) => (
              <CourtRow key={c.court} court={c} today={day === "today"} />
            ))}
          </ul>
        ) : (
          /* The DS's neutral outcome: "nothing to do, nothing wrong" (feedback-states rule), flat,
             no glow, the act's own icon. Still: an empty day is a state, not an event, so it
             doesn't replay its entrance each time you switch day. Centred in the card's
             fixed height (owner, 2026-11-19). */
          <div className="flex flex-1 items-center justify-center pb-6">
            <PageOutcome
              tone="neutral"
              icon={CalendarXIcon}
              as="p"
              still
              title={day === "today" ? "No hearings today" : dates.tomorrow ? "No hearings tomorrow" : `No hearings on ${dates.next}`}
              body="None of your cases is listed in any court that day."
              /* Inside a card its page-size title (24px) would outshout the card's own 20px
                 heading, so it steps down to body size here. */
              className="py-0 [&_p:first-of-type]:text-body"
            />
          </div>
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
    /* Kept fractional: courtLine folds in whole dots but checks B1's crowded rows exactly. */
    const measure = () => setBudget(Math.max(6, (el.clientWidth + GAP) / DOT_PITCH));
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
  /* Each heard stretch names the items of yours folded inside it. */
  const noteFor = (p: Extract<TrackPart, { kind: "bar" }>) => {
    const inside = heardMine.filter((i) => i >= p.span.from && i <= p.span.to);
    return inside.length ? `includes your ${inside.join(", ")}` : undefined;
  };
  const status = courtStatus(c);
  /* Not on the next working day: every court is not started then, so the tag would only repeat. */
  const tag = status === "live" || (status === "notStarted" && !today) ? null : TAGS[status];
  /* Touch (any coarse pointer, tablets included): dots are 24px apart, too close to tap one by one,
     so the whole row is one tap target that opens the court's drawer, where every hover is written
     out. Mouse keeps the hovers. */
  const fine = useMediaQuery("(pointer: fine)");
  const [open, setOpen] = React.useState(false);
  return (
    /* Phones: 16px between the court name and its line (owner, 2026-11-19); 12px from tablets up. */
    /* Tablets up: 8px on top of the 32px gap, so courts sit 40px apart (owner trial, 2026-11-19;
       40 isn't a ladder step, so it's built from two that are). */
    <li className="relative flex min-w-0 flex-col gap-4 sm:gap-3 sm:not-first:pt-2">
      {fine ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${c.court}: details`}
          className="absolute -inset-x-2 -inset-y-2 z-10 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-focus-ring active:bg-accent/40"
        />
      )}
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
        {/* Touch: a chevron says the row opens. */}
        {fine ? null : <ChevronRightIcon aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted-foreground" />}
      </div>
      {fine ? null : <CourtSheet court={c} today={today} open={open} onOpenChange={setOpen} />}
      {status === "finished" ? (
        /* Finished: no live pill; the heard line runs the whole row, 1 to the last. Measured, so
           its in-between dots match the room it has. */
        <div ref={aheadRef} className="flex h-4 min-w-0 items-center">
          {heard.map((p, i) => (
            <React.Fragment key={partKey(p)}>
              {i > 0 ? <span aria-hidden="true" className="h-px w-0.5 shrink-0" /> : null}
              {p.kind === "bar" ? <Fold part={p} note={noteFor(p)} /> : p.kind === "dot" ? <Dot part={p} /> : null}
            </React.Fragment>
          ))}
        </div>
      ) : live.item ? (
        <div className="flex h-4 min-w-0 items-center">
          <div className="flex h-4 w-1/4 min-w-0 shrink-0 items-center justify-end max-sm:w-1/5">
            {heard.map((p, i) => (
              <React.Fragment key={partKey(p)}>
                {/* The dotted line runs right up to the dot at 1 (2px). */}
                {i > 0 ? <span aria-hidden="true" className="h-px w-0.5 shrink-0" /> : null}
                {p.kind === "bar" ? <Fold part={p} note={noteFor(p)} /> : p.kind === "dot" ? <Dot part={p} /> : null}
              </React.Fragment>
            ))}
          </div>
          {/* Same gap on every row (even with nothing heard yet), so the pills stay on one column. */}
          <span aria-hidden="true" className="h-px w-1.5 shrink-0" />
          <Live item={live.item} mine={live.mine} />
          <div ref={aheadRef} className="flex h-4 min-w-0 flex-1 items-center">
            <Stretch parts={ahead} budget={budget ?? 0} court={c} lead />
          </div>
        </div>
      ) : (
        <div ref={aheadRef} className="flex h-4 min-w-0 items-center">
          <Stretch parts={ahead} budget={budget ?? 0} court={c} />
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
  court,
  lead,
}: {
  parts: TrackPart[];
  budget: number;
  court: CourtHearings;
  /** Also draw the gap before the first part (it follows the live pill). */
  lead?: boolean;
}) {
  const spread = !parts.some((p) => p.kind === "bar");
  const squeeze = budget > 0 && cost(parts) > Math.floor(budget);
  return (
    <>
      {parts.map((p, i) => {
        const prev = parts[i - 1];
        /* A dotted line runs up to the dots it joins (2px); a tight gap sits flush between two rings. */
        const byFold = p.kind === "bar" || prev?.kind === "bar" || prev?.kind === "more";
        const byTight = (p.kind === "bar" && p.tight) || (prev?.kind === "bar" && prev.tight);
        return (
          <React.Fragment key={partKey(p)}>
            {(i > 0 || lead) && !byTight ? (
              <span
                aria-hidden="true"
                className={cn("h-px", spread ? "min-w-px flex-1" : byFold ? "w-0.5 shrink" : "w-2 shrink", squeeze && "min-w-0")}
              />
            ) : null}
            {p.kind === "bar" ? (
              <Fold part={p} squeeze={squeeze} />
            ) : p.kind === "more" ? (
              <More part={p} court={court} />
            ) : (
              <Dot part={p} />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

function partKey(p: TrackPart) {
  return p.kind === "dot" ? `d${p.item}` : `${p.kind}${p.from}`;
}

/**
 * "+N": your items that don't fit a crowded row (phones, mostly). Red if any of them has tasks
 * pending, green otherwise, like a ring. Then a dotted line on to the list's last item.
 * Tap (touch) opens a bottom drawer listing them; with a mouse, a click opens a small popover.
 * Both show the same list (owner, 2026-11-19).
 */
function More({ part: p, court }: { part: Extract<TrackPart, { kind: "more" }>; court: CourtHearings }) {
  const fine = useMediaQuery("(pointer: fine)");
  const pending = p.mine.some((m) => m.pending);
  const label = `${p.mine.length} more of your items: ${p.mine.map((m) => m.item).join(", ")}`;
  const look = cn(
    "relative flex h-5 shrink-0 items-center rounded-full px-1.5 text-caption font-semibold tabular-nums",
    pending ? "bg-destructive-muted text-destructive-ink" : "bg-success-muted text-success-ink",
  );
  const line = (
    <>
      <span aria-hidden="true" className="h-px w-0.5 shrink-0" />
      <span aria-hidden="true" className="relative flex h-4 min-w-6 flex-1 items-center">
        <DottedLine className="h-1 w-full text-border" />
      </span>
    </>
  );
  /* Touch: just the chip; tapping the row opens the court's drawer, which lists these too. */
  if (!fine) {
    return (
      <>
        <span aria-hidden="true" className={look}>
          +{p.mine.length}
        </span>
        {line}
      </>
    );
  }
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={label} className={cn(look, "outline-none focus-visible:ring-3 focus-visible:ring-focus-ring")}>
            +{p.mine.length}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <PopoverHeader>
            <PopoverTitle>{p.mine.length} more of your items</PopoverTitle>
            <PopoverDescription>{courtWhere(court)}</PopoverDescription>
          </PopoverHeader>
          <MineList mine={p.mine} court={court} />
        </PopoverContent>
      </Popover>
      {line}
    </>
  );
}

/** "Sessions Court · on item 30 of 70" and the like. */
function courtWhere(c: CourtHearings) {
  return c.finished ? `${c.court} · finished` : c.now ? `${c.court} · on item ${c.now} of ${c.last}` : `${c.court} · not started`;
}

/**
 * Touch: the court's drawer. Everything the hovers say on desktop, written out: where the court
 * is, each of your items with its ring and state, and the rest of the list in one line.
 */
function CourtSheet({
  court: c,
  today,
  open,
  onOpenChange,
}: {
  court: CourtHearings;
  today: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const status = courtStatus(c);
  const tag = status === "live" || (status === "notStarted" && !today) ? null : TAGS[status];
  /* Owner, 2026-11-19: no summary line; the line itself says where the court is. The header
     counts only your hearings here. */
  const yours = `Your ${c.mine.length} ${c.mine.length === 1 ? "hearing" : "hearings"}`;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* Fixed at three quarters of the screen whatever the court (owner, 2026-11-19); the line
          scrolls between the pinned header and footer. */}
      <DrawerContent style={{ height: "75dvh", paddingBottom: "calc(var(--spacing) * 4 + env(safe-area-inset-bottom))" }}>
        <DrawerHeader className="flex-row items-start justify-between gap-3 text-left">
          <div className="flex min-w-0 items-start gap-2">
            <DrawerTitle className="text-left">{c.court}</DrawerTitle>
            {tag ? (
              <Badge variant={tag.tone === "you" ? "success" : "secondary"} className="h-5 px-1.5">
                {tag.tone === "you" ? <CheckIcon data-icon="inline-start" aria-hidden="true" /> : null}
                {tag.label}
              </Badge>
            ) : null}
          </div>
          <DrawerDescription className="shrink-0 pt-0.5 text-right tabular-nums">{yours}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4">
          <CourtTimeline court={c} />
        </div>
        <DrawerFooter>
          <Button asChild variant="outline">
            <Link href="/advocate">
              Go to Hearings
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Your items as rows: the ring, the item, what it needs, and where it stands in the list. */
function MineList({ mine, court: c }: { mine: HearingMine[]; court: CourtHearings }) {
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {mine.map((m) => {
        const heard = Boolean(c.finished) || (c.now > 0 && m.item < c.now);
        const live = !c.finished && c.now > 0 && m.item === c.now;
        /* Items still to be heard before yours: the live one counts as being heard already. */
        const away = c.now ? m.item - c.now - 1 : m.item - 1;
        const state = heard ? "Heard" : live ? "Happening now" : m.pending ? pendingText(m.pending) : "Ready";
        const extra = [live && m.pending ? pendingText(m.pending) : null, m.bookmarked ? "Bookmarked case" : null];
        return (
          <li key={m.item} className="flex items-center gap-3 py-3">
            <Ring mine={m} fill={heard ? HEARD_FILL : UPCOMING_FILL} heard={heard} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-compact font-medium tabular-nums">Item {m.item}</span>
              <span
                className={cn(
                  "text-caption",
                  !heard && m.pending ? "text-destructive-ink" : live ? "text-success-ink" : "text-muted-foreground",
                )}
              >
                {[state, ...extra].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
              {heard ? "" : live ? "Now" : away === 0 ? "Next" : `${away} ${away === 1 ? "item" : "items"} before it`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Pulse period. Every live pill keys its pulse to the page clock, so all courts pulse together. */
const PULSE_MS = 2400;

/**
 * The drawer's live mark: a small green dot with the same synced pulse, ringed in your colour when
 * it's yours. Its number sits in the drawer's left column, so the dot doesn't repeat it.
 */
function LiveDot({ mine }: { mine?: HearingMine }) {
  const ring = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => pinPulse(ring.current));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span aria-hidden="true" className="relative flex size-4 items-center justify-center">
      <span
        ref={ring}
        onAnimationStart={(ev) => pinPulse(ev.currentTarget)}
        /* Starts 20px wide, so it pulses out past the ring around a dot of yours. */
        className="absolute size-5 rounded-full bg-success motion-safe:animate-ping"
        style={{ animationDuration: `${PULSE_MS}ms` }}
      />
      <span
        className={cn(
          "relative size-3 rounded-full bg-success",
          mine && "outline-2 outline-offset-2",
          mine && (mine.pending ? "outline-destructive" : "outline-success"),
        )}
      />
    </span>
  );
}

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
          mine && "outline-2 outline-offset-2",
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

/**
 * Touch drawer: the card's line turned on its side (owner, 2026-11-19). The same marks (plain
 * dots at 1 and the end, the live pill, your rings, grey once heard) on a dotted rail, dark where
 * heard and light to come; every gap says how many items it holds. Text sits beside each mark.
 */
function CourtTimeline({ court: c }: { court: CourtHearings }) {
  const entries = courtTimeline(c);
  /* A rail segment is heard when the entry it leads into is heard (or is the live one). */
  const heardOf = (e?: TimelineEntry) => (e ? e.heard || (e.kind === "point" && e.role === "live") : false);
  /* Three columns (owner, 2026-11-19): numbers and gap counts on the left, the line, words on the right. */
  const LEFT = "w-28 shrink-0 text-right tabular-nums";
  return (
    /* A short line stretches its gaps to fill the drawer's fixed height (owner, 2026-11-19). */
    <ol className="flex flex-1 flex-col pb-2">
      {entries.map((e, i) => {
        const before = entries[i - 1];
        const after = entries[i + 1];
        /* The rail fills its slot without giving the SVG a height of its own (it would default to 150px). */
        const rail = (heard: boolean) => (
          <span className="relative min-h-0 w-1 flex-1">
            <DottedLine vertical className={cn("absolute inset-0", heard ? "text-muted-foreground" : "text-border")} />
          </span>
        );
        if (e.kind === "gap") {
          const n = e.to - e.from + 1;
          return (
            <li key={`g${e.from}`} className="flex min-h-8 grow gap-3">
              <p className={cn(LEFT, "self-center py-1 text-caption text-muted-foreground")}>
                {/* "to come" read as if these were yours (owner, 2026-11-19): they are the others in between. */}
                {n} {n === 1 ? "item" : "items"} {e.heard ? "heard" : "in between"}
              </p>
              <div aria-hidden="true" className="flex w-6 shrink-0 flex-col items-center">
                {rail(e.heard)}
              </div>
            </li>
          );
        }
        const yours = Boolean(e.mine);
        const live = e.role === "live";
        const title = live ? "Happening now" : yours ? "Yours" : e.role === "first" ? "First item" : "Last item";
        /* Only tasks pending is red; everything else in the caption stays grey. */
        const notes: { text: string; red?: boolean }[] = [];
        if (e.heard && yours) notes.push({ text: "Heard" });
        if (live && yours) notes.push({ text: "Yours" });
        if (!e.heard && e.mine?.pending) notes.push({ text: pendingText(e.mine.pending), red: true });
        if (e.mine?.bookmarked) notes.push({ text: "Bookmarked case" });
        const numberTone = live
          ? "text-success-ink"
          : yours && !e.heard
            ? e.mine!.pending
              ? "text-destructive-ink"
              : "text-success-ink"
            : "text-muted-foreground";
        return (
          <li key={`p${e.item}`} className="flex gap-3">
            {/* Number, mark and title share one 24px line, 12px from the row's top (under the rail stub). */}
            <p className={cn(LEFT, "mt-3 flex h-6 items-center justify-end text-body-compact", yours || live ? "font-semibold" : "font-medium", numberTone)}>
              {e.item}
            </p>
            <div aria-hidden="true" className="flex w-6 shrink-0 flex-col items-center">
              <span className="flex h-3 w-1 flex-col">{before ? rail(heardOf(e)) : null}</span>
              <span className="flex size-6 items-center justify-center">
                {live ? (
                  <LiveDot mine={e.mine} />
                ) : e.mine ? (
                  <Ring mine={e.mine} fill={e.heard ? HEARD_FILL : UPCOMING_FILL} heard={e.heard} large />
                ) : (
                  <span className={cn("size-2.5 rounded-full", e.heard ? HEARD_FILL : UPCOMING_FILL)} />
                )}
              </span>
              <span className="flex w-1 flex-1 flex-col">{after ? rail(heardOf(after)) : null}</span>
            </div>
            <div className="flex min-w-0 flex-col pt-3 pb-2">
              <span
                className={cn(
                  "flex h-6 items-center text-body-compact",
                  live ? "font-semibold text-success-ink" : yours ? "font-semibold" : "font-medium text-muted-foreground",
                )}
              >
                {title}
              </span>
              {notes.length ? (
                <span className="text-caption text-muted-foreground">
                  {notes.map((n, k) => (
                    <React.Fragment key={n.text}>
                      {k > 0 ? " · " : null}
                      <span className={n.red ? "text-destructive-ink" : undefined}>{n.text}</span>
                    </React.Fragment>
                  ))}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
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
      <span
        aria-hidden="true"
        className={cn("relative flex h-4 items-center", p.tight ? "w-2 shrink-0" : cn("flex-1", squeeze ? "min-w-6" : "min-w-8"))}
      >
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
      {p.mine ? <Ring mine={p.mine} fill={fill} heard={p.state === "heard"} /> : <span className={cn("relative size-2 rounded-full", fill)} />}
      {p.label ? (
        <span className={cn(NUMBER, p.mine && p.state !== "heard" ? (p.mine.pending ? "text-destructive-ink" : "text-success-ink") : "text-muted-foreground")}>
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
function Ring({ mine, fill, heard, large }: { mine: HearingMine; fill: string; heard?: boolean; large?: boolean }) {
  /* Heard (a finished court): grey, still marked as yours, no longer asking anything of you. */
  const tone = heard ? "text-muted-foreground" : mine.pending ? "text-destructive" : "text-success";
  /* `large`: the drawer's 20px ring with a 10px dot or bookmark inside (owner, 2026-11-19: the
     bookmark was hard to see at 8px); the card keeps 16px. */
  const inner = large ? "size-2.5" : "size-2";
  return (
    <span aria-hidden="true" className={cn("relative flex items-center justify-center", large ? "size-5" : "size-4", tone)}>
      <svg viewBox={large ? "0 0 20 20" : "0 0 16 16"} className="absolute inset-0 size-full" fill="none" stroke="currentColor" strokeWidth={1.5}>
        {large ? <circle cx="10" cy="10" r="9.25" /> : <circle cx="8" cy="8" r="7.25" />}
      </svg>
      {mine.bookmarked ? (
        <BookmarkIcon className={cn(inner, "fill-current")} strokeWidth={3} />
      ) : (
        <span className={cn(inner, "rounded-full", fill)} />
      )}
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
