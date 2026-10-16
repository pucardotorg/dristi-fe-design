"use client";

import * as React from "react";
import { CalendarDaysIcon } from "lucide-react";
import { labelDayButton, type Matcher } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatListingDate,
  isSittingDay,
  isoDay,
  parseIsoDay,
  shiftDay,
} from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";

/**
 * The case's next hearing, marked on the calendar: a dot under the numeral, in ink, and
 * in the selected day's own foreground when that day is chosen. Tokens only. The day
 * cell is already `relative` in the DS calendar; the dot sits above its button.
 */
const HEARING_DOT = cn(
  "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:z-20 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-foreground",
  "data-[selected=true]:after:bg-primary-foreground",
);

/**
 * A day the court will take something up on — a listing, a review, a relisting, a new
 * hearing — composed the way the cognizance order's next-hearing date is: an outline
 * trigger that names the day, and the DS calendar in a popover.
 *
 * Only days the court can use are offered: after today, and sitting days
 * (`isSittingDay`). When the case has a next hearing it is marked on the calendar and
 * named under the field, so the bench sees where the suggestion came from and whether
 * the chosen day still matches it.
 *
 * `hearing` is passed only where the case's hearing is the question: `undefined` leaves
 * the hearing out entirely; `{ day: undefined }` says none is listed.
 */
export function ListingDateField({
  id,
  label,
  value,
  on,
  hearing,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: Date | undefined;
  /** Today, `YYYY-MM-DD`. */
  on: string;
  hearing?: { day: string | undefined };
  /** A consequence of the date, said after the hearing line. */
  hint?: string;
  onChange: (value: Date | undefined) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const labelId = `${id}-label`;
  const triggerId = `${id}-trigger`;
  const descriptionId = `${id}-description`;

  const day = value ? isoDay(value) : "";
  const invalid = Boolean(day) && day <= on;
  const hearingDay = hearing?.day;
  const hearingDate = hearingDay ? parseIsoDay(hearingDay) : undefined;

  const disabled: Matcher[] = [
    { before: parseIsoDay(shiftDay(on, 1)) },
    (date: Date) => !isSittingDay(isoDay(date)),
  ];

  const hearingLine = hearing
    ? hearingDay
      ? day === hearingDay
        ? "Next date of hearing in the case."
        : `Next date of hearing in the case: ${formatListingDate(hearingDay)}.`
      : "No date of hearing is fixed in this case."
    : null;
  const description = [hearingLine, hint].filter(Boolean).join(" ");

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel id={labelId} htmlFor={triggerId}>
        {label}
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* Named by the label and by its own content: "List on, 14 Oct 2026". */}
          <Button
            id={triggerId}
            type="button"
            variant="outline"
            aria-labelledby={`${labelId} ${triggerId}`}
            aria-describedby={
              invalid ? `${id}-error` : description ? descriptionId : undefined
            }
            aria-invalid={invalid || undefined}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarDaysIcon data-icon="inline-start" aria-hidden />
            <span className="truncate tabular-nums">
              {day ? formatListingDate(day) : "Pick a date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="w-auto max-w-(--radix-popover-content-available-width) gap-0 p-0"
        >
          <Calendar
            mode="single"
            autoFocus
            selected={value}
            defaultMonth={value ?? hearingDate}
            disabled={disabled}
            modifiers={hearingDate ? { hearing: hearingDate } : undefined}
            modifiersClassNames={{ hearing: HEARING_DOT }}
            labels={{
              labelDayButton: (date, modifiers, options, dateLib) =>
                `${labelDayButton(date, modifiers, options, dateLib)}${
                  modifiers.hearing ? ", next hearing" : ""
                }`,
            }}
            onSelect={(next) => {
              onChange(next);
              if (next) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {invalid ? (
        <FieldError id={`${id}-error`}>Choose a sitting day after today.</FieldError>
      ) : description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}
