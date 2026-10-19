"use client";

import * as React from "react";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { DayButton } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { daysBetween, monthKey, monthStart, type CourtDocket } from "@/lib/employee/court-docket";
import {
  compareShort,
  formatDay,
  formatSpanFull,
  pickerPresets,
  previousName,
  type CompareMode,
  type Period,
} from "@/lib/employee/court-flow";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * The dashboard's one date control, ported from the owner's mockup: a day or a range,
 * with quick picks beside a Monday-first month. A quick pick applies at once; a day or a
 * range picked on the month applies with Apply. Days outside the records cannot be
 * picked, and the latest day carries a dot.
 *
 * The month is the DS `Calendar`, composed rather than wrapped: its own navigation and
 * caption give way to the mockup's previous / month / next row, and the click on a day is
 * read as the mockup reads it (a first click starts a range, a second ends it, a third
 * starts again) rather than by the day picker's own range rules.
 *
 * The comparison is chosen beside the dates it depends on ("Compare with") and applied
 * with them; a quick pick keeps the comparison already in use.
 *
 * The mockup previews a range under the pointer; this does not. The DS Calendar renders
 * its root as an inline component, so every render of this picker remounts the grid, and
 * a state change on pointer entry swapped the day out between press and release — the
 * second click of a range was lost. State changes only on a completed click.
 */

