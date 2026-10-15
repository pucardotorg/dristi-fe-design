"use client";

import * as React from "react";
import { CalendarDaysIcon } from "lucide-react";

import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setHearingPosting } from "@/lib/employee/hearing-session";
import {
  COURT_HEARING_PURPOSES,
  causeTitle,
  courtHearingPurposeLabel,
  formatCourtDay,
  formatListingDate,
  isoDay,
  parseIsoDay,
  type CourtHearing,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import { listingLoad, type DayLoad } from "@/lib/employee/listing-load";
import { NO_CAUSE_POSTING, type CausePosting } from "@/lib/employee/order-draft";
import { cn } from "@/lib/utils";

/**
 * The next hearing's date and purpose, set on the cause list (owner, 2026-10-15).
 *
 * They used to be filled in the order. They are now two fields on the cause list — two
 * fields in the reader's Next hearing column, and the same two in the case overview —
 * and screen E's order shows them, disabled. End hearing only ends the hearing; the
 * posting is its own act, made here, at any point in the day.
 *
 * **The date opens on the court's load.** A large month in which every day carries how
 * many hearings are already listed on it, with the chosen day broken down by purpose
 * beside it. The numbers are indicative (`listing-load.ts`).
 *
 * Only the Pending orders flow, whose order screen is E, and only the reader's seat
 * (`seatPostsNextHearing`), on every listing whatever its status — the caller decides.
 */

/** This listing's posting, and the way to change part of it. */
function useHearingPosting(
  hearing: CourtHearing,
): [CausePosting, (change: Partial<CausePosting>) => void] {
  const session = useHearingSession();
  const posting = session.postings[hearing.id] ?? NO_CAUSE_POSTING;
  const change = (patch: Partial<CausePosting>) =>
    setHearingPosting(hearing.id, { ...posting, ...patch });
  return [posting, change];
}

/**
 * Portalled calendars and menus still bubble through React to the row, and a row opens
 * the case overview on a click that is not on a control. This stops a click inside the
 * fields from being read as one on the row.
 */
function keepClick(event: React.MouseEvent) {
  event.stopPropagation();
}

/**
 * The date: a button showing the posting, opening the large calendar. "Not listed again"
 * lives in the same pop-up, because it is the other answer to *when next*.
 *
 * `labelledBy` names the field where a visible label stands over it (the overview); in a
 * table column the header carries the noun and the name is spelled out instead.
 */
export function NextDateField({
  hearing,
  labelledBy,
  className,
}: {
  hearing: CourtHearing;
  labelledBy?: string;
  className?: string;
}) {
  const today = useCourtToday();
  const session = useHearingSession();
  const [posting, change] = useHearingPosting(hearing);
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const listed = posting.next === "list";
  const shown = !listed
    ? "Not listed again"
    : posting.nextDate
      ? formatListingDate(posting.nextDate)
      : "Pick a date";
  /* This listing's own posting is left out, so re-posting it does not count it twice. */
  const load = React.useMemo(
    () => (open ? listingLoad(today, session.postings, hearing.id) : null),
    [open, today, session.postings, hearing.id],
  );

  return (
    <div onClick={keepClick} className={cn("min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-labelledby={labelledBy ? `${labelledBy} ${id}` : undefined}
            aria-label={
              labelledBy
                ? undefined
                : `Next hearing date for item ${hearing.item}, ${causeTitle(hearing)}: ${shown}`
            }
            className={cn(
              "w-full justify-start gap-2 text-left font-normal tabular-nums",
              listed && !posting.nextDate && "text-muted-foreground",
            )}
          >
            <CalendarDaysIcon data-icon="inline-start" aria-hidden />
            <span id={id} className="truncate">
              {shown}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="w-auto max-w-(--radix-popover-content-available-width) gap-0 p-0"
          onClick={keepClick}
        >
          {load ? (
            <div className="flex flex-col">
              <div className="grid gap-4 p-4 md:grid-cols-[auto_minmax(0,16rem)]">
                <LoadCalendar
                  today={today}
                  chosen={
                    listed && posting.nextDate
                      ? parseIsoDay(posting.nextDate)
                      : undefined
                  }
                  disabled={!listed}
                  load={load}
                  /* Stays open: the chosen day's breakdown is what the reader checks
                     the choice against. Done or Esc closes. */
                  onSelect={(day) => change({ next: "list", nextDate: day })}
                />
                <DayBreakdown
                  day={listed ? posting.nextDate : null}
                  load={
                    listed && posting.nextDate ? load.get(posting.nextDate) : undefined
                  }
                />
              </div>
              <div className="flex min-h-14 items-center gap-2 border-t border-hairline px-4">
                <Checkbox
                  id={`${id}-none`}
                  checked={!listed}
                  onCheckedChange={(checked) =>
                    change(
                      checked === true
                        ? { next: "none", nextDate: null, nextPurpose: "" }
                        : { next: "list" },
                    )
                  }
                />
                <Label
                  htmlFor={`${id}-none`}
                  className="cursor-pointer text-body-compact font-normal"
                >
                  Not listed again
                </Label>
                <Button
                  type="button"
                  className="ml-auto"
                  onClick={() => setOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** The purpose. Off while the matter is not listed again — there is nothing to list it for. */
export function NextPurposeField({
  hearing,
  labelledBy,
  className,
}: {
  hearing: CourtHearing;
  labelledBy?: string;
  className?: string;
}) {
  const [posting, change] = useHearingPosting(hearing);
  const listed = posting.next === "list";
  return (
    <div onClick={keepClick} className={cn("min-w-0", className)}>
      <Select
        /* "" rather than undefined, so the field is controlled from its first paint;
           Radix shows the placeholder for it. */
        value={(listed && posting.nextPurpose) || ""}
        disabled={!listed}
        onValueChange={(value) =>
          change({ nextPurpose: value as CourtHearingPurposeId })
        }
      >
        <SelectTrigger
          aria-labelledby={labelledBy}
          aria-label={
            labelledBy
              ? undefined
              : `Next hearing purpose for item ${hearing.item}, ${causeTitle(hearing)}`
          }
          className="w-full"
        >
          <SelectValue placeholder={listed ? "Choose a purpose" : "Not listed"}>
            {listed && posting.nextPurpose
              ? courtHearingPurposeLabel(posting.nextPurpose)
              : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COURT_HEARING_PURPOSES.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * A month at a size the count fits in: 48px days, each with the number of hearings
 * already listed on it under the date. The count travels in the day's accessible name
 * too, so it is not a sighted reader's alone.
 */
function LoadCalendar({
  today,
  chosen,
  disabled,
  load,
  onSelect,
}: {
  today: string;
  chosen: Date | undefined;
  disabled: boolean;
  load: ReadonlyMap<string, DayLoad>;
  onSelect: (day: string | null) => void;
}) {
  const countOn = (date: Date) => load.get(isoDay(date))?.total ?? 0;
  return (
    <Calendar
      mode="single"
      autoFocus
      selected={chosen}
      defaultMonth={chosen ?? parseIsoDay(today)}
      disabled={disabled ? true : { before: parseIsoDay(today) }}
      onSelect={(day) => onSelect(day ? isoDay(day) : null)}
      className="rounded-lg border border-hairline p-3 [--cell-size:--spacing(12)]"
      labels={{
        labelDayButton: (date, modifiers) => {
          const count = countOn(date);
          const listed = modifiers.disabled
            ? ""
            : `, ${count} ${count === 1 ? "hearing" : "hearings"} listed`;
          return `${formatCourtDay(isoDay(date))}${listed}${
            modifiers.selected ? ", selected" : ""
          }`;
        },
      }}
      components={{
        DayButton: ({ children, ...props }) => {
          const count = props.modifiers.disabled ? 0 : countOn(props.day.date);
          return (
            <CalendarDayButton {...props}>
              {children}
              {/* Reserved even at nought, so every day's number sits on one line. */}
              <span className="tabular-nums" aria-hidden>
                {count > 0 ? count : " "}
              </span>
            </CalendarDayButton>
          );
        },
      }}
    />
  );
}

/** The chosen day, broken down by purpose — the number under the date, opened up. */
function DayBreakdown({
  day,
  load,
}: {
  day: string | null;
  load: DayLoad | undefined;
}) {
  return (
    <section
      aria-live="polite"
      className="flex min-w-0 flex-col gap-4 rounded-lg bg-surface-sunken p-4"
    >
      {day ? (
        <>
          <div className="flex flex-col gap-1">
            <h3 className="text-body-compact font-semibold">
              Already listed on {formatCourtDay(day)}
            </h3>
            <p className="text-body-compact text-muted-foreground tabular-nums">
              {load
                ? `${load.total} ${load.total === 1 ? "hearing" : "hearings"}`
                : "No hearings yet"}
            </p>
          </div>
          {load ? (
            <ul className="flex flex-col gap-2">
              {load.purposes.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-4 text-body-compact"
                >
                  <span className="min-w-0">{entry.label}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {entry.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="text-body-compact text-muted-foreground">
          Pick a date to see what is already listed on it, by purpose.
        </p>
      )}
    </section>
  );
}
