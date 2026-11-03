"use client";

import * as React from "react";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays } from "@/lib/employee/bulk-reschedule";
import { isoDay, isSittingDay, parseIsoDay } from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short" });
const SPOKEN_DAY = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" });

/** The Monday of the week `day` falls in. */
function mondayOf(day: string): string {
  const weekday = parseIsoDay(day).getDay();
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

function casesLine(count: number): string {
  return count === 1 ? "1 case" : `${count} cases`;
}

/**
 * The board's day control: a week of days, each with how many matters it lists, paged a
 * week at a time, with a calendar to jump to any date and Today to come back.
 *
 * The advocate home's week strip, said for the court (owner, 2026-10-22) — on a phone
 * or tablet, where the big date (`CauseListDate`) does not fit. Built here
 * rather than shared, because the citizen area is another person's to change: the same
 * cues, so a person who has used one reads the other. Brand tint marks *today*; another
 * chosen day gets the neutral selected fill, so the two never read alike. The court does
 * not sit on a weekend (`isSittingDay`), so Saturday and Sunday are shown and cannot be
 * chosen — unless one of them is today, which the board always shows.
 *
 * The seven days take the row and the arrows, calendar and Today sit beneath them, at
 * every width it shows at: beside them, a week does not fit a tablet's column.
 */
export function CauseListWeek({
  day,
  today,
  countFor,
  onSelectDay,
  className,
}: {
  /** The day in view. */
  day: string;
  today: string;
  /** How many matters `day` lists. */
  countFor: (day: string) => number;
  onSelectDay: (day: string) => void;
  className?: string;
}) {
  /* The week shown follows the chosen day, but the arrows page it without choosing a
     day — the same split the advocate strip makes. */
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(day));
  const [followedDay, setFollowedDay] = React.useState(day);
  if (followedDay !== day) {
    setFollowedDay(day);
    setWeekStart(mondayOf(day));
  }
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const week = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const awayFromToday = day !== today || !week.includes(today);

  function choose(next: string) {
    setWeekStart(mondayOf(next));
    onSelectDay(next);
  }


  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <ul
        aria-label={`Week of ${SPOKEN_DAY.format(parseIsoDay(weekStart))}`}
        className="order-first grid basis-full grid-cols-7 gap-1"
      >
        {week.map((cell) => {
          const isToday = cell === today;
          const isSelected = cell === day;
          const sits = isSittingDay(cell) || isToday;
          const count = sits ? countFor(cell) : 0;
          return (
            <li key={cell} className="min-w-0">
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={!sits}
                aria-label={`${SPOKEN_DAY.format(parseIsoDay(cell))}${isToday ? ", today" : ""}, ${
                  sits ? `${casesLine(count)} listed` : "court does not sit"
                }`}
                onClick={() => choose(cell)}
                className={cn(
                  "flex min-h-16 w-full flex-col items-center justify-center rounded-lg px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
                  isToday
                    ? "bg-brand-muted text-brand-muted-foreground"
                    : isSelected
                      ? "bg-accent-strong text-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  !sits && "opacity-50",
                )}
              >
                <span className="text-caption">{WEEKDAY.format(parseIsoDay(cell))}</span>
                <span
                  className={cn(
                    "text-body-compact tabular-nums",
                    (isToday || isSelected) && "font-semibold",
                  )}
                >
                  {parseIsoDay(cell).getDate()}
                </span>
                <span aria-hidden className="text-caption tabular-nums">
                  {sits ? (
                    <>
                      {count}
                      <span className="hidden sm:inline"> {count === 1 ? "case" : "cases"}</span>
                    </>
                  ) : (
                    "–"
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Previous week"
        className="text-muted-foreground"
        onClick={() => setWeekStart(addDays(weekStart, -7))}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next week"
        className="text-muted-foreground"
        onClick={() => setWeekStart(addDays(weekStart, 7))}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Pick a date"
            className="text-muted-foreground"
          >
            <CalendarDaysIcon aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={16} className="w-auto p-0">
          <Calendar
            mode="single"
            selected={parseIsoDay(day)}
            defaultMonth={parseIsoDay(day)}
            weekStartsOn={1}
            disabled={(date) => !isSittingDay(isoDay(date)) && isoDay(date) !== today}
            onSelect={(date) => {
              if (!date) return;
              setPickerOpen(false);
              choose(isoDay(date));
            }}
          />
        </PopoverContent>
      </Popover>
      {awayFromToday ? (
        <Button type="button" variant="outline" onClick={() => choose(today)}>
          Today
        </Button>
      ) : null}
    </div>
  );
}
