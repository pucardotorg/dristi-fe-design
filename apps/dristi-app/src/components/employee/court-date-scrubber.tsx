"use client";

import * as React from "react";

import { CONTROL_REVEAL } from "@/components/chrome/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NEARBY_COUNT,
  NEARBY_RADIUS,
  nearbyIndex,
  nearbySittingDays,
} from "@/lib/employee/cause-list-days";
import { formatCourtDay, parseIsoDay } from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";
import "./court-date-scrubber.css";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
function subscribePointer(callback: () => void) {
  const media = window.matchMedia(FINE_POINTER);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const finePointer = () => window.matchMedia(FINE_POINTER).matches;

/** One shared motion recipe; spacing, radius, colours and type stay in the DS. */
const motionStyle = {
  "--scrub-duration": `${CONTROL_REVEAL.duration}ms`,
  "--scrub-fade-duration": `${CONTROL_REVEAL.fadeDuration}ms`,
  "--scrub-easing": CONTROL_REVEAL.easing,
} as React.CSSProperties;

const barLengths = [4, 3, 2.5, 2, 1.5, 1] as const;
const SHORT_MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });

/**
 * The date square's scrubber — the advocate home's (`advocate/date-scrubber.tsx`, owner,
 * 2026-10-22: "it has that micro interaction"), ported because the citizen area is
 * another person's to change.
 *
 * Hovering the square drops a strip of eleven ticks under it and a bubble naming the
 * day under the pointer; moving across the square previews, a click commits. The whole
 * square (and the strip it reveals) is one hit area, so nobody aims at a 2px bar. With a
 * keyboard, Left and Right preview, Enter commits, Escape cancels. On touch, where there
 * is no hover, the square opens the calendar instead.
 *
 * One change for the court: the ticks are sitting days, not calendar days
 * (`nearbySittingDays`) — a weekend would only ever preview an empty list.
 */
