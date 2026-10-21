"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import { Button } from "@/components/ui/button";
import { pick, type Copy, type Locale } from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";

/** The surfaces a question can dock inside. */
const SURFACE =
  '[data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="drawer-content"]';
/** The primitives' own close controls: the corner X, footer closes and Back's hidden one. */
const CLOSE = '[data-slot="dialog-close"], [data-slot="sheet-close"], [data-slot="drawer-close"]';
/**
 * The floating layers a popup's own fields open past its edge — a combobox's list, a
 * date picker, a menu — plus toasts and the dev overlay. They are drawn outside the popup,
 * so a pick from one would otherwise count as a click outside it.
 */
const OWN_LAYER = [
  '[data-slot="combobox-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="dropdown-menu-sub-content"]',
  '[data-slot="context-menu-content"]',
  '[data-slot="context-menu-sub-content"]',
  '[data-slot="hover-card-content"]',
  '[data-slot="tooltip-content"]',
  "[data-radix-popper-content-wrapper]",
  "[data-sonner-toaster]",
  "nextjs-portal",
].join(", ");

/** Whether a press outside a popup landed on one of its own floating layers. */
export function onOwnLayer(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_LAYER) !== null;
}

/**
 * **A popup with something in it asks before it closes.**
 *
 * Anshumanth's report (2026-10-21): a click away from a popup closed it and took what had
 * been typed with it. The rule that answers it is one rule for every popup that holds an
 * entry — anything typed, chosen or uploaded — and every way a popup closes by mistake: a
 * click outside, Escape, the close button, Cancel and the phone's Back. Nothing entered,
 * and the popup closes as it always has. Discarding closes it without saving.
 *
 * The question is a stage of the same window, never a second modal (`ui-craft`, motion;
 * owner, 2026-10-13 on the join dialogs). The window stays where it is, dimmed and inert,
 * so the person can still see what they would be throwing away, and the question docks
 * along its bottom edge where the window's own actions were.
 *
 * The guard holds those closes at the popup's own surface, so it works whoever owns the
 * popup's open state: spread `guard.contentProps` and `guard.outsideProps` on the content
 * (Escape, the close button, the hidden close that Back presses in a flow window, and a
 * click outside), and point the popup's own Cancel at `guard.close`. Discarding calls
 * `onDiscard`, which is the popup's real close. While the question is up, any further
 * close means "keep editing": a second Escape or a click on the dimmed window never
 * discards.
 *
 * A click outside is one rule everywhere (Anshumanth, 2026-10-22, on Join a case ignoring
 * it): an empty popup closes, a popup holding an entry asks. A pick from one of the
 * popup's own floating lists (`onOwnLayer`) is not a click outside.
 */
export function useDiscardGuard(dirty: boolean, onDiscard: () => void) {
  const [asking, setAsking] = React.useState(false);
  const onDiscardRef = React.useRef(onDiscard);
  React.useEffect(() => {
    onDiscardRef.current = onDiscard;
  });
  const holding = dirty || asking;

  const close = React.useCallback(() => {
    if (asking) setAsking(false);
    else if (dirty) setAsking(true);
    else onDiscardRef.current();
  }, [asking, dirty]);

  const discard = React.useCallback(() => {
    setAsking(false);
    onDiscardRef.current();
  }, []);

  const keep = React.useCallback(() => setAsking(false), []);

  const contentProps = {
    onEscapeKeyDown: (event: KeyboardEvent) => {
      if (!holding) return;
      event.preventDefault();
      close();
    },
    /* A close control in this surface (not one in a viewer opened from it) is held before
       it closes the popup: the primitive's close skips its own work on a prevented event. */
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (!holding) return;
      const target = event.target as HTMLElement;
      const control = target.closest(CLOSE);
      if (!control || control.closest(SURFACE) !== event.currentTarget) return;
      if (control.closest("[data-discard-question]")) return;
      event.preventDefault();
      close();
    },
  };

  const outsideProps = {
    onPointerDownOutside: (event: Event) => {
      if (onOwnLayer(event.target)) {
        event.preventDefault();
        return;
      }
      if (!holding) return;
      event.preventDefault();
      close();
    },
  };

  return { asking: asking && dirty, close, discard, keep, contentProps, outsideProps };
}

export type DiscardGuard = ReturnType<typeof useDiscardGuard>;

