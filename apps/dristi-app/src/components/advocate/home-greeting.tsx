"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/onboarding/content";
import { advHome, fillCopy } from "@/lib/advocate/content";
import { pick } from "@/lib/onboarding/content";
import { dayKeyOf, type WeekCell } from "@/lib/advocate/home";
import { cn } from "@/lib/utils";
import { RollingNumber } from "@/components/advocate/rolling-day";
import { DateScrubber } from "@/components/advocate/date-scrubber";
import { CONTROL_REVEAL } from "@/components/chrome/motion";

/**
 * Greeting and the week strip. The strip is the board's day control: brand tint
 * marks *today*, a chosen other day gets the quiet sunken cue — the two never
 * read alike. Chevrons page the strip a week at a time, and the calendar
 * popover jumps straight to a date, so the board is not fenced into one week.
 * Dots under a day: amber for a task consequence, grey for a listed hearing.
 */

function greetingCopy(hour: number) {
  if (hour < 12) return advHome.greetingMorning;
  if (hour < 17) return advHome.greetingAfternoon;
  return advHome.greetingEvening;
}

function mattersLine(locale: Locale, count: number): string {
  if (count === 0) return pick(advHome.mattersNone, locale);
  if (count === 1) return pick(advHome.mattersOne, locale);
  return fillCopy(advHome.mattersMany, locale, { n: String(count) });
}

/** The amber dot's referent, in words — "3 tasks due". */
function dueLine(locale: Locale, count: number): string {
  return count === 1
    ? pick(advHome.dueOne, locale)
    : fillCopy(advHome.dueMany, locale, { n: String(count) });
}

function dayNote(cell: WeekCell, locale: Locale): string {
  const parts: string[] = [];
  if (cell.hearings) parts.push(mattersLine(locale, cell.hearings));
  if (cell.due) parts.push(dueLine(locale, cell.due));
  return parts.length ? parts.join(" · ") : pick(advHome.mattersNone, locale);
}

