"use client";

import * as React from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

/** Below `sm`: a phone. The same line the dialogs' own `sm:max-w-*` sizes use. */
const PHONE_QUERY = "(max-width: 639.98px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * A workflow on a phone is a window, not a modal (lead designer, Sept 21).
 *
 * A form, a signing step or a payment floating as a card over a dimmed page
 * reads as an interruption of the page. On a phone it is the page: it takes the
 * whole screen and arrives from the right, the direction "further in" already
 * means on a phone, and leaves the same way, so the person reads it as the next
 * screen of the thing they tapped. From `sm` up the same dialog stays a dialog.
 *
 * Underneath it is still the DS `Dialog`. A full-screen takeover wants exactly
 * what a dialog gives: focus held inside, the page behind inert, Escape and a
 * close control. Only the surface and the motion change.
 *
 * Motion (Emil Kowalski's tables): occasional tier, purpose spatial consistency.
 * Transform only, no dissolve, because a window that fades reads as an overlay
 * again. 500ms in on the iOS drawer curve, 300ms out along the same path: the curve
 * covers most of the distance in its first third, so at 300ms the owner read
 * it as a jump (Sept 21). A full-screen surface sits at the long end of the
 * drawer range. With
 * reduced motion the travel goes and a short fade stays.
 *
 * `content-start`: several dialogs are a plain grid, and a grid stretched to the
 * window's height spread its rows apart with wide gaps between them.
 *
 * Spread the result onto `DialogContent`: `className` last in the call site's
 * `cn`, `style` as is. Both are empty from `sm` up.
 */
export function useFlowWindow(): {
  phone: boolean;
  className: string;
  style: React.CSSProperties | undefined;
} {
  const phone = useMediaQuery(PHONE_QUERY);
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  if (!phone) return { phone, className: "", style: undefined };
  return {
    phone,
    className:
      "inset-0 top-0 left-0 h-dvh max-h-none w-screen max-w-none content-start translate-x-0 translate-y-0 rounded-none shadow-none ring-0 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:duration-500 data-closed:duration-300",
    /* The DS dialog's keyframes read their travel, scale and opacity from
       these vars. Set inline they outrank its `fade-in-0 zoom-in-95`. */
    style: (reduced
      ? ({ "--tw-enter-scale": "1", "--tw-exit-scale": "1" } as Record<string, string>)
      : {
          "--tw-enter-opacity": "1",
          "--tw-exit-opacity": "1",
          "--tw-enter-scale": "1",
          "--tw-exit-scale": "1",
          "--tw-enter-translate-x": "100%",
          "--tw-exit-translate-x": "100%",
        }) as React.CSSProperties,
  };
}

/**
 * A confirmation or a notice on a phone rises from the bottom edge (lead
 * designer, Sept 21), where the case peek and the person panel already come
 * from and where the thumb is. It is still the DS `AlertDialog` underneath:
 * a question that must be answered keeps its focus trap and its two buttons.
 * Only where it sits and how it arrives change. From `sm` up it stays centred.
 *
 * Motion: translateY only, 300ms in / 200ms out on the drawer curve; it travels
 * a fraction of what a flow window does, so it keeps the shorter time. Reduced
 * motion keeps the DS fade.
 */
export function useBottomSheet(): {
  className: string;
  style: React.CSSProperties | undefined;
} {
  const phone = useMediaQuery(PHONE_QUERY);
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  if (!phone) return { className: "", style: undefined };
  return {
    className:
      "top-auto bottom-0 left-0 max-h-dvh w-full max-w-none overflow-y-auto translate-x-0 translate-y-0 rounded-t-xl rounded-b-none ease-[cubic-bezier(0.32,0.72,0,1)] data-open:duration-300 data-closed:duration-200 [&>[data-slot=dialog-close]]:size-10 [&_[data-slot=dialog-footer]]:rounded-b-none [&_[data-slot=dialog-footer]]:pb-[calc(--spacing(6)+env(safe-area-inset-bottom))] [&_[data-slot=alert-dialog-footer]]:rounded-b-none [&_[data-slot=alert-dialog-footer]]:pb-[calc(--spacing(6)+env(safe-area-inset-bottom))]",
    style: (reduced
      ? ({ "--tw-enter-scale": "1", "--tw-exit-scale": "1" } as Record<string, string>)
      : {
          "--tw-enter-opacity": "1",
          "--tw-exit-opacity": "1",
          "--tw-enter-scale": "1",
          "--tw-exit-scale": "1",
          "--tw-enter-translate-y": "100%",
          "--tw-exit-translate-y": "100%",
        }) as React.CSSProperties,
  };
}

/** Open flow windows standing guard on the history entry. Module level, because
 *  the entry is one per tab, whichever component put it there. */
let guards = 0;

/**
 * The entry this module pushed, by a token of its own. A plain `flowWindow: true`
 * was not enough: Next.js copies `history.state` into its own replaceState on the
 * page's real entry, so the flag outlived the guard. The next close then saw the
 * flag on the real page, stepped back, and left the page entirely (owner, Oct 23:
 * switching a phone view back to desktop landed on an old filing). Only an entry
 * carrying the current token is ours to pop.
 */
let ownedToken: string | null = null;

function isOurEntry(): boolean {
  return ownedToken !== null && window.history.state?.flowWindow === ownedToken;
}

/**
 * The phone's own back button (or back swipe) steps out of an open flow window
 * instead of leaving the page underneath it.
 *
 * While `active`, one history entry stands for the window. Back pops it and
 * calls `onBack`, which decides what that means: on a first step, the same as
 * Cancel (so the discard warning still guards typed work); on a later step, the
 * previous step. If `onBack` leaves the window open, the entry is put back so
 * the next Back is caught too. Closing the window any other way removes the
 * entry, so history never collects dead steps.
 */
export function useBackCloses(active: boolean, onBack: () => void) {
  const onBackRef = React.useRef(onBack);
  React.useEffect(() => {
    onBackRef.current = onBack;
  });

  React.useEffect(() => {
    if (!active) return;
    guards += 1;
    const stand = () => {
      if (!isOurEntry()) {
        ownedToken = `flow-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.history.pushState({ flowWindow: ownedToken }, "");
      }
    };
    stand();
    const onPop = () => {
      onBackRef.current();
      // If the handler left the window open (a warning came up, or a step went
      // back), stand guard again. If it closed, the cleanup below has already
      // run and `guards` says so.
      window.setTimeout(() => {
        if (guards > 0) stand();
      }, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      guards -= 1;
      window.removeEventListener("popstate", onPop);
      // Closed from inside (Cancel, filed, discarded): drop our entry. Deferred,
      // so a remount in the same tick (one step handing over to the next, or
      // React's development double mount) keeps the entry instead of racing it.
      window.setTimeout(() => {
        if (guards !== 0) return;
        if (isOurEntry()) window.history.back();
        ownedToken = null;
      }, 0);
    };
  }, [active]);
}