const COPY = {
  title: {
    en: "Do you want to discard your progress?",
    ml: "ഇതുവരെ നൽകിയത് ഉപേക്ഷിക്കണോ?",
  },
  body: {
    en: "What you've entered here will not be saved.",
    ml: "ഇതുവരെ നൽകിയ വിവരങ്ങൾ സൂക്ഷിക്കില്ല.",
  },
  keep: { en: "Keep editing", ml: "തിരുത്തൽ തുടരുക" },
  discard: { en: "Discard", ml: "ഉപേക്ഷിക്കുക" },
} satisfies Record<string, Copy>;

/**
 * The question itself. Render it anywhere inside the popup's content: it finds the popup
 * surface it sits in and portals there, so a staged overlay's scrolling stage or a form's
 * own wrapper cannot clip it or leave the footer uncovered.
 */
export function DiscardQuestion({
  guard,
  locale = "en",
}: {
  guard: DiscardGuard;
  /** The person's language on the advocate and litigant side; court screens are English. */
  locale?: Locale;
}) {
  const [surface, setSurface] = React.useState<HTMLElement | null>(null);
  /* The same element, for the code that changes it; the state is for rendering into it. */
  const surfaceRef = React.useRef<HTMLElement | null>(null);
  const anchor = React.useCallback((node: HTMLSpanElement | null) => {
    const found = node?.closest<HTMLElement>(SURFACE) ?? null;
    surfaceRef.current = found;
    setSurface(found);
  }, []);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const titleId = React.useId();
  const bodyId = React.useId();

  /* Some popups scroll their own surface, and a layer placed at its top would sit wherever
     the scroll left it. So the question takes the part of the window in view, and the
     window holds still under it. */
  const placeLayer = React.useCallback((node: HTMLDivElement | null) => {
    const target = surfaceRef.current;
    if (!node || !target) return;
    node.style.top = `${target.scrollTop}px`;
    node.style.height = `${target.clientHeight}px`;
  }, []);

  /* While the question is up, the window behind it is inert: no Tab stop, no click, no
     reading order. Focus goes to the question, and comes back to where it was. */
  React.useEffect(() => {
    const target = surfaceRef.current;
    if (!guard.asking || !target) return;
    const overflow = target.style.overflow;
    target.style.overflow = "hidden";
    const returnTo = document.activeElement as HTMLElement | null;
    const behind = [...target.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && !child.hasAttribute("data-discard-question"),
    );
    for (const element of behind) element.inert = true;
    titleRef.current?.focus();
    return () => {
      target.style.overflow = overflow;
      for (const element of behind) element.inert = false;
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [guard.asking, surface]);

  const question =
    guard.asking && surface
      ? createPortal(
          <div
            ref={placeLayer}
            data-discard-question=""
            className="absolute inset-x-0 top-0 z-50 flex h-full flex-col justify-end rounded-[inherit]"
          >
            {/* The window, dimmed — half the page's scrim, so it still reads as the window and
                what is in it stays legible. Clicking it is "keep editing", like a second Escape. */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[inherit] bg-scrim opacity-50 motion-safe:animate-in motion-safe:fade-in-0"
              onClick={guard.keep}
            />
            <div
              role="alertdialog"
              aria-labelledby={titleId}
              aria-describedby={bodyId}
              className={cn(
                "relative flex flex-col gap-4 rounded-b-[inherit] border-t border-hairline bg-card px-6 pt-6 pb-[calc(--spacing(6)+env(safe-area-inset-bottom))]",
                RESOLVE_IN_PLACE,
              )}
            >
              <div className="flex flex-col gap-1">
                <h2
                  ref={titleRef}
                  id={titleId}
                  tabIndex={-1}
                  className="text-title-s font-semibold text-balance outline-none"
                >
                  {pick(COPY.title, locale)}
                </h2>
                <p id={bodyId} className="text-body-compact text-pretty text-muted-foreground">
                  {pick(COPY.body, locale)}
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={guard.keep}>
                  {pick(COPY.keep, locale)}
                </Button>
                <Button type="button" variant="destructive-solid" onClick={guard.discard}>
                  {pick(COPY.discard, locale)}
                </Button>
              </div>
            </div>
          </div>,
          surface,
        )
      : null;

  return (
    <>
      <span ref={anchor} hidden />
      {question}
    </>
  );
}
