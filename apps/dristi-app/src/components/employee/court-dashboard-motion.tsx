"use client";

import * as React from "react";

import { CONTROL_REVEAL, STAGE_SLIDE_OPTIONS } from "@/components/chrome/motion";

/**
 * The dashboard's data motion, from the owner's Case Flow v4 design: figures count up,
 * bars and columns grow in, and the stage path's dots trickle once. (A trend's line draws
 * through the chart library's own animation, switched off under reduced motion.)
 *
 * Every movement here is one-shot. It plays when its data arrives or changes and then
 * stops — the dots stop within five seconds (WCAG 2.2.2) — and none of it plays when the
 * reader asks for reduced motion. Timing and easing come from the shared motion
 * vocabulary (`chrome/motion.ts`); the movements are run with the Web Animations API, so
 * nothing loops in CSS and an interrupted animation is cancelled, not left half-way.
 */

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

/** True when the reader asks for reduced motion — and on the server, so nothing moves before hydration. */
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}

const GROW_MS = 500;

/**
 * Grow the marks inside `ref` in, once per `trigger`: every element carrying `data-grow`
 * ("y" from its foot, "x" from its start), staggered.
 */
export function useGrowIn(ref: React.RefObject<HTMLElement | null>, trigger: string) {
  const reduced = useReducedMotion();
  React.useEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const marks = [...root.querySelectorAll<HTMLElement>("[data-grow]")];
    const running = marks.map((el, i) =>
      el.animate(
        [{ transform: el.dataset.grow === "x" ? "scaleX(0)" : "scaleY(0)" }, { transform: "none" }],
        {
          duration: GROW_MS,
          easing: STAGE_SLIDE_OPTIONS.easing,
          delay: Math.min(i, 24) * CONTROL_REVEAL.stagger,
          fill: "backwards",
        },
      ),
    );
    return () => running.forEach((a) => a.cancel());
  }, [ref, trigger, reduced]);
}

/**
 * A figure that counts up to its value when it first shows and whenever it changes. The
 * value is always the rendered text — the count is written over it while it runs — so a
 * reader who asks for reduced motion, a screen reader and the server all get the figure.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const shown = React.useRef<number | null>(null);
  const reduced = useReducedMotion();
  React.useEffect(() => {
    const el = ref.current;
    const from = shown.current ?? value * 0.85;
    shown.current = value;
    if (!el || reduced || from === value) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = format(from + (value - from) * eased);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = format(value);
    };
  }, [value, format, reduced]);
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}

/** How long the stage path's dots may move: under the five seconds WCAG 2.2.2 allows. */
export const TRICKLE_LIMIT_MS = 4500;

/**
 * A short track whose dots trickle along it, faster the more cases moved, and then come
 * to rest, all within `TRICKLE_LIMIT_MS`. At rest (and always, under reduced motion) two
 * still dots mark the track; the count beside it is the information.
 */
export function TrickleDots({ count, trigger }: { count: number; trigger: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  React.useEffect(() => {
    const track = ref.current;
    if (!track || reduced || !count) return;
    // The last dot starts two thirds of a lap late, so one lap plus that wait must fit.
    const duration = Math.min(TRICKLE_LIMIT_MS * 0.6, Math.max(900, 3200 - Math.log2(count + 1) * 450));
    const iterations = Math.max(1, Math.floor((TRICKLE_LIMIT_MS - (duration * 2) / 3) / duration));
    const total = (duration * 2) / 3 + duration * iterations;
    const moving = [...track.querySelectorAll<HTMLElement>("[data-dot]")].map((dot, i) =>
      dot.animate(
        [
          { transform: "translateX(0)", opacity: 1 },
          { transform: "translateX(2rem)", opacity: 1 },
        ],
        { duration, iterations, delay: (i * duration) / 3, easing: "linear", fill: "none" },
      ),
    );
    const resting = [...track.querySelectorAll<HTMLElement>("[data-rest]")].map((dot) =>
      dot.animate([{ opacity: 0 }, { opacity: 0 }], { duration: total, fill: "none" }),
    );
    return () => [...moving, ...resting].forEach((a) => a.cancel());
  }, [count, trigger, reduced]);
  return (
    <span
      ref={ref}
      aria-hidden
      className="relative block h-3 w-7 overflow-hidden rounded-full border border-border bg-card"
    >
      {count ? (
        <>
          <span data-rest className="absolute top-1 left-1.5 size-1 rounded-full bg-primary" />
          <span data-rest className="absolute top-1 right-1.5 size-1 rounded-full bg-primary" />
        </>
      ) : null}
      {reduced || !count
        ? null
        : [0, 1, 2].map((i) => (
            <span
              key={i}
              data-dot
              className="absolute top-1 -left-1.5 size-1 rounded-full bg-primary opacity-0"
            />
          ))}
    </span>
  );
}
