"use client";

import * as React from "react";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import { CONTROL_REVEAL } from "@/components/chrome/motion";
import { CourtDateScrubber } from "@/components/employee/court-date-scrubber";
import { CourtRollingNumber } from "@/components/employee/court-rolling-number";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { stepSittingDay } from "@/lib/employee/cause-list-days";
import { formatCourtDay, isoDay, isSittingDay, parseIsoDay } from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";

const MONTH_YEAR = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "long" });

/**
 * The board's day on a desktop — the advocate home's desktop date, for the court (owner,
 * 2026-10-22). The month over a white square holding the date large, the weekday under
 * it, arrows either side stepping a sitting day at a time, and a calendar beside it.
 * Hovering the square scrubs through the sitting days around it (`CourtDateScrubber`),
 * and the number rolls toward the day it moves to (`CourtRollingNumber`). Ported rather
 * than shared, because the citizen area is another person's to change; the same cues,
 * so a person who has used one reads the other.
 *
 * The ink says where the day stands: brand for today, muted for a day gone, full for a
 * day ahead.
 *
 * **The way back points at today** (owner, 2026-10-22: a way back that is not words,
 * and not a number that reads with the weekday as a date). Ahead of today, a double
 * chevron stands before the back arrow; behind it, after the forward arrow — so it
 * says "all the way back, this way" from wherever the reader is — outermost on its side,
 * past the calendar on the right, so the calendar stays beside the arrow. Brand ink, the
 * colour this control spends on today. Each side keeps its slot when empty, so nothing
 * moves when the reader leaves today. The words
 * are in its name and tooltip, with the T shortcut the board listens for
 * (`HearingsScreen`).
 */
function JumpToToday({
  direction,
  shown,
  today,
  onJump,
  className,
}: {
  direction: "back" | "forward";
  shown: boolean;
  today: string;
  onJump: () => void;
  className?: string;
}) {
  /* `invisible` keeps the slot and takes the button out of the tab order and the
     accessibility tree. */
  if (!shown) return <span aria-hidden className={cn("invisible size-6 shrink-0", className)} />;
  const Icon = direction === "back" ? ChevronsLeftIcon : ChevronsRightIcon;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Drawn at 24px like the day arrows; the ::after keeps the 40px hit area. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Back to today, ${formatCourtDay(today)}`}
            aria-keyshortcuts="T"
            className={cn(
              "relative size-6 shrink-0 text-brand-muted-foreground after:absolute after:-inset-2 hover:text-brand-muted-foreground",
              className,
            )}
            onClick={onJump}
          >
            <Icon aria-hidden className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align={direction === "back" ? "start" : "end"}>
          Back to today <Kbd>T</Kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CauseListDate({
  day,
  today,
  onSelectDay,
  className,
}: {
  day: string;
  today: string;
  onSelectDay: (day: string) => void;
  className?: string;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [scrubbing, setScrubbing] = React.useState({ open: false, instant: false });
  const onScrubReveal = React.useCallback((open: boolean, instant: boolean) => {
    setScrubbing({ open, instant });
  }, []);
  /* Which way the number rolls: up when the day moves later, down when earlier. Read
     off the last day shown, held in state so the render that receives a new day can
     compare against it. */
  const [shownDay, setShownDay] = React.useState(day);
  const [rollUp, setRollUp] = React.useState(true);
  if (shownDay !== day) {
    setShownDay(day);
    setRollUp(day > shownDay);
  }
  const date = parseIsoDay(day);
  const arrow = "relative size-6 text-muted-foreground after:absolute after:-inset-2";

  return (
    /* One grid, so the month and the weekday centre on the square itself rather than
       on the row of controls around it, whichever jump is showing. Margins keep each
       pair of 40px hit areas from overlapping. */
    <div
      className={cn(
        "grid-cols-[repeat(6,auto)] grid-rows-[auto_auto_auto] items-center gap-x-1.5",
        className,
      )}
    >
      <p
        className={cn(
          // ds-typography-allow: owner asked for the advocate home's date (2026-10-22) — the month a step under caption.
          "col-start-3 row-start-1 mb-2 flex w-20 justify-center justify-self-center text-[0.6875rem] leading-4 font-semibold tracking-wide whitespace-nowrap uppercase",
          day === today ? "text-brand-muted-foreground" : "text-muted-foreground",
        )}
      >
        {MONTH_YEAR.format(date)}
      </p>
      <JumpToToday
        direction="back"
        shown={day > today}
        today={today}
        onJump={() => onSelectDay(today)}
        className="col-start-1 row-start-2 mr-3"
      />
      {/* Drawn at 24px; the ::after keeps the 40px hit area. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Previous sitting day"
        className={cn(arrow, "col-start-2 row-start-2")}
        onClick={() => onSelectDay(stepSittingDay(day, -1, today))}
      >
        <ChevronLeftIcon aria-hidden className="size-5" />
      </Button>
      <div className="col-start-3 row-start-2">
        <CourtDateScrubber
          day={day}
          today={today}
          onPickDay={onSelectDay}
          onOpenCalendar={() => setPickerOpen(true)}
          onRevealChange={onScrubReveal}
        >
          {/* ds-typography-allow: owner asked for the advocate home's date (2026-10-22), larger than the DS display role as the header's lead. */}
          <CourtRollingNumber value={String(date.getDate()).padStart(2, "0")} up={rollUp} className="text-[3.5rem] leading-none font-semibold tracking-tight" />
          <span className="sr-only">{formatCourtDay(day)}</span>
        </CourtDateScrubber>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next sitting day"
        className={cn(arrow, "col-start-4 row-start-2")}
        onClick={() => onSelectDay(stepSittingDay(day, 1, today))}
      >
        <ChevronRightIcon aria-hidden className="size-5" />
      </Button>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          {/* Drawn at 32px; the ::after keeps the 40px hit area. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open calendar"
            className="relative col-start-5 row-start-2 ml-2 size-8 border border-hairline text-muted-foreground after:absolute after:-inset-1"
          >
            <CalendarDaysIcon aria-hidden className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" collisionPadding={16} className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            weekStartsOn={1}
            disabled={(value) => !isSittingDay(isoDay(value)) && isoDay(value) !== today}
            onSelect={(value) => {
              if (!value) return;
              setPickerOpen(false);
              onSelectDay(isoDay(value));
            }}
          />
        </PopoverContent>
      </Popover>
      <JumpToToday
        direction="forward"
        shown={day < today}
        today={today}
        onJump={() => onSelectDay(today)}
        className="col-start-6 row-start-2 ml-2"
      />
      {/* The weekday keeps its space while it fades for the scrubber's strip. */}
      <div className="col-start-3 row-start-3 mt-1 flex h-8 w-20 items-center justify-center justify-self-center whitespace-nowrap">
        <span
          aria-hidden
          className="court-scrubber-weekday inline-block text-body-compact"
          data-scrubbing={scrubbing.open}
          data-instant={scrubbing.instant}
          style={
            {
              "--scrub-fade-duration": `${CONTROL_REVEAL.fadeDuration}ms`,
              "--scrub-easing": CONTROL_REVEAL.easing,
            } as React.CSSProperties
          }
        >
          {WEEKDAY.format(date)}
        </span>
      </div>
    </div>
  );
}
