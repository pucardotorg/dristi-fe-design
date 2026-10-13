"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONTROL_REVEAL } from "@/components/chrome/motion";
import { advHome } from "@/lib/advocate/content";
import { nearbyDateIndex, nearbyDates, NEARBY_DATE_COUNT, NEARBY_DATE_RADIUS } from "@/lib/advocate/date-scrubber";
import { dayKeyOf } from "@/lib/advocate/home";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";
import "./date-scrubber.css";

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

/**
 * Hover previews; a native DS button commits. The whole square (and its revealed
 * strip) shares one hit area, so navigating never requires aiming at tiny bars.
 * The eleven-day window stays anchored until the interaction closes.
 */
export function DateScrubber({
  selectedDay,
  todayKey,
  locale,
  dateLine,
  children,
  onPickDate,
  onOpenCalendar,
  onRevealChange,
}: {
  selectedDay: string;
  todayKey: string;
  locale: Locale;
  dateLine: string;
  children: React.ReactNode;
  onPickDate: (date: Date, animate?: boolean) => void;
  onOpenCalendar: () => void;
  onRevealChange: (open: boolean, instant: boolean) => void;
}) {
  const canScrub = React.useSyncExternalStore(subscribePointer, finePointer, () => false);
  const [anchor, setAnchor] = React.useState(selectedDay);
  const [preview, setPreview] = React.useState(NEARBY_DATE_RADIUS);
  const [hovered, setHovered] = React.useState(false);
  const [keyboard, setKeyboard] = React.useState(false);
  const [instant, setInstant] = React.useState(false);
  const indexRef = React.useRef(NEARBY_DATE_RADIUS);
  const suppressed = React.useRef(false);
  const faceRef = React.useRef<HTMLButtonElement>(null);
  const helpId = React.useId();
  const open = canScrub && (hovered || keyboard);
  const dates = React.useMemo(() => nearbyDates(anchor), [anchor]);
  const date = dates[preview];
  const previewKey = dayKeyOf(date);
  const previewTone = previewKey === todayKey ? "today" : previewKey < todayKey ? "past" : "future";
  const format = new Intl.DateTimeFormat(locale === "ml" ? "ml-IN" : "en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const previewLabel = format.format(date);
  const crossesMonth = date.getMonth() !== dates[NEARBY_DATE_RADIUS].getMonth();
  const bubbleLabel = `${String(date.getDate()).padStart(2, "0")}${crossesMonth ? ` ${new Intl.DateTimeFormat(locale === "ml" ? "ml-IN" : "en-IN", { month: "short" }).format(date)}` : ""}`;

  React.useLayoutEffect(() => onRevealChange(open, instant), [open, instant, onRevealChange]);

  function setIndex(index: number) {
    indexRef.current = index;
    setPreview(index);
  }
  function begin(pointerX?: number) {
    setAnchor(selectedDay);
    const rect = faceRef.current?.getBoundingClientRect();
    setIndex(pointerX !== undefined && rect ? nearbyDateIndex(pointerX, rect.left, rect.width) : NEARBY_DATE_RADIUS);
  }
  function close() {
    setHovered(false);
    setKeyboard(false);
    // The pointer must leave before another hover session: committing does not
    // immediately reopen/re-anchor the strip under a stationary cursor.
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
    setIndex(event.key === "Home" ? 0 : event.key === "End" ? NEARBY_DATE_COUNT - 1 : Math.max(0, Math.min(NEARBY_DATE_COUNT - 1, indexRef.current + delta!)));
  }

  return (
    <div
      className="date-scrubber relative w-20 shrink-0 select-none"
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
          const next = nearbyDateIndex(event.clientX, rect.left, rect.width);
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
        aria-label={`${pick(canScrub ? advHome.previewDates : advHome.pickDate, locale)}: ${dateLine}`}
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
        onClick={(event) => {
          if (!canScrub) { onOpenCalendar(); return; }
          const picked = dates[indexRef.current];
          close();
          onPickDate(picked, event.detail > 0);
        }}
        className={cn(
          "date-scrubber-face relative z-10 h-18 w-full rounded-xl border border-hairline bg-card p-0 hover:bg-card active:not-aria-[haspopup]:translate-y-0 transition-colors",
          selectedDay === todayKey ? "text-brand-muted-foreground hover:text-brand-muted-foreground" : selectedDay < todayKey ? "text-muted-foreground hover:text-muted-foreground" : "text-foreground hover:text-foreground"
        )}
      >
        {children}
      </Button>
      <span id={helpId} className="sr-only">{pick(advHome.previewDateHelp, locale)}</span>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{keyboard && open ? previewLabel : ""}</span>

      <div aria-hidden="true" className="date-scrubber-strip pointer-events-none absolute inset-x-0 top-full h-12 overflow-y-clip">
        <div className="mt-1 grid h-4" style={{ gridTemplateColumns: `repeat(${NEARBY_DATE_COUNT}, minmax(0, 1fr))` }}>
          {dates.map((tickDate, index) => {
            const order = NEARBY_DATE_RADIUS - Math.abs(index - NEARBY_DATE_RADIUS); // outside pair → inside pair → centre
            const length = barLengths[Math.min(NEARBY_DATE_RADIUS, Math.abs(index - preview))];
            const key = dayKeyOf(tickDate);
            return (
              <span
                key={index}
                className="date-scrubber-bar flex h-full justify-center"
                style={{ transitionDelay: `${(open ? order : NEARBY_DATE_RADIUS - order) * CONTROL_REVEAL.stagger}ms` }}
              >
                <span
                  className={cn("date-scrubber-tick block h-full w-0.5 origin-top rounded-full", key === todayKey ? "bg-primary" : key < todayKey ? "bg-muted-foreground" : "bg-foreground")}
                  style={{ transform: `scaleY(${length / barLengths[0]})` }}
                />
              </span>
            );
          })}
        </div>
        <div className="date-scrubber-bubble absolute inset-x-0 top-6">
          <div className="date-scrubber-cursor relative w-full" style={{ transform: `translateX(${((preview + 0.5) / NEARBY_DATE_COUNT - 0.5) * 100}%)` }}>
            <Badge
              variant="secondary"
              className={cn(
                "date-scrubber-badge absolute left-1/2 min-w-6 max-w-20 overflow-visible rounded-lg px-1.5 text-body-compact font-semibold tabular-nums transition-colors",
                previewTone === "today" ? "bg-primary text-primary-foreground" : previewTone === "past" ? "bg-accent-strong text-foreground" : "bg-foreground text-background"
              )}
              style={{ "--scrub-anchor": ((preview + 0.5) / NEARBY_DATE_COUNT) * 100 } as React.CSSProperties}
              title={previewLabel}
            >
              <span className="date-scrubber-pointer absolute -top-1 size-1.5 -translate-x-1/2 rounded-full bg-inherit" />
              <span className="min-w-0 truncate">{bubbleLabel}</span>
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
