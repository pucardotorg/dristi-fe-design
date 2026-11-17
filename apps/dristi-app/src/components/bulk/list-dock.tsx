"use client";

/**
 * How every bulk list pins, and how many rows a page of it holds.
 *
 * Only the column headings pin, so the table can be read as it scrolls; the toolbar above
 * (filters, search, place in the pages) scrolls away with the page (owner, 2026-11-17:
 * "I don't want the pills and search bar and everything sticky ... the table remain sticky
 * so you can read the table properly as you scroll").
 *
 * Pinned, the headings are one whole band, not their rounded well alone: the panel's white
 * reaches its inner edges on either side and keeps the panel's own 8px inset above and
 * below the well, so nothing scrolls into view between the band and the page's sticky
 * stack (the top bar and, on a batch, its steps), and the well's rounded ends stay framed
 * in white. A hairline and a soft shadow ease in under the band only while it is pinned
 * (owner, 2026-11-17, on the earlier well pinned alone: "a broken piece that just got
 * stuck"). At rest there is no band: the panel behind is the same white.
 *
 * The headings pin only while the table fits its width. Where it can't (a narrow desk with
 * the rail open) the table scrolls sideways instead, and a scrolling box would hold the
 * headings in place of the page, so they don't pin. Under `md` nothing pins.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/** The app's top bar (`TOP_BAR_HEIGHT`, 3.5rem), in rem. */
const TOP_BAR_REM = 3.5;
/** White the band keeps above and below the headings' well: the panel's own inset (`p-2`). */
const BAND_AIR = 8;
/** Air between the sticky stack and a list's panel when a page change brings it back. */
const LIST_AIR = 16;

type ElRef = (el: HTMLDivElement | null) => void;
type SpanRef = (el: HTMLSpanElement | null) => void;

export type ListDock = {
  box: HTMLDivElement | null;
  /** The headings have reached their pinned place (and pin at this width). */
  stuck: boolean;
  /** The table can't fit its width: it scrolls sideways and its headings don't pin. */
  tight: boolean;
  /** Where the band's top pins: the bottom of the page's sticky stack, in px. */
  top: number;
  headH: number;
};

/** `useListDock`'s result: hand it whole to `<ListBox>`, and `dock` to the rest. */
export type ListDockHandle = { dock: ListDock; boxRef: ElRef; sentinelRef: SpanRef };

type Measure = Pick<ListDock, "top" | "headH" | "tight">;

const same = (a: Measure, b: Measure) => a.top === b.top && a.headH === b.headH && a.tight === b.tight;

/** Where the page's sticky stack ends: the batch's steps row if there is one, else the top bar. */
function stackBottom(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const bar = TOP_BAR_REM * rem;
  const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement;
  if (!steps) return bar;
  return (parseFloat(getComputedStyle(steps).top) || bar) + steps.offsetHeight;
}

/**
 * The list's pinning: pass the result to `<ListBox>` around the table and `dockHead(dock)`
 * to its `TableHeader`. Callback refs, so nothing reads a ref during render.
 */
