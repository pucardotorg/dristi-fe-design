"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import "./rolling-day.css";

/** How long each digit waits behind the one to its right. */
const STAGGER_MS = 90;

type Faces = { current: string; previous: string | null; up: boolean; turn: number };

/**
 * One digit of the odometer. When its value changes it keeps the old face for
 * one roll, so the old and new faces can pass each other in the clipped window.
 * A digit that did not change does not move: 06 to 07 rolls only the 7.
 */
function RollingDigit({ digit, up, delay }: { digit: string; up: boolean; delay: number }) {
  const [faces, setFaces] = React.useState<Faces>({
    current: digit,
    previous: null,
    up,
    turn: 0,
  });
  // Derived during render, not in an effect: the new face must paint in the
  // same frame the value changes, or the old number flashes once first.
  if (faces.current !== digit) {
    setFaces({ current: digit, previous: faces.current, up, turn: faces.turn + 1 });
  }
  const direction = faces.up ? "up" : "down";
  const rolling = faces.previous !== null;

  return (
    <span className="relative inline-block overflow-y-clip">
      {rolling ? (
        <span
          key={`out-${faces.turn}`}
          data-roll={`out-${direction}`}
          style={{ animationDelay: `${delay}ms` }}
          onAnimationEnd={() => setFaces((f) => (f.turn === faces.turn ? { ...f, previous: null } : f))}
          className="rolling-face absolute inset-0"
        >
          {faces.previous}
        </span>
      ) : null}
      <span
        key={`in-${faces.turn}`}
        data-roll={rolling ? `in-${direction}` : undefined}
        style={rolling ? { animationDelay: `${delay}ms` } : undefined}
        className={cn("block", rolling && "rolling-face")}
      >
        {faces.current}
      </span>
    </span>
  );
}

/**
 * A number that rolls digit by digit when it changes, the rightmost first and
 * each one to its left a beat later, so the digits never turn as one block.
 * `up` says which way the value moved. Hidden from assistive tech: the caller
 * states the date in words.
 */
export function RollingNumber({
  value,
  up,
  className,
}: {
  value: string;
  up: boolean;
  className?: string;
}) {
  const digits = value.split("");
  return (
    <span aria-hidden="true" className={cn("inline-flex tabular-nums", className)}>
      {digits.map((digit, i) => (
        <RollingDigit
          // Keyed by place, so the tens digit stays the tens digit across rolls.
          key={digits.length - i}
          digit={digit}
          up={up}
          delay={(digits.length - 1 - i) * STAGGER_MS}
        />
      ))}
    </span>
  );
}
