"use client";

/**
 * How every bulk list pins, and how many rows a page of it holds.
 *
 * The pinned thing is one whole unit: the list's toolbar (its filters, search and place in
 * the pages) with the column headings under it, on one opaque white plate as wide as the
 * list's panel, flush under the page's sticky stack (the top bar and, on a batch, its
 * steps). Once pinned, a hairline and a soft shadow ease in under it, so the list reads as
 * running on beneath its own head (owner, 2026-11-17: the headings' rounded well pinned on
 * its own, rows peeking around it, "a broken piece that just got stuck"; the Your filings
 * dock and the Pending tasks toolbar were the references).
 *
 * The headings pin only while the table fits its width. Where it can't (a narrow desk with
 * the rail open) the table scrolls sideways instead, a scrolling box would hold the
 * headings in place of the page, and the toolbar pins alone.
 *
 * Under `md` nothing pins: the toolbar wraps to several lines on a phone and would eat
 * the screen.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/** The app's top bar (`TOP_BAR_HEIGHT`, 3.5rem), in rem. */
const TOP_BAR_REM = 3.5;
/** White under the headings' well once pinned: the panel's own inset (`p-2`). */
const PLATE_FOOT = 8;

type ElRef = (el: HTMLDivElement | null) => void;
type SpanRef = (el: HTMLSpanElement | null) => void;

export type ListDock = {
  bar: HTMLDivElement | null;
  /** The bar has reached its pinned place (and pins at this width). */
  stuck: boolean;
  /** The table can't fit its width: it scrolls sideways and its headings don't pin. */
  tight: boolean;
  /** Where the bar pins, in px from the viewport's top. */
  top: number;
  /** Space above the bar's content the plate covers once pinned (a card header's air). */
  lift: number;
  /** Space between the bar and the pinned headings (a card's own gap under its header). */
  gap: number;
  barH: number;
  headH: number;
  /** The plate's reach past the bar to the panel's inner edges, left and right. */
  left: number;
  right: number;
};

type Measure = Pick<ListDock, "top" | "barH" | "headH" | "tight" | "left" | "right"> & { pins: boolean };

const same = (a: Measure, b: Measure) =>
  (Object.keys(a) as (keyof Measure)[]).every((k) => a[k] === b[k]);

/** Where the page's sticky stack ends: the batch's steps row if there is one, else the top bar. */
function stackBottom(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const bar = TOP_BAR_REM * rem;
  const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement;
  if (!steps) return bar;
  return (parseFloat(getComputedStyle(steps).top) || bar) + steps.offsetHeight;
}

/**
 * The dock's measurements, and its callback refs apart (a ref is never read during
 * render): `dock`, `sentinelRef` and `barRef` to `<ListDock>`, which places the last two,
 * `boxRef` to the box around the table, and `dockHead(dock)` to its `TableHeader`.
 * `lift` is the air above the bar's content that pins with it (a card header, whose own
 * padding scrolls away); `gap` the space kept between the bar and the pinned headings.
 */