export function useListDock(): ListDockHandle {
  const [sentinel, setSentinel] = React.useState<HTMLSpanElement | null>(null);
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  const [m, setM] = React.useState<Measure>({ top: 56, headH: 0, tight: false });
  const [past, setPast] = React.useState(false);

  const measure = React.useCallback(() => {
    const table = box?.querySelector("table");
    const head = box?.querySelector("thead");
    const container = box?.querySelector<HTMLElement>("[data-slot=table-container]");
    const next: Measure = {
      top: Math.round(stackBottom()),
      headH: head?.offsetHeight ?? 0,
      // The table's own width, not its scroll width: the pinned band reaches past it.
      tight: !!table && !!container && table.offsetWidth > container.clientWidth + 1,
    };
    setM((prev) => (same(prev, next) ? prev : next));
  }, [box]);

  // Measured on every size change of what decides it (a ResizeObserver also reports once
  // on observing): the steps row, the box, the table and its headings. The table comes
  // and goes with what the list shows, so it is re-found on each change inside the box.
  // State changes only when a number does.
  React.useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    const watch = () => {
      ro.disconnect();
      const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement;
      for (const el of [box, box?.querySelector("table"), box?.querySelector("thead"), steps]) if (el) ro.observe(el);
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
  }, [box, measure]);

  // Pinned once a hair-line at the table's top has gone above where the headings pin
  // (under the band's top air): at rest the table sits lower and the line is in view.
  React.useEffect(() => {
    if (!sentinel) return;
    const edge = m.top + BAND_AIR;
    const io = new IntersectionObserver(
      ([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < edge),
      { rootMargin: `-${edge}px 0px 0px 0px` },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [sentinel, m.top]);

  return {
    dock: { box, stuck: past && !m.tight, tight: m.tight, top: m.top, headH: m.headH },
    boxRef: setBox,
    sentinelRef: setSentinel,
  };
}

/**
 * The `TableHeader`'s pin, and the band it stands on once pinned: two layers behind the
 * well, reaching the panel's inner edges and `BAND_AIR` above and below it. The first is
 * the opaque white, shown only while pinned (at rest the panel is that white already);
 * the second its edge, a hairline and the overlay shadow, clipped to show below the band
 * only, easing in. Nothing, where the table scrolls sideways.
 */
export function dockHead(d: ListDock): { className?: string; style?: React.CSSProperties; "data-stuck"?: true } {
  if (d.tight) return {};
  return {
    "data-stuck": d.stuck || undefined,
    className: cn(
      "z-[11] md:sticky md:top-(--head-top)",
      "before:pointer-events-none before:absolute before:-inset-x-2 before:-inset-y-2 before:-z-10 before:hidden before:bg-card md:data-stuck:before:block",
      "after:pointer-events-none after:absolute after:-inset-x-2 after:-inset-y-2 after:-z-10 after:border-b after:border-hairline after:opacity-0 after:shadow-overlay after:[clip-path:inset(0_0_-3rem_0)] after:transition-opacity after:duration-200 after:ease-out motion-reduce:after:transition-none md:data-stuck:after:opacity-100",
    ),
    style: { "--head-top": `${d.top + BAND_AIR}px` } as React.CSSProperties,
  };
}

/**
 * The box around the table. It runs out over the panel's 8px inset (and pads it back), so
 * the band can reach the panel's inner edges; clipped there, not scrolled, so the headings
 * can pin to the page. A table too wide for it scrolls sideways in it instead.
 *
 * Whatever takes focus in a row is scrolled clear of the pinned band, not under it.
 */
export function ListBox({
  list,
  className,
  children,
}: {
  list: ListDockHandle;
  className?: string;
  children: React.ReactNode;
}) {
  const { dock, boxRef, sentinelRef } = list;
  const clear = dock.tight ? undefined : dock.top + dock.headH + 2 * BAND_AIR + BAND_AIR;
  return (
    <div
      ref={boxRef}
      data-list-box
      className={cn(
        "relative -mx-2 px-2",
        dock.tight
          ? "overflow-x-auto"
          : "overflow-x-clip md:[&_tbody_*]:scroll-mt-(--row-clear) [&>[data-slot=table-container]]:overflow-visible",
        className,
      )}
      style={clear ? ({ "--row-clear": `${clear}px` } as React.CSSProperties) : undefined}
    >
      {/* Says when the headings are pinned (`useListDock`): a line just above the table. */}
      <span ref={sentinelRef} aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px" />
      {children}
    </div>
  );
}

/**
 * Back to the top of the list when its page changes, so the new page reads from its first
 * row: the page scrolls until the list's panel sits just under the sticky stack, when it
 * has gone above it. False where the list has no `ListBox`.
 */
export function toListTop(from: Element | null) {
  const card = from?.closest<HTMLElement>("[data-slot=card]");
  if (!card?.querySelector("[data-list-box]")) return false;
  requestAnimationFrame(() => {
    const target = stackBottom() + LIST_AIR;
    const top = card.getBoundingClientRect().top;
    if (top >= target - 1) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: top - target, behavior: smooth ? "smooth" : "auto" });
  });
  return true;
}