/* The calendar speaks local dates; the docket speaks UTC midnights. */
const toDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
const toDate = (day: number) => {
  const d = new Date(day);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthName = (key: number) => `${MONTHS_LONG[key % 12]} ${Math.floor(key / 12)}`;

/**
 * A day of the month, with a dot under the latest day the records hold. Kept at module
 * level: a component made during render would be a new component every render, and the
 * focused day would be remounted (and lose focus) on each one.
 */
function LatestDayButton({ children, ...props }: React.ComponentProps<typeof DayButton>) {
  return (
    <CalendarDayButton {...props}>
      {children}
      {props.modifiers.latest ? (
        <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />
      ) : null}
    </CalendarDayButton>
  );
}

type Draft = { a: number | null; b: number | null };

const COMPARE_OPTIONS: { value: CompareMode; label: string | null; description: string }[] = [
  { value: "prev", label: null, description: "The period just before" },
  { value: "year", label: "Same period last year", description: "Removes seasonal swings" },
  { value: "avg", label: "Average of last 6", description: "The steadiest baseline" },
  { value: "none", label: "No comparison", description: "Show the numbers only" },
];

export function DashboardDatePicker({
  docket,
  value,
  compare,
  defaultValue,
  onChange,
}: {
  docket: CourtDocket;
  value: Period;
  compare: CompareMode;
  /** The opening selection, which "Back to this month" returns to. */
  defaultValue: Period;
  onChange: (next: Period, compare: CompareMode) => void;
}) {
  const latest = docket.today;
  const first = docket.start;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>({ a: value.from, b: value.to });
  const [month, setMonth] = React.useState(monthKey(value.to));
  const [draftCompare, setDraftCompare] = React.useState<CompareMode>(compare);

  const presets = pickerPresets(docket);
  const single = value.from === value.to;
  const isLatest = single && value.to === latest;
  const isDefault = value.from === defaultValue.from && value.to === defaultValue.to;
  const versus = compareShort(compare, value);

  const openWith = (next: boolean) => {
    if (next) {
      setDraft({ a: value.from, b: value.to });
      setMonth(monthKey(value.to));
      setDraftCompare(compare);
    }
    setOpen(next);
  };

  const choose = (period: Period, mode: CompareMode = compare) => {
    setOpen(false);
    onChange(period, mode);
  };

  const pickDay = (t: number) => {
    setDraft((d) => (d.a === null || d.b !== null ? { a: t, b: null } : { a: d.a, b: t }));
  };

  const apply = () => {
    if (draft.a === null) return;
    const b = draft.b ?? draft.a;
    choose({ from: Math.min(draft.a, b), to: Math.max(draft.a, b) }, draftCompare);
  };

  const { a, b } = draft;
  const lo = a === null ? null : Math.min(a, b ?? a);
  const hi = a === null ? null : Math.max(a, b ?? a);
  const firstMonth = monthKey(first);
  const lastMonth = monthKey(latest);
  const months = Array.from({ length: lastMonth - firstMonth + 1 }, (_, i) => firstMonth + i);

  let status: React.ReactNode;
  if (a === null || lo === null || hi === null) {
    status = "Pick a day, or a start and an end day.";
  } else if (b === null) {
    status = (
      <>
        Starts <strong className="font-semibold text-foreground">{formatDay(a)}</strong>. Pick an end
        day, or apply to see this day alone.
      </>
    );
  } else if (lo === hi) {
    status = (
      <>
        <strong className="font-semibold text-foreground">{formatDay(lo)}</strong> · the Overview
        is read for this day alone
      </>
    );
  } else {
    status = (
      <>
        <strong className="font-semibold text-foreground">{formatSpanFull(lo, hi)}</strong> ·{" "}
        {formatCount(daysBetween(lo, hi) + 1)} days
      </>
    );
  }

  const disabledWhy = (date: Date) => {
    const t = toDay(date);
    if (t > latest) return `no data after ${formatDay(latest)}`;
    if (t < first) return `records begin ${formatDay(first)}`;
    return "";
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={openWith}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            aria-haspopup="dialog"
            className="h-auto min-h-10 max-w-full flex-wrap justify-start gap-x-2 gap-y-1 py-2 text-left whitespace-normal tabular-nums"
          >
            <CalendarDaysIcon data-icon="inline-start" aria-hidden className="text-muted-foreground" />
            {single ? (
              <span className="font-semibold">{formatDay(value.to)}</span>
            ) : (
              <span className="font-semibold">{formatSpanFull(value.from, value.to)}</span>
            )}{" "}
            {isLatest || isDefault ? (
              <Badge variant="secondary" className="bg-brand-muted text-brand-muted-foreground">
                {isLatest ? "Latest" : "This month"}
              </Badge>
            ) : single ? null : (
              <span className="text-muted-foreground">
                {formatCount(daysBetween(value.from, value.to) + 1)} days
              </span>
            )}
            {versus ? (
              <>
                {" "}
                <span className="border-l border-hairline pl-2 font-normal text-muted-foreground">{versus}</span>
              </>
            ) : null}
            <span className="sr-only">, change the period or the comparison</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          role="dialog"
          aria-label="Choose a date or a date range"
          align="end"
          sideOffset={8}
          collisionPadding={16}
          /* The month takes focus on the chosen day, as the mockup does, rather than the
             first quick pick. */
          onOpenAutoFocus={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              apply();
            }
          }}
          className="w-auto max-w-(--radix-popover-content-available-width) gap-0 overflow-y-auto p-0 max-h-(--radix-popover-content-available-height)"
        >
          <div className="flex flex-col sm:flex-row">
            <div
              role="group"
              aria-labelledby="dash-picker-quick"
              className="flex flex-row flex-wrap gap-2 border-b border-hairline p-3 sm:w-44 sm:flex-col sm:flex-nowrap sm:gap-0.5 sm:border-r sm:border-b-0"
            >
              <p id="dash-picker-quick" className="w-full px-2 pb-1 text-body-compact text-muted-foreground max-sm:sr-only">
                Quick pick
              </p>
              {presets.map((preset) => {
                const pressed =
                  b !== null && lo === preset.period.from && hi === preset.period.to;
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="ghost"
                    aria-pressed={pressed}
                    onClick={() => choose(preset.period)}
                    className={cn(
                      "justify-start text-body-compact font-normal max-sm:rounded-full max-sm:border-hairline sm:w-full",
                      pressed && "bg-accent-strong font-semibold",
                    )}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            <div className="flex min-w-0 flex-col gap-3 p-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous month"
                  disabled={month <= firstMonth}
                  onClick={() => setMonth((m) => Math.max(firstMonth, m - 1))}
                >
                  <ChevronLeftIcon aria-hidden />
                </Button>
                <Select value={String(month)} onValueChange={(next) => setMonth(Number(next))}>
                  <SelectTrigger aria-label="Month" className="h-10 min-w-0 flex-1 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((key) => (
                      <SelectItem key={key} value={String(key)}>
                        {monthName(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next month"
                  disabled={month >= lastMonth}
                  onClick={() => setMonth((m) => Math.min(lastMonth, m + 1))}
                >
                  <ChevronRightIcon aria-hidden />
                </Button>
              </div>

              <Calendar
                mode="range"
                autoFocus
                hideNavigation
                showOutsideDays={false}
                weekStartsOn={1}
                month={toDate(monthStart(month))}
                onMonthChange={(date) => setMonth(monthKey(toDay(date)))}
                startMonth={toDate(first)}
                endMonth={toDate(latest)}
                disabled={[{ before: toDate(first) }, { after: toDate(latest) }]}
                selected={
                  lo === null || hi === null
                    ? undefined
                    : { from: toDate(lo), to: b === null ? undefined : toDate(hi) }
                }
                onSelect={(_range, day) => pickDay(toDay(day))}
                modifiers={{ latest: toDate(latest) }}
                formatters={{
                  formatWeekdayName: (date) =>
                    date.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2),
                }}
                labels={{
                  labelDayButton: (date, modifiers) => {
                    const why = modifiers.disabled ? `, ${disabledWhy(date)}` : "";
                    return `${formatDay(toDay(date))}${modifiers.latest ? ", latest data" : ""}${why}${
                      modifiers.selected ? ", selected" : ""
                    }`;
                  },
                }}
                components={{ DayButton: LatestDayButton }}
                classNames={{ month_caption: "sr-only" }}
                className="p-0 [--cell-size:--spacing(10)]"
              />

              <fieldset className="flex flex-col gap-2 border-t border-hairline pt-3 sm:w-72">
                <legend className="float-left mb-1 w-full text-body-compact text-muted-foreground">Compare with</legend>
                <RadioGroup
                  value={draftCompare}
                  onValueChange={(next) => setDraftCompare(next as CompareMode)}
                  className="gap-0"
                >
                  {COMPARE_OPTIONS.map((option) => {
                    const id = `dash-compare-${option.value}`;
                    const range =
                      lo === null || hi === null ? value : { from: lo, to: b === null ? lo : hi };
                    return (
                      <div key={option.value} className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                        <RadioGroupItem id={id} value={option.value} className="mt-0.5" />
                        <Label htmlFor={id} className="flex cursor-pointer flex-col items-start gap-0 font-normal">
                          <span className="text-body-compact font-medium">{option.label ?? previousName(range)}</span>
                          <span className="text-caption text-muted-foreground">{option.description}</span>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </fieldset>

              <div className="flex flex-col gap-3 border-t border-hairline pt-3 sm:w-72">
                <p aria-live="polite" className="min-h-10 text-body-compact text-muted-foreground tabular-nums">
                  {status}
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={a === null} onClick={apply}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {isDefault ? null : (
        <Button
          type="button"
          variant="link"
          className="px-2"
          onClick={() => {
            onChange(defaultValue, compare);
            triggerRef.current?.focus();
          }}
        >
          Back to this month
        </Button>
      )}
    </div>
  );
}
