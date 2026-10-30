"use client";

import * as React from "react";
import { InfoIcon, Trash2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The one feedback mark: a solid disc with a glyph, in six tones.
 *
 * Every success, failure, warning and notice in the product carries this mark, at one of
 * a few sizes, so a person learns one shape and reads it everywhere
 * (docs/design/features/feedback-states.md).
 *
 * - **success**: a check. It draws itself, with one ring pulse.
 * - **error**: a cross. Each stroke springs out from the centre, 140ms apart. It shakes
 *   only with `reject`, when the person's own input was refused (a wrong OTP, a field).
 *   It never shakes for a system failure, because a shake reads as "you did it wrong".
 * - **warning**: a slim "!" (a filled bar and dot with a clear gap, so it reads without
 *   colour). The bar drops in, the dot pops under it, then a small sway with a soft pulse.
 *   Use it only where something happened with a catch, or needs a look.
 * - **info**: sent, not decided. The hourglass, turned over once.
 * - **neutral**: not news at all (a gate, a question, a dead end). A quiet disc with a dark
 *   hairline ring, carrying the act's own `icon` (an info icon if none is given).
 * - **danger**: the question before a removal. The soft red of the destructive button,
 *   carrying the act's own `icon` (a bin if none is given). It is a question, so it never
 *   wears the cross.
 *
 * **Motion is budgeted by size.** 44px and up plays the full sequence (about 600ms).
 * Anything smaller pops its disc and scales its glyph in after it (one beat, about half a
 * second). `still` plays nothing: for every mark after the first in one screen, and for
 * states that are already true when the screen opens.
 */

export type MarkTone = "success" | "error" | "warning" | "info" | "neutral" | "danger";
export type MarkSize = 14 | 16 | 20 | 24 | 40 | 56 | 60 | 72 | 96;

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

const SIZE: Record<MarkSize, string> = {
  14: "size-3.5",
  16: "size-4",
  20: "size-5",
  24: "size-6",
  40: "size-10",
  56: "size-14",
  60: "size-15",
  72: "size-18",
  96: "size-24",
};

/* Status pairs only: solid + foreground, or muted + its ink. No alpha. */
const DISC: Record<MarkTone, string> = {
  success: "bg-success text-success-foreground",
  error: "bg-destructive text-destructive-foreground",
  warning: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
  neutral: "bg-surface-sunken text-foreground ring-1 ring-input ring-inset",
  danger: "bg-destructive-muted text-destructive-ink",
};

const RING: Partial<Record<MarkTone, string>> = {
  success: "bg-success",
  warning: "bg-warning",
};

/**
 * A hero mark waits this long before it plays, and an outcome's words wait with it
 * (owner, 2026-10-30). The window has just changed under the person's eyes; they need about
 * this long to look back at it, and the window needs it to settle. Under 200ms it reads
 * as the window settling, not as lag.
 */
export const HERO_START = 160;


/**
 * Hold a hero mark on its first frame until the browser has painted it, so a slow first
 * render cannot eat the start of the motion. Two frames is "painted"; the timer is the
 * fallback for a hidden tab, where frames never come.
 */
function usePainted(enabled: boolean) {
  const [painted, setPainted] = React.useState(!enabled);
  React.useEffect(() => {
    if (!enabled) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPainted(true));
    });
    const fallback = window.setTimeout(() => setPainted(true), 120);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(fallback);
    };
  }, [enabled]);
  return painted;
}