/* ───────────────────────────── Rows per page ───────────────────────────── */

/** The page sizes a list fits itself to, smallest first; the smallest is the floor. */
const FIT_STEPS = [10, 12, 15, 20] as const;
/** Every size the per-page select offers, on every bulk list. */
export const PAGE_SIZES: readonly number[] = [...FIT_STEPS, 25, 50];
/** Air kept between the last row and the pager, so the page never ends on a cut row. */
const FIT_AIR = 16;
/** A pager row, when none is drawn yet (one page). */
const PAGER_GUESS = 56;

/** The largest step whose rows fit the window under everything that stays on screen. */
function fitOf(box: HTMLElement): number | null {
  const card = box.closest("[data-slot=card]");
  if (!card) return null;
  const rows = [...card.querySelectorAll<HTMLElement>("tbody > tr, [data-list-rows] > li")]
    .filter((r) => r.offsetHeight > 0)
    .slice(0, 8);
  if (!rows.length) return null;
  const rowH = rows.reduce((n, r) => n + r.getBoundingClientRect().height, 0) / rows.length;
  const head = box.querySelector<HTMLElement>("thead");
  const band = head && head.offsetHeight && getComputedStyle(head).position === "sticky" ? head.offsetHeight + 2 * BAND_AIR : 0;
  const pager = card.querySelector<HTMLElement>("[data-list-pager]")?.offsetHeight || PAGER_GUESS;
  const footer = document.querySelector<HTMLElement>("[data-bulk-footer]")?.offsetHeight ?? 0;
  const room = window.innerHeight - stackBottom() - band - pager - footer - FIT_AIR;
  return [...FIT_STEPS].reverse().find((n) => n * rowH <= room) ?? FIT_STEPS[0];
}

/**
 * Rows a page holds: the largest of 10, 12, 15 and 20 whose rows fit the window with the
 * list scrolled under its pinned headings (the top bar, the steps, the band, the pager and
 * the footer taken off), measured on the real rows; never under 10. Decided once, when the
 * list's rows are first drawn, and kept for as long as the list is open: a resize doesn't
 * reshuffle the page under the reader. A size the filer picks from the select wins.
 *
 * `onFit(from, to)` lets the list keep its first row in view when the decided size lands.
 */
export function useFitRows(d: ListDock, { onFit }: { onFit?: (from: number, to: number) => void } = {}) {
  const [fit, setFit] = React.useState<number>(FIT_STEPS[0]);
  const [picked, setPicked] = React.useState<number | null>(null);
  const decided = React.useRef(false);
  const latest = React.useRef({ fit, onFit });
  React.useEffect(() => {
    latest.current = { fit, onFit };
  });

  const box = d.box;
  React.useEffect(() => {
    const card = box?.closest("[data-slot=card]");
    if (!box || !card || decided.current) return;
    // Once the rows are drawn: the panel grows with them, and a ResizeObserver reports then.
    const ro = new ResizeObserver(() => {
      if (decided.current) return;
      const n = fitOf(box);
      if (n === null) return;
      decided.current = true;
      ro.disconnect();
      const { fit: was, onFit: cb } = latest.current;
      if (n === was) return;
      setFit(n);
      cb?.(was, n);
    });
    ro.observe(card);
    return () => ro.disconnect();
  }, [box]);

  const size = picked ?? fit;
  return {
    size,
    fit,
    sizes: sizesWith(size),
    /** The filer's pick; picking the fitted size goes back to it. */
    pick: (n: number) => setPicked(n === fit ? null : n),
  };
}

/** The per-page choices, with a size from elsewhere (an address) kept among them. */
export function sizesWith(size: number): number[] {
  return [...new Set([...PAGE_SIZES, size])].sort((a, b) => a - b);
}
