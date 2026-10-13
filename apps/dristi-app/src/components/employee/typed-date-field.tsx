"use client";

import * as React from "react";
import { CalendarDaysIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { formatCaseWeekday } from "@/lib/employee/hearing-overview";
import { formatListingDate, isoDay, parseIsoDay } from "@/lib/employee/hearings";
import { parseTypedDate } from "@/lib/employee/order-proceedings";
import { cn } from "@/lib/utils";

/**
 * A date the typist can type — `12.11`, `12 Nov` — with the calendar a press away beside
 * it (order-screen v14). Pressing the field shows the calendar without taking the caret
 * from it; Down goes into the calendar; Escape or Tab puts it away. Days already gone
 * cannot be chosen. What the typing reads as is said under the field, so a slip shows
 * before it reaches the order.
 */
export function TypedDateField({
  id,
  labelledBy,
  value,
  today,
  disabled,
  onChange,
  className,
}: {
  id: string;
  labelledBy: string;
  /** ISO day, or "". */
  value: string;
  today: string;
  disabled?: boolean;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const [text, setText] = React.useState(value ? formatListingDate(value) : "");
  const [seen, setSeen] = React.useState(value);
  const [open, setOpen] = React.useState(false);
  const [intoGrid, setIntoGrid] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hintId = `${id}-hint`;

  /* A value set from elsewhere — the calendar, a template — shows in the field. */
  if (value !== seen) {
    setSeen(value);
    if (value && parseTypedDate(text, today).kind !== "date") setText(formatListingDate(value));
    if (!value && parseTypedDate(text, today).kind === "date") setText("");
  }

  const parsed = parseTypedDate(text, today);
  const hint =
    parsed.kind === "date" ? (
      <span className="text-muted-foreground">{formatCaseWeekday(parsed.iso)}</span>
    ) : parsed.kind === "past" ? (
      <span className="text-warning-ink">That date has passed</span>
    ) : parsed.kind === "bad" ? (
      <span className="text-warning-ink">Type a date like 12.11 or 12 Nov</span>
    ) : null;

  function openCalendar(focusGrid: boolean) {
    setIntoGrid(focusGrid);
    setOpen(true);
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <InputGroup>
            <InputGroupInput
              ref={inputRef}
              id={id}
              aria-labelledby={labelledBy}
              aria-describedby={hintId}
              autoComplete="off"
              spellCheck={false}
              placeholder="Choose a date"
              value={text}
              disabled={disabled}
              onChange={(event) => {
                setText(event.target.value);
                const next = parseTypedDate(event.target.value, today);
                onChange(next.kind === "date" ? next.iso : "");
              }}
              onBlur={() => {
                if (parsed.kind === "date") setText(formatListingDate(parsed.iso));
              }}
              onClick={() => openCalendar(false)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  openCalendar(true);
                }
                if (event.key === "Escape" && open) {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                }
                if (event.key === "Tab") setOpen(false);
              }}
              className="tabular-nums"
            />
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Choose a date from the calendar"
                aria-haspopup="dialog"
                aria-expanded={open}
                disabled={disabled}
                onClick={() => (open ? setOpen(false) : openCalendar(true))}
                className="text-muted-foreground"
              >
                <CalendarDaysIcon aria-hidden />
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="w-auto gap-0 p-0"
          onOpenAutoFocus={(event) => {
            if (!intoGrid) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (inputRef.current?.parentElement?.contains(event.target as Node)) event.preventDefault();
          }}
        >
          <Calendar
            mode="single"
            autoFocus={intoGrid}
            selected={parsed.kind === "date" ? parseIsoDay(parsed.iso) : undefined}
            defaultMonth={parseIsoDay(parsed.kind === "date" ? parsed.iso : today)}
            disabled={{ before: parseIsoDay(today) }}
            onSelect={(day) => {
              if (!day) return;
              const iso = isoDay(day);
              setText(formatListingDate(iso));
              onChange(iso);
              setOpen(false);
              inputRef.current?.focus();
            }}
          />
        </PopoverContent>
      </Popover>
      <p id={hintId} className="min-h-5 text-body-compact">
        {hint}
      </p>
    </div>
  );
}