export function StatusMark({
  tone = "success",
  size = 24,
  icon,
  still = false,
  reject = false,
  delay,
  className,
  label,
}: {
  tone?: MarkTone;
  size?: MarkSize;
  /** The act's own icon. Neutral and danger marks only. */
  icon?: IconType;
  still?: boolean;
  /** The person's own input was refused: one small shake after the mark lands. */
  reject?: boolean;
  /** Start later, so marks that belong together play one after the other. */
  delay?: number;
  className?: string;
  /** Read out only where the mark is the sole carrier of the meaning; usually the text
      beside it already says it, so the mark stays hidden from assistive tech. */
  label?: string;
}) {
  const full = !still && size >= 44;
  const quick = !still && !full;
  const small = size <= 24;
  const stroke = size <= 24 ? 3.4 : size <= 44 ? 3 : 2.6;
  const iconTone = tone === "neutral" || tone === "danger";
  const glyphShare = tone === "success" || tone === "info" ? 0.5 : tone === "warning" ? 0.7 : 0.62;
  const ring = full ? RING[tone] : undefined;
  const painted = usePainted(full);
  /* A hero mark starts after `HERO_START`; `delay` is on top of it. */
  const start = (full ? HERO_START : 0) + (delay ?? 0);
  /* A neutral or danger mark always shows an icon of its own: never the info hourglass,
     which means "sent, not decided". */
  const Icon = iconTone ? (icon ?? (tone === "danger" ? Trash2Icon : InfoIcon)) : undefined;

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        SIZE[size],
        full && tone === "warning" && "fb-sway",
        full && tone === "error" && reject && "fb-shake",
        full && !painted && "fb-hold",
        className,
      )}
      style={{
        /* Every part of the mark reads this, so `delay` moves the whole sequence. */
        ["--fb-delay" as string]: start ? `${start}ms` : undefined,
        animationDelay: full && reject ? `${start + 620}ms` : undefined,
      }}
    >
      {ring ? (
        <span
          className={cn("absolute inset-0 rounded-full", ring, tone === "success" ? "fb-ring" : "fb-ring-soft")}
        />
      ) : null}
      <span
        className={cn(
          "relative flex size-full items-center justify-center rounded-full",
          DISC[tone],
          !iconTone && "shadow-raised",
          full && "fb-pop",
          quick && "fb-pop-quick",
        )}
      >
        {iconTone && Icon ? (
          <span className={cn("flex", !still && "fb-glyph-in")}>
            <Icon className={size <= 16 ? "size-2.5" : size <= 24 ? "size-3.5" : size <= 40 ? "size-5" : size <= 72 ? "size-7" : "size-10"} strokeWidth={size <= 24 ? 2.4 : 2} aria-hidden />
          </span>
        ) : (
          <span
            className={cn("flex items-center justify-center", quick && "fb-glyph-in")}
            style={{ width: `${glyphShare * 100}%`, height: `${glyphShare * 100}%` }}
          >
            <svg viewBox="0 0 24 24" className="size-full" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <Glyph tone={tone} full={full} small={small} />
            </svg>
          </span>
        )}
      </span>
    </span>
  );
}

function Glyph({ tone, full, small }: { tone: MarkTone; full: boolean; small: boolean }) {
  if (tone === "success") return <path className={full ? "fb-draw" : undefined} d="M5 12.5l4.5 4.5L19 7.5" />;
  if (tone === "error") {
    return full ? (
      <>
        <path className="fb-stroke" d="M6.5 6.5l11 11" />
        <path className="fb-stroke fb-stroke-2" d="M17.5 6.5l-11 11" />
      </>
    ) : (
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    );
  }
  if (tone === "warning") {
    /* Filled, not stroked, with a clear gap: it still reads as "!" in greyscale. Slim at
       hero size; a touch heavier when small so it does not break up. */
    const w = small ? 3.6 : 3;
    return (
      <g fill="currentColor" stroke="none">
        <rect className={full ? "fb-bar" : undefined} x={12 - w / 2} y="3.5" width={w} height="11" rx={w / 2} />
        <circle className={full ? "fb-dot" : undefined} cx="12" cy="19.2" r={small ? 2.1 : 1.8} />
      </g>
    );
  }
  /* info: sent, not decided. The same hourglass the product used before, turned once. */
  return (
    <g className={full ? "fb-flip" : undefined} strokeWidth={2.2}>
      <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
    </g>
  );
}