export function CourtDateScrubber({
  day,
  today,
  children,
  onPickDay,
  onOpenCalendar,
  onRevealChange,
}: {
  day: string;
  today: string;
  children: React.ReactNode;
  onPickDay: (day: string) => void;
  onOpenCalendar: () => void;
  /** Lets the weekday under the square fade while the strip is out. */
  onRevealChange: (open: boolean, instant: boolean) => void;
}) {
  const canScrub = React.useSyncExternalStore(subscribePointer, finePointer, () => false);
  const [anchor, setAnchor] = React.useState(day);
  const [preview, setPreview] = React.useState(NEARBY_RADIUS);
  const [hovered, setHovered] = React.useState(false);
  const [keyboard, setKeyboard] = React.useState(false);
  const [instant, setInstant] = React.useState(false);
  const indexRef = React.useRef(NEARBY_RADIUS);
  const suppressed = React.useRef(false);
  const faceRef = React.useRef<HTMLButtonElement>(null);
  const helpId = React.useId();
  const open = canScrub && (hovered || keyboard);
  const days = nearbySittingDays(anchor, today);
  const previewDay = days[preview];
  const previewTone = previewDay === today ? "today" : previewDay < today ? "past" : "future";
  const previewDate = parseIsoDay(previewDay);
  const crossesMonth = previewDate.getMonth() !== parseIsoDay(days[NEARBY_RADIUS]).getMonth();
  const bubbleLabel = `${String(previewDate.getDate()).padStart(2, "0")}${
    crossesMonth ? ` ${SHORT_MONTH.format(previewDate)}` : ""
  }`;

  React.useLayoutEffect(() => onRevealChange(open, instant), [open, instant, onRevealChange]);

  function setIndex(index: number) {
    indexRef.current = index;
    setPreview(index);
  }
  function begin(pointerX?: number) {
    setAnchor(day);
    const rect = faceRef.current?.getBoundingClientRect();
    setIndex(
      pointerX !== undefined && rect ? nearbyIndex(pointerX, rect.left, rect.width) : NEARBY_RADIUS,
    );
  }
  function close() {
    setHovered(false);
    setKeyboard(false);
    /* The pointer must leave before another hover session: committing does not reopen
       the strip under a cursor that has not moved. */
    suppressed.current = hovered;
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!canScrub) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : null;
    if (delta === null && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (!open) begin();
    setInstant(true);
    setKeyboard(true);
    setIndex(
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? NEARBY_COUNT - 1
          : Math.max(0, Math.min(NEARBY_COUNT - 1, indexRef.current + delta!)),
    );
  }

  return (
    <div
      className="court-scrubber relative w-20 shrink-0 select-none"
      data-open={open}
      data-instant={instant}
      style={motionStyle}
      onPointerEnter={(event) => {
        if (!canScrub || event.pointerType !== "mouse" || suppressed.current) return;
        begin(event.clientX);
        setInstant(false);
        setKeyboard(false);
        setHovered(true);
      }}
      onPointerMove={(event) => {
        if (!hovered || suppressed.current || event.pointerType !== "mouse") return;
        const rect = faceRef.current?.getBoundingClientRect();
        if (keyboard) setKeyboard(false);
        if (instant) setInstant(false);
        if (rect) {
          const next = nearbyIndex(event.clientX, rect.left, rect.width);
          if (next !== indexRef.current) setIndex(next);
        }
      }}
      onPointerLeave={() => {
        setHovered(false);
        suppressed.current = false;
      }}
    >
      <Button
        ref={faceRef}
        variant="ghost"
        type="button"
        aria-label={`${canScrub ? "Preview nearby sitting days" : "Pick a date"}: ${formatCourtDay(day)}`}
        aria-describedby={canScrub ? helpId : undefined}
        aria-haspopup={canScrub ? undefined : "dialog"}
        onFocus={(event) => {
          if (canScrub && event.currentTarget.matches(":focus-visible")) {
            begin();
            setInstant(true);
            setKeyboard(true);
          }
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        onClick={() => {
          if (!canScrub) {
            onOpenCalendar();
            return;
          }
          const picked = days[indexRef.current];
          close();
          onPickDay(picked);
        }}
        className={cn(
          "court-scrubber-face relative z-10 h-18 w-full rounded-xl border border-hairline bg-card p-0 transition-colors hover:bg-card active:not-aria-[haspopup]:translate-y-0",
          day === today
            ? "text-brand-muted-foreground hover:text-brand-muted-foreground"
            : day < today
              ? "text-muted-foreground hover:text-muted-foreground"
              : "text-foreground hover:text-foreground",
        )}
      >
        {children}
      </Button>
      <span id={helpId} className="sr-only">
        Move across the date to preview nearby sitting days. Click to choose one. With a
        keyboard, use Left and Right, then Enter or Space. Escape cancels.
      </span>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {keyboard && open ? formatCourtDay(previewDay) : ""}
      </span>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-full h-12 overflow-y-clip"
      >
        <div
          className="mt-1 grid h-4"
          style={{ gridTemplateColumns: `repeat(${NEARBY_COUNT}, minmax(0, 1fr))` }}
        >
          {days.map((tickDay, index) => {
            /* The outside pair moves first, then inward to the centre. */
            const order = NEARBY_RADIUS - Math.abs(index - NEARBY_RADIUS);
            const length = barLengths[Math.min(NEARBY_RADIUS, Math.abs(index - preview))];
            return (
              <span
                key={index}
                className="court-scrubber-bar flex h-full justify-center"
                style={{
                  transitionDelay: `${(open ? order : NEARBY_RADIUS - order) * CONTROL_REVEAL.stagger}ms`,
                }}
              >
                <span
                  className={cn(
                    "court-scrubber-tick block h-full w-0.5 origin-top rounded-full",
                    tickDay === today
                      ? "bg-primary"
                      : tickDay < today
                        ? "bg-muted-foreground"
                        : "bg-foreground",
                  )}
                  style={{ transform: `scaleY(${length / barLengths[0]})` }}
                />
              </span>
            );
          })}
        </div>
        <div className="court-scrubber-bubble absolute inset-x-0 top-6">
          <div
            className="court-scrubber-cursor relative w-full"
            style={{ transform: `translateX(${((preview + 0.5) / NEARBY_COUNT - 0.5) * 100}%)` }}
          >
            <Badge
              variant="secondary"
              className={cn(
                "court-scrubber-badge absolute left-1/2 max-w-20 min-w-6 overflow-visible rounded-lg px-1.5 text-body-compact font-semibold tabular-nums transition-colors",
                previewTone === "today"
                  ? "bg-primary text-primary-foreground"
                  : previewTone === "past"
                    ? "bg-accent-strong text-foreground"
                    : "bg-foreground text-background",
              )}
              style={{ "--scrub-anchor": ((preview + 0.5) / NEARBY_COUNT) * 100 } as React.CSSProperties}
              title={formatCourtDay(previewDay)}
            >
              <span className="court-scrubber-pointer absolute -top-1 size-1.5 -translate-x-1/2 rounded-full bg-inherit" />
              <span className="min-w-0 truncate">{bubbleLabel}</span>
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