export function useListDock({ lift = 0, gap = 0 }: { lift?: number; gap?: number } = {}): { dock: ListDock; sentinelRef: SpanRef; barRef: ElRef; boxRef: ElRef } {
  const [sentinel, setSentinel] = React.useState<HTMLSpanElement | null>(null);
  const [bar, setBar] = React.useState<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  const [m, setM] = React.useState<Measure>({ top: 56 + lift, barH: 0, headH: 0, tight: false, left: 0, right: 0, pins: false });
  const [past, setPast] = React.useState(false);

  const measure = React.useCallback(() => {
    const table = box?.querySelector("table");
    const head = box?.querySelector("thead");
    const card = bar?.closest<HTMLElement>("[data-slot=card]");
    let left = 0;
    let right = 0;
    if (bar && card) {
      const c = card.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      const borderR = card.offsetWidth - card.clientWidth - card.clientLeft;
      left = Math.round(b.left - c.left - card.clientLeft);
      right = Math.round(c.right - borderR - b.right);
    }
    const next: Measure = {
      top: Math.round(stackBottom()) + lift,
      barH: bar?.offsetHeight ?? 0,
      headH: head?.offsetHeight ?? 0,
      tight: !!table && !!box && table.scrollWidth > box.clientWidth + 1,
      left,
      right,
      pins: !!bar && getComputedStyle(bar).position === "sticky",
    };
    setM((prev) => (same(prev, next) ? prev : next));
  }, [bar, box, lift]);

  // Measured on every size change of what decides it (a ResizeObserver also reports once
  // on observing): the bar's wrap, the steps row, the panel, the table and its headings.
  // The table comes and goes with what the list shows, so it is re-found on each change
  // inside the box. State changes only when a number does.
  React.useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    const watch = () => {
      ro.disconnect();
      const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement;
      for (const el of [bar, box, box?.querySelector("table"), box?.querySelector("thead"), steps, bar?.closest("[data-slot=card]")])
        if (el) ro.observe(el);
    };
    watch();
    const mo = new MutationObserver(watch);
    if (box) mo.observe(box, { childList: true });
    const table = box?.querySelector("[data-slot=table-container]");
    if (table) mo.observe(table, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [bar, box, measure]);

  // Pinned once a hair-line just above the bar's top (it rides with the bar) is under the
  // sticky stack: at rest the bar sits lower and the line is in view.
  React.useEffect(() => {
    if (!sentinel) return;
    const edge = m.top;
    const io = new IntersectionObserver(
      ([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < edge),
      { rootMargin: `-${edge}px 0px 0px 0px` },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [sentinel, m.top]);

  const dock = {
    bar,
    stuck: past && m.pins,
    tight: m.tight,
    top: m.top,
    lift,
    gap,
    barH: m.barH,
    headH: m.headH,
    left: m.left,
    right: m.right,
  };
  return { dock, sentinelRef: setSentinel, barRef: setBar, boxRef: setBox };
}

/** The `TableHeader`'s pin: under the bar, above the plate, unless the table scrolls sideways. */
export function dockHead(d: ListDock): { className?: string; style?: React.CSSProperties } {
  return d.tight ? {} : {
        className: "z-[11] md:sticky md:top-(--head-top)",
        style: { "--head-top": `${d.top + d.barH + d.gap}px` } as React.CSSProperties,
      };
}

/** The box around the table: clipped, not scrolled, so its headings can pin to the page. */
export function dockBox(d: ListDock): string {
  return d.tight ? "overflow-x-auto" : "overflow-x-clip [&>[data-slot=table-container]]:overflow-visible";
}

/**
 * The pinned bar. Once pinned it stands on an opaque, square-cornered white plate that
 * reaches the panel's inner edges and runs on down behind the headings, so nothing shows
 * through or around it; the hairline and shadow under the plate ease in. At rest there is
 * no plate: the panel behind is the same white, and keeps its rounded corners. The panel around it must not clip (`overflow-visible`).
 */
export function ListDock({
  dock,
  sentinelRef,
  barRef,
  className,
  children,
  ...props
}: { dock: ListDock; sentinelRef: SpanRef; barRef: ElRef; className?: string; children: React.ReactNode } & Omit<
  React.ComponentProps<"div">,
  "ref" | "className" | "children"
>) {
  const foot = dock.stuck && dock.headH && !dock.tight ? dock.gap + dock.headH + PLATE_FOOT : 0;
  const reach = { left: -dock.left, right: -dock.right, top: dock.stuck ? -dock.lift : 0, bottom: -foot };
  return (
    <>
      <div
        {...props}
        ref={barRef}
        data-list-bar
        data-stuck={dock.stuck || undefined}
        // The offset applies only where the bar pins: on a relative bar it would shift it.
        className={cn("group/dock relative z-10 md:sticky md:top-(--dock-top)", className)}
        style={{ "--dock-top": `${dock.top}px` } as React.CSSProperties}
      >
        {/* Says when the bar is pinned (`useListDock`): a line 2px above its top. */}
        <span ref={sentinelRef} aria-hidden className="pointer-events-none absolute inset-x-0 -top-0.5 h-px" />
        {/* The plate, then its edge over it (same layer, later in order): a hairline and the
            overlay shadow, clipped to show below the plate only. */}
        <span
          aria-hidden
          className={cn("pointer-events-none absolute -z-10 bg-card", !dock.stuck && "hidden")}
          style={reach}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -z-10 border-b border-hairline opacity-0 shadow-overlay transition-opacity duration-200 ease-out group-data-stuck/dock:opacity-100 motion-reduce:transition-none"
          style={{ ...reach, clipPath: "inset(0 0 -3rem 0)" }}
        />
        {children}
      </div>
    </>
  );
}

/**
 * Back to the top of the list when a page changes below the pinned bar, so the new page
 * reads from its first row: the page scrolls until the bar is back at its resting place.
 * False where the list has no dock.
 */
export function toListTop(from: Element | null) {
  const bar = from?.closest("[data-slot=card]")?.querySelector<HTMLElement>("[data-list-bar]");
  if (!bar) return false;
  requestAnimationFrame(() => {
    // The bar's resting top, read off the first shown thing after it (a pinned bar's own
    // box is where it is pinned, not where it rests).
    let next = bar.nextElementSibling as HTMLElement | null;
    while (next && !next.getClientRects().length) next = next.nextElementSibling as HTMLElement | null;
    if (!next) return;
    const gap = parseFloat(getComputedStyle(bar.parentElement!).rowGap) || 0;
    const rest = next.getBoundingClientRect().top - (parseFloat(getComputedStyle(next).marginTop) || 0) - gap - bar.offsetHeight;
    const pin = parseFloat(bar.style.getPropertyValue("--dock-top")) || 0;
    if (rest >= pin - 1) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: rest - pin, behavior: smooth ? "smooth" : "auto" });
  });
  return true;
}

/* ───────────────────────────── Rows per page ───────────────────────────── */

const FIT_MIN = 8;
const FIT_MAX = 25;
/** Before a row can be measured. */
const FIT_FALLBACK = 12;
/** Air kept between the last row and the pager, so the page never ends on a cut row. */
const FIT_AIR = 16;
/** A pager row, when none is drawn yet (one page). */
const PAGER_GUESS = 56;

/** How many rows of this list fit the viewport under everything that stays on screen. */
function fitOf(d: ListDock): number | null {
  const card = d.bar?.closest("[data-slot=card]");
  if (!card) return null;
  const rows = [...card.querySelectorAll<HTMLElement>("tbody > tr, [data-list-rows] > li")]
    .filter((r) => r.offsetHeight > 0)
    .slice(0, 8);
  if (!rows.length) return null;
  const rowH = rows.reduce((n, r) => n + r.getBoundingClientRect().height, 0) / rows.length;
  const pager = card.querySelector<HTMLElement>("[data-list-pager]")?.offsetHeight || PAGER_GUESS;
  const footer = document.querySelector<HTMLElement>("[data-bulk-footer]")?.offsetHeight ?? 0;
  const head = d.headH && !d.tight ? d.gap + d.headH + PLATE_FOOT : 0;
  const room = window.innerHeight - d.top - d.barH - head - pager - footer - FIT_AIR;
  return Math.min(FIT_MAX, Math.max(FIT_MIN, Math.floor(room / rowH)));
}

/**
 * Rows a page holds: as many as fit the viewport once the list is pinned (the top bar, the
 * steps, the bar and headings, the pager and the footer taken off), from 8 to 25, measured
 * on the real rows. Worked out once the rows are drawn and again when the window is
 * resized by more than half a row, never on smaller changes, so a page doesn't reshuffle
 * under the reader. A size the filer picks from the select is kept.
 *
 * `onResize(from, to)` lets the list keep its first row in view when the size changes.
 */
export function useFitRows(d: ListDock, { onResize }: { onResize?: (from: number, to: number) => void } = {}) {
  const [fit, setFit] = React.useState(FIT_FALLBACK);
  const [picked, setPicked] = React.useState<number | null>(null);
  // What the size was last worked out for; null until it first is.
  const basis = React.useRef<{ h: number; w: number; row: number } | null>(null);
  const latest = React.useRef({ d, fit, picked, onResize });
  React.useEffect(() => {
    latest.current = { d, fit, picked, onResize };
  });

  const measured = d.barH > 0;
  React.useEffect(() => {
    // Not before the dock has measured its bar: an unmeasured bar would count as no height.
    if (!measured || !d.bar) return;
    const card = d.bar.closest("[data-slot=card]");
    if (!card) return;
    const apply = () => {
      const { d: now, fit: was, picked: chose, onResize: cb } = latest.current;
      const b = basis.current;
      // Kept until the window changes by more than half a row (or a column's worth across).
      if (b && Math.abs(window.innerHeight - b.h) < b.row / 2 && Math.abs(window.innerWidth - b.w) < 40) return;
      const n = fitOf(now);
      if (n === null) return;
      const row = card.querySelector<HTMLElement>("tbody > tr, [data-list-rows] > li")?.offsetHeight || 64;
      basis.current = { h: window.innerHeight, w: window.innerWidth, row };
      if (n === was) return;
      setFit(n);
      if (chose === null) cb?.(was, n);
    };
    // First once the rows are drawn (the panel grows with them), then on resizes, settled.
    const ro = new ResizeObserver(() => {
      if (!basis.current) apply();
    });
    ro.observe(card);
    let t: number | undefined;
    const onWin = () => {
      window.clearTimeout(t);
      t = window.setTimeout(apply, 200);
    };
    window.addEventListener("resize", onWin);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
      window.removeEventListener("resize", onWin);
    };
  }, [measured, d.bar]);

  const size = picked ?? fit;
  const sizes = [...new Set([fit, 25, 50, ...(picked ? [picked] : [])])].sort((a, b) => a - b);
  return {
    size,
    fit,
    sizes,
    /** The filer's pick; picking the fitted size goes back to following the window. */
    pick: (n: number) => setPicked(n === fit ? null : n),
  };
}