export function HomeGreeting({
  locale,
  firstName,
  court = null,
  now,
  week,
  selectedDay,
  onSelectDay,
  onShiftWeek,
  onPickDate,
  actions,
}: {
  locale: Locale;
  firstName: string;
  /** The deployment's one court, named in the title; null where there are several. */
  court?: string | null;
  now: number;
  week: WeekCell[];
  selectedDay: string;
  onSelectDay: (key: string, animate?: boolean) => void;
  /** Page the strip by whole weeks; ±1. */
  onShiftWeek: (delta: number) => void;
  onPickDate: (date: Date, animate?: boolean) => void;
  /** The day's actions (cause list, join, refresh), drawn at the header's right on a desktop. */
  actions?: React.ReactNode;
}) {
  const stripRef = React.useRef<HTMLUListElement>(null);
  const shiftWeek = (delta: number, pointer: boolean) => {
    onShiftWeek(delta);
    if (pointer && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stripRef.current?.getAnimations().forEach(animation => animation.cancel());
      stripRef.current?.animate(
        [{ transform: `translateX(${delta * 24}%)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }],
        { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    }
  };
  const nowDate = new Date(now);
  const intl = locale === "ml" ? "ml-IN" : "en-IN";
  const selected = week.find((c) => c.key === selectedDay);
  // One open state per calendar button. They used to share one, so a click
  // opened both popovers (the phone one hidden) and each closed the other as an
  // outside click: the desktop calendar never stayed open.
  const [pickerOpen, setPickerOpen] = React.useState<"desk" | "phone" | null>(null);
  const [scrubbing, setScrubbing] = React.useState({ open: false, instant: false });
  const onScrubReveal = React.useCallback((open: boolean, instant: boolean) => {
    setScrubbing({ open, instant });
  }, []);
  // "Today" earns its place only when the view has left today — either another
  // day is selected, or the strip is paged to a week that does not hold today.
  const todayKey = dayKeyOf(now);
  const awayFromToday =
    selectedDay !== todayKey || !week.some((cell) => cell.today);
  const dateLine = new Intl.DateTimeFormat(intl, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(selected?.at ?? new Date(`${selectedDay}T12:00:00`));
  const weekdayFmt = new Intl.DateTimeFormat(intl, { weekday: "short" });
  const selectedAt = selected?.at ?? new Date(`${selectedDay}T12:00:00`);
  const viewingToday = selectedDay === todayKey;

  // Which way the big day number rolls: up when the day moves later, down when
  // it moves earlier. Read off the last day shown, held in state so the render
  // that receives a new day can compare against it.
  const [shownDay, setShownDay] = React.useState(selectedDay);
  const [rollUp, setRollUp] = React.useState(true);
  if (shownDay !== selectedDay) {
    setShownDay(selectedDay);
    setRollUp(selectedDay > shownDay);
  }

  const picker = (which: "desk" | "phone", className: string, iconClassName: string) => (
    <Popover open={pickerOpen === which} onOpenChange={(open) => setPickerOpen(open ? which : null)}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={pick(advHome.pickDate, locale)}
          className={className}
        >
          <CalendarDays aria-hidden="true" className={iconClassName} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" collisionPadding={16} className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedAt}
          onSelect={(date, _trigger, _modifiers, event) => {
            if (!date) return;
            setPickerOpen(null);
            onPickDate(date, event.type === "click" && event.detail > 0);
          }}
        />
      </PopoverContent>
    </Popover>
  );

  const monthYear = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" })
    .formatToParts(selectedAt)
    .filter((part) => part.type === "month" || part.type === "year")
    .map((part) => part.value)
    .join(", ");
  const weekdayLong = new Intl.DateTimeFormat(intl, { weekday: "long" }).format(selectedAt);

  // Phone and upright tablet: the greeting is the heading, the date under it,
  // and the week strip below. Desktop: the big date (month above, weekday below,
  // arrows either side), a hairline, then the greeting and the board's title.
  // Brand tint on the date and month means "today", as it does on the strip.
  const shiftDay = (delta: number, pointer: boolean) =>
    onPickDate(new Date(selectedAt.getTime() + delta * 24 * 60 * 60 * 1000), pointer);
  const dayArrow = "relative size-6 text-muted-foreground after:absolute after:-inset-2";

  const title = court
    ? fillCopy(advHome.hearingsInCourt, locale, { court })
    : pick(advHome.hearingsForDay, locale);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-0">
      {/* Desktop: the selected day as a big date in a white box, stepped a day
          at a time by the arrows either side of it, with a hairline parting it
          from the greeting. It replaces the week strip on a desktop. */}
      <div className="hidden items-center lg:flex">
        <div className="date-scrubber-column flex min-w-0 flex-1 flex-col items-center">
          {/* ds-typography-allow: owner asked for the month a step under caption (11px). */}
          <p className={cn("text-[0.6875rem] leading-4 font-semibold tracking-wide uppercase", viewingToday ? "text-brand-muted-foreground" : "text-muted-foreground")}>{monthYear}</p>
          <div className="relative mt-2 flex items-center gap-1.5">
            <Button variant="ghost" size="icon" aria-label={pick(advHome.prevDay, locale)} onClick={(event) => shiftDay(-1, event.detail > 0)} className={dayArrow}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Button>
            {/* A fixed square, so the number can change size without the box moving. */}
            <DateScrubber
              selectedDay={selectedDay}
              todayKey={todayKey}
              locale={locale}
              dateLine={dateLine}
              onPickDate={onPickDate}
              onOpenCalendar={() => setPickerOpen("desk")}
              onRevealChange={onScrubReveal}
            >
              {/* ds-typography-allow: owner asked for the date larger than the DS display role (48px) as the header's lead element. */}
              <RollingNumber value={String(selectedAt.getDate()).padStart(2, "0")} up={rollUp} className="text-[3.5rem] leading-none font-semibold tracking-tight" />
              <span className="sr-only">{dateLine}</span>
            </DateScrubber>
            <Button variant="ghost" size="icon" aria-label={pick(advHome.nextDay, locale)} onClick={(event) => shiftDay(1, event.detail > 0)} className={dayArrow}>
              <ChevronRight aria-hidden="true" className="size-5" />
            </Button>
            {/* Drawn at 32px; the ::after keeps the 40px hit area. */}
            {picker("desk", "absolute left-full ml-2 size-8 border border-hairline text-muted-foreground after:absolute after:-inset-1", "size-4")}
          </div>
          {/* Keep the weekday's space reserved while its label fades away. */}
          <div className="relative mt-1 flex h-8 w-full items-center justify-center">
            <span
              aria-hidden="true"
              className="date-scrubber-weekday inline-block text-body-compact"
              data-scrubbing={scrubbing.open}
              data-instant={scrubbing.instant}
              style={{ "--scrub-fade-duration": `${CONTROL_REVEAL.fadeDuration}ms`, "--scrub-easing": CONTROL_REVEAL.easing } as React.CSSProperties}
            >{weekdayLong}</span>
          </div>
        </div>
        {/* Level with the white box (it sits 24px under the column's top). */}
        <span aria-hidden="true" className="mt-6 ml-16 h-18 w-px self-start bg-hairline" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex max-w-full min-w-0 flex-col gap-1 lg:hidden">
          {/* The desktop's order: a quiet greeting, the title leading, then the
              date small beneath it. */}
          <p className="text-body text-muted-foreground">
            {fillCopy(greetingCopy(nowDate.getHours()), locale, { name: firstName })}
          </p>
          <h1 className="text-title font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {/* The week strip's per-day dot carries its own text equivalent
              through the tooltip and the sr-only line below. */}
          <p className="text-body-compact text-muted-foreground">{dateLine}</p>
        </div>
        {/* Below container 3xl, the title cannot share its line even
            with icon-only actions. Give it the row instead of squeezing it. */}
        {/* ds-spacing-allow: 28px centres the 64px greeting on the 72px date box, which sits 24px under the column's top. */}
        <div className="hidden min-w-0 grid-cols-1 items-end gap-4 lg:mt-7 lg:grid lg:pl-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body text-muted-foreground">
            {fillCopy(greetingCopy(nowDate.getHours()), locale, { name: firstName })}
          </p>
          {/* ds-typography-allow: owner asked for the title a step under title-l (28px) so the actions keep its row beside the tasks panel. */}
          <h1 className="text-[1.75rem] leading-9 font-semibold tracking-tight text-balance">
            {title}
          </h1>
        </div>
        {/* The pending-tasks side tab, out on the screen's right edge. */}
        {actions ? <div className="self-center justify-self-end lg:-mr-6">{actions}</div> : null}
        </div>

        <div className="-mx-4 grid self-stretch grid-cols-[auto_auto_1fr_auto] items-center gap-x-0 gap-y-1 min-[360px]:grid-cols-9 lg:hidden">
        {/* The jump-to-date control sits with the week strip it drives on a phone
            or upright tablet. On a desktop it moves beside the weekday under the
            big date. */}
        {/* Drawn at 32px on a phone; the ::after keeps the 40px touch target. */}
        {picker(
          "phone",
          "relative col-start-4 row-start-2 mr-4 size-8 justify-self-end border border-border text-muted-foreground after:absolute after:-inset-1 min-[360px]:col-start-9 lg:hidden",
          "size-4.5"
        )}

        {/* The rule and Today run the full width and stop a fixed 8px short of the
            calendar button, so the pair sits together whatever the column width (a
            tablet's ninth column is far wider than a phone's). The band passes
            clicks through to the calendar beneath its right padding. */}
        <div className="pointer-events-none col-start-3 row-start-2 flex min-w-0 items-center gap-2 px-4 min-[360px]:col-span-9 min-[360px]:col-start-1 min-[360px]:pr-12 lg:hidden">
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-hairline" />
          {/* Drawn to the calendar button's height and stroke so the row keeps its
              height when this appears; the ::after keeps the 40px touch target. */}
          {awayFromToday ? (
            <Button variant="outline" size="sm" className="pointer-events-auto relative h-8 shrink-0 border-border after:absolute after:-inset-1 min-[360px]:mr-2" onClick={(event) => onPickDate(nowDate, event.detail > 0)}>
              {pick(advHome.today, locale)}
            </Button>
          ) : null}
        </div>

        {awayFromToday ? (
          <Button
            variant="outline"
            size="xs"
            onClick={(event) => onPickDate(nowDate, event.detail > 0)}
            className="hidden lg:mr-0.5 lg:inline-flex"
          >
            {pick(advHome.today, locale)}
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={pick(advHome.prevWeek, locale)}
          onClick={(event) => shiftWeek(-1, event.detail > 0)}
          // Centred in its column, as the next-week arrow is, so both sit the same
          // distance from the day beside them.
          className={cn("col-start-1 row-start-2 size-10 text-muted-foreground min-[360px]:row-start-1 min-[360px]:justify-self-center lg:size-9", !awayFromToday && "lg:-ml-2")}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Button>
        <ul ref={stripRef} className="col-span-4 col-start-1 row-start-1 flex min-w-0 gap-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[360px]:col-span-7 min-[360px]:col-start-2 lg:flex-1 lg:overflow-visible lg:items-center lg:gap-1">
          {week.map((cell) => {
            const isSelected = cell.key === selectedDay;
            return (
              <li key={cell.key} className="min-w-0 flex-1">
                {/* The dots mean by colour. The tooltip hands a sighted reader
                    the same sentence the `sr-only` line has always carried. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={(event) => onSelectDay(cell.key, event.detail > 0)}
                      className={cn(
                        "flex min-h-12 w-full min-w-10 flex-col items-center justify-center gap-0 rounded-lg py-1 lg:h-16 lg:gap-0.5 lg:py-1 transition-colors active:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-w-0",
                        // Brand tint means "today", not "selected" — a chosen day
                        // elsewhere in the week gets a neutral cue instead.
                        cell.today
                          ? "bg-brand-muted text-brand-muted-foreground"
                          : isSelected
                            ? "bg-accent-strong text-foreground"
                            : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <span className="text-caption lg:text-body-compact">
                        {weekdayFmt.format(cell.at)}
                      </span>
                      <span
                        className={cn(
                          "text-body-compact tabular-nums lg:text-title-s lg:font-semibold",
                          (cell.today || isSelected) && "font-semibold"
                        )}
                      >
                        {cell.at.getDate()}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1 rounded-full",
                          cell.due
                            ? "bg-warning-ink"
                            : cell.hearings
                              ? "bg-muted-foreground"
                              : "bg-transparent"
                        )}
                      />
                      <span className="sr-only">
                        {weekdayFmt.format(cell.at)} {cell.at.getDate()}
                        {cell.today ? ` (${pick(advHome.today, locale)})` : ""} —{" "}
                        {dayNote(cell, locale)}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{dayNote(cell, locale)}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={pick(advHome.nextWeek, locale)}
          onClick={(event) => shiftWeek(1, event.detail > 0)}
          className="col-start-2 row-start-2 size-10 text-muted-foreground min-[360px]:col-start-9 min-[360px]:row-start-1 min-[360px]:justify-self-center lg:-mr-1 lg:size-9"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </Button>

        {selected ? <p className="sr-only" aria-live="polite">{dayNote(selected, locale)}</p> : null}
        </div>
      </div>
    </div>
  );
}
