"use client";

import * as React from "react";
import { Check, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { advHome, fillCopy } from "@/lib/advocate/content";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";

/** How long the arrow keeps spinning after a click — a beat of motion even when
 *  the data comes back at once — and how long the tick lingers before it resets. */
const SPIN_MS = 900;
const DONE_MS = 2000;

type Phase = "idle" | "spinning" | "done";

/**
 * The three-beat refresh gesture, shared by the home button and the cause list:
 * click → the arrow spins → a tick confirms → it settles back to the arrow. The
 * caller's `onRefresh` runs at the click; the motion is the acknowledgement.
 */
export function useRefreshPhase(onRefresh: () => void): {
  phase: Phase;
  trigger: () => void;
} {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const timers = React.useRef<number[]>([]);
  React.useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
    },
    []
  );
  const trigger = React.useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    setPhase("spinning");
    onRefresh();
    timers.current.push(window.setTimeout(() => setPhase("done"), SPIN_MS));
    timers.current.push(
      window.setTimeout(() => setPhase("idle"), SPIN_MS + DONE_MS)
    );
  }, [onRefresh]);
  return { phase, trigger };
}

/** The icon for a phase: a spinning arrow while refreshing, a green tick when
 *  just done, the plain arrow at rest. */
export function RefreshIcon({
  phase,
  className,
}: {
  phase: Phase;
  className?: string;
}) {
  if (phase === "done") {
    return <Check aria-hidden="true" className={cn("text-success-ink", className)} />;
  }
  return (
    <RotateCw
      aria-hidden="true"
      className={cn(phase === "spinning" && "motion-safe:animate-spin", className)}
    />
  );
}

/**
 * The home board's refresh: an icon button that runs the gesture, and — revealed
 * from under it on hover, and again in green right after a refresh — the last
 * refreshed time. The caption is absolutely placed in the row's existing bottom
 * gap, so revealing it shifts nothing below.
 */
export function HomeRefreshButton({
  onRefresh,
  locale,
}: {
  onRefresh: () => void;
  locale: Locale;
}) {
  const [lastAt, setLastAt] = React.useState(() => Date.now());
  const { phase, trigger } = useRefreshPhase(() => {
    onRefresh();
    setLastAt(Date.now());
  });
  const intl = locale === "ml" ? "ml-IN" : "en-IN";
  const timeLabel = new Intl.DateTimeFormat(intl, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(lastAt));

  return (
    <div className="group/refresh relative">
      <Button
        variant="outline"
        size="sm"
        onClick={trigger}
        aria-label={pick(advHome.refreshHearings, locale)}
        className="size-10 border-border px-2.5 lg:size-9"
      >
        <RefreshIcon phase={phase} />
      </Button>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-full right-0 mt-2 whitespace-nowrap text-caption lg:top-auto lg:bottom-full lg:mt-0 lg:mb-2 transition-all duration-200 ease-out",
          phase === "done"
            ? "translate-y-0 font-medium text-success-ink opacity-100"
            : "translate-y-1 text-muted-foreground opacity-0 group-hover/refresh:translate-y-0 group-hover/refresh:opacity-100"
        )}
      >
        {phase === "done"
          ? pick(advHome.refreshedDone, locale)
          : fillCopy(advHome.lastRefreshed, locale, { time: timeLabel })}
      </span>
    </div>
  );
}
