"use client";

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { onOwnLayer } from "@/components/chrome/discard-guard";
import {
  OVERLAY_RISE,
  STAGE_SLIDE,
  type StageMotion,
} from "@/components/chrome/motion";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * **One overlay, however many questions it has to ask.**
 *
 * A court-side act is rarely one moment. Reading a registration and deciding on it,
 * choosing a date and signing the order, confirming a bulk signature and being told what
 * it did — each of those is two or three moments, and the product's rule is that they are
 * *stages of one window*, never a second window (`ui-craft` §7 and its motion reference:
 * "a flow progresses inside one modal; confirmations, composers and outcomes are stages,
 * not stacked dialogs").
 *
 * That rule was settled on the registrations overlay (owner, 2026-09-11: approving
 * *"takes two screens that feel like one act"*) and restated when the bulk reschedule act
 * was rebuilt on it (owner, 2026-09-16: *"right now it abruptly changes to a new modal —
 * that shouldn't happen at all, everything should happen in one modal with all those
 * motion+interaction"*). This file exists because the owner then asked for that same
 * interaction on **every** court-side modal, and a rule that sixteen overlays each
 * hand-write is a rule that sixteen overlays each drift from. `motion.ts` already made
 * this argument for the class strings; this makes it for the frame those classes hang on.
 *
 * ## What the frame guarantees
 *
 * Getting this right turned out to be four things, and all four are things a call site
 * gets wrong by omission rather than by choice — which is exactly what belongs in a
 * shared frame rather than in a convention:
 *
 * 1. **The chrome holds still.** A header or footer that swaps instantly over a stage
 *    that animates is half the abruptness on its own. The header and footer are rendered
 *    once, outside the animated element; only the stage between them travels. That is
 *    what makes them read as a frame rather than as part of the thing that changed.
 * 2. **The window does not resize under the reader.** A dialog is centred, so a stage
 *    shorter than the last one does not merely shrink the box — it moves the whole panel
 *    up the screen on the way. The stage canvas carries a floor (`floor`) so pressing on
 *    keeps the frame where it was.
 * 3. **The entrance is keyed on the *scene*, not on the stage.** Mounting is what plays
 *    an animation, so a stage that shares a scene with the one before it never gets one.
 *    This is how a guarded act and its outcome stay one beat: the card being signed is
 *    the same card that was signed, in the same place, with a band resolving across it.
 * 4. **Focus follows the stage.** A stage that slides away takes its controls with it,
 *    and focus left on a button that has just been unmounted drops to the document with a
 *    modal still open. `useStagedFlow` moves it to the line that just changed.
 *
 * ## What the call site still owns
 *
 * The width and height the act needs (`className`), what each stage says, what its footer
 * offers, and the scenes themselves. The frame does not know what a registration or a
 * bail bond is, and should not learn.
 *
 * @see useStagedFlow — the stage, direction and focus half of the same pattern.
 */
export function StagedOverlay({
  className,
  /** The one line that rewrites itself. It carries the outcome too, not just the question. */
  title,
  titleRef,
  /**
   * A mark beside the title — a `Badge` saying where the record stands. Optional: most
   * acts have nothing to put here, and an empty chip is worse than no chip.
   */
  titleAside,
  /**
   * The line under the title, where a stage has one worth saying. Most do not: past the
   * first question the facts in the card below are what describe the window, and a
   * sentence above them restating the obvious is the header talking over its own content.
   * Pass a plain string and it is wrapped; pass a node and it is used as-is.
   */
  description,
  /**
   * What the header fades on. Given only where the *record* can change under a live
   * overlay — the registrations queue walks to the next request without closing — so the
   * title, the chip and the number arrive with the record they name instead of swapping
   * over a body that animated. Left unset the header never remounts, which is the point.
   */
  headerKey,
  /** What the stage mounts on — the scene, from `useStagedFlow`. */
  sceneKey,
  /** Which way this stage arrived, from `useStagedFlow`. */
  motion,
  /**
   * Hold the stage canvas to a comfortable height so a shorter stage does not shrink the
   * window and re-centre the panel. **Conditional on the window having the room to give**:
   * a dialog capped at `85dvh` cannot always honour a 448px canvas plus its chrome, and
   * forcing it pushes the footer — and the act's own button — past the panel's clipped
   * edge. So it arrives in two viewport-height steps and only where the footer is a single
   * row; below `sm` the footer stacks and the canvas goes back to sizing itself. A window
   * that resizes is a smaller fault than a window with no way out of it.
   *
   * Omit it where the overlay already has a definite height (`md:h-[85dvh]`) — the floor
   * has nothing to do there.
   */
  floor = false,
  /**
   * Pad the stage. On by default, because a stage is content on a canvas. Off where the
   * scenes are full-bleed columns that manage their own insets — the registrations
   * overlay's two-column reading surface is the case.
   */
  padded = true,
  /**
   * **What the stage is.**
   *
   * `canvas` — the default — is the tinted work surface, and it earns the tint by having
   * *objects* on it: the registrations overlay's two columns of cards, the order
   * composer's documents, an act card with its figures. The tint is what makes those read
   * as things laid on a surface rather than as regions of one.
   *
   * `card` is one continuous plane in the overlay's own white, for a stage that holds a
   * single long thing — a list, a form, a document. There the tint buys nothing and costs
   * a layer: the panel ends up the same shape as the canvas it sits on, which is a card
   * inside a card inside a modal — two edges carrying one meaning (owner, 2026-09-17, on
   * the scrutiny review list). The header and footer hairlines are what frame the stage
   * instead, which is how every other overlay in the product does it.
   */
  surface = "canvas",
  /** The stages themselves — one scene's worth at a time. */
  children,
  /** The footer, which is chrome and therefore does not move. */
  footer,
  onOpenAutoFocus,
  onPointerDownOutside,
  onFocusOutside,
  ...props
}: Omit<React.ComponentProps<typeof ChromeDialogContent>, "title"> & {
  title: React.ReactNode;
  titleRef?: React.RefObject<HTMLHeadingElement | null>;
  titleAside?: React.ReactNode;
  description?: React.ReactNode;
  headerKey?: React.Key;
  sceneKey: React.Key;
  motion: StageMotion;
  floor?: boolean;
  padded?: boolean;
  surface?: "canvas" | "card";
  footer?: React.ReactNode;
}) {
  /* The frame's own handle on the title, so the landing place below works whether or not
     the caller keeps one. A single-stage overlay has no `useStagedFlow` and therefore no
     `titleRef` to pass, and those were exactly the two that went on opening on their
     Download button after the default was added (measured, 2026-09-16). */
  const ownTitleRef = React.useRef<HTMLHeadingElement>(null);
  const setTitle = React.useCallback(
    (node: HTMLHeadingElement | null) => {
      ownTitleRef.current = node;
      if (titleRef) titleRef.current = node;
    },
    [titleRef],
  );

  return (
    <ChromeDialogContent
      className={cn(
        "flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0",
        OVERLAY_RISE,
        className,
      )}
      /**
       * **The overlay opens on its question, not on whatever it happens to contain first.**
       *
       * Radix focuses the first tabbable descendant. In a court-side overlay that is
       * routinely a *Download* button sitting above the document — measured on
       * `/employee/sign-orders`, `/employee/rescheduling-request` and
       * `/employee/approve-copy-application` (2026-09-16), all three of which opened with
       * a teal ring around Download. A ring on an incidental control reads as a starting
       * point the reader has not been given, and it is the first thing a screen reader
       * announces instead of the question being asked.
       *
       * So the default lands on the title, which is the line the overlay is *about* and
       * the same line every stage change lands on (`useStagedFlow`). It is a heading with
       * `tabIndex={-1}`, which WAI-ARIA APG allows as a dialog's initial focus.
       *
       * A caller that has a better answer passes its own handler and wins outright: the
       * registrations overlay sends focus to its fact column, because with two scroll
       * regions the one the officer reads first is a better landing place than the title
       * above them both.
       */
      onOpenAutoFocus={
        onOpenAutoFocus ??
        ((event) => {
          if (!ownTitleRef.current) return;
          event.preventDefault();
          ownTitleRef.current.focus();
        })
      }
      /* A click outside follows the product's one rule (2026-10-22): an empty overlay
         closes, one holding an entry asks first (`useDiscardGuard`). It used to ignore the
         click (owner, 2026-10-13) so a misclick could not lose a half-done act; the guard
         protects that now. A pick from a list a field opened past the edge is not a click
         outside, and focus moving into one never closes the overlay. */
      onPointerDownOutside={(event) => {
        if (onOwnLayer(event.target)) event.preventDefault();
        else onPointerDownOutside?.(event);
      }}
      onFocusOutside={(event) => {
        onFocusOutside?.(event);
        event.preventDefault();
      }}
      {...props}
    >
      {/* The overlay's chrome: white, above the tinted stage, and on **every** stage,
          including the settled one. It only reads as the frame the stages move inside if
          it is still there when they have finished moving — dropping it on the outcome so
          a success panel can carry its own heading is precisely the moment an overlay
          stops looking like the overlay. `pr-16` keeps the title clear of the ghost close
          button the DS places top-right. */}
      <DialogHeader
        key={headerKey}
        className={cn(
          "shrink-0 gap-2 border-b border-hairline p-6 pr-16",
          headerKey === undefined
            ? undefined
            : "animate-in fade-in-0 duration-500 motion-reduce:animate-none",
        )}
      >
        {titleAside ? (
          <div className="flex flex-wrap items-center gap-2">
            <StageTitle ref={setTitle}>{title}</StageTitle>
            {titleAside}
          </div>
        ) : (
          <StageTitle ref={setTitle}>{title}</StageTitle>
        )}
        {description === undefined || description === null ? null : typeof
            description === "string" ? (
          <DialogDescription className="text-body-compact text-muted-foreground">
            {description}
          </DialogDescription>
        ) : (
          description
        )}
      </DialogHeader>

      {/* The stage — **the only thing in this window that moves.** By default a tinted
          canvas under white cards: the scoped work canvas the order screen and the filing
          form already use (`ui-craft` §1.0), and the one place a tinted stage is
          sanctioned, because the chrome above and below it stays white and the tint
          therefore reads as the surface the work sits on rather than as a grey dialog.
          Dark keeps `bg-background`, since `muted` is the raised step there and would
          invert the depth. A stage holding one long thing takes `surface="card"` instead
          and skips the layer.

          `overflow-hidden` is what the slide travels inside. A flex column rather than a
          block: the canvas's height comes from `flex-1` and a floor, which is not a
          *definite* height, so a child asking for `h-full` measures its own content
          instead and hangs from the top of the canvas with tint under it. The scene
          stretches by `flex-1`, which needs no definite parent. */}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden",
          surface === "card" ? "bg-card" : "bg-muted dark:bg-background",
          floor &&
            "sm:[@media(min-height:680px)]:min-h-96 sm:[@media(min-height:720px)]:min-h-112",
        )}
      >
        {/* Keyed on the scene, because mounting is what plays an entrance and a settled
            act is not an entrance. The scroll belongs here rather than to the canvas, so a
            stage taller than the window still scrolls and the canvas keeps its floor. */}
        <div
          key={sceneKey}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            padded && "p-4 sm:p-6",
            STAGE_SLIDE[motion],
          )}
        >
          {children}
        </div>
      </div>

      {/* Chrome too, so `bg-card` rather than the primitive's muted fill — under a muted
          stage the two would merge into one grey band and the footer would stop reading as
          a separate register from the work. */}
      {footer ? (
        <DialogFooter className="mx-0 mb-0 shrink-0 border-hairline bg-card">
          {footer}
        </DialogFooter>
      ) : null}
    </ChromeDialogContent>
  );
}

/**
 * The title, at the one size and weight every court-side overlay states its question in.
 *
 * `tabIndex={-1}` and the removed outline are not decoration: this is where focus lands on
 * a stage change, so it has to be programmatically focusable, and a permanent ring on a
 * heading that is focused by script rather than by Tab reads as an error state. The ring
 * the reader actually needs is the one on the control they tabbed to.
 */
function StageTitle({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  return (
    <DialogTitle
      ref={ref}
      tabIndex={-1}
      className={cn(
        "text-title-s font-semibold tabular-nums outline-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Where the act is, which way it is travelling, and what hears about it.
 *
 * The three are one hook because they are one decision. A stage that changes without a
 * direction has nothing to animate; a direction chosen at the call site is a direction
 * that gets it backwards on the one path nobody retested; and a stage that changes without
 * moving focus leaves a keyboard reader on a button that no longer exists.
 *
 * ## Direction comes from the order, not from the caller
 *
 * Both overlays that hand-wrote this asked the same question — *is this the stage we
 * started on?* — and both would have got a third stage wrong. `order` states the act's
 * shape once and the direction falls out of it: later in the list is forward, earlier is
 * back. A stage sharing a scene with the one before it gets **no** direction change at
 * all, which is what keeps a settled outcome from replaying an entrance it should never
 * have had.
 *
 * ## `arrive` is not a step
 *
 * A different record in the same window has not progressed anywhere — it was replaced. It
 * rises instead of sliding (`STAGE_SLIDE.arrive`): sideways means *this one moved on*,
 * upward means *here is another one*. Call it during render, the way React documents
 * adjusting state when a prop changes, so the new record never appears for a frame wearing
 * the last one's stage.
 */
export function useStagedFlow<S extends string>({
  order,
  scene,
  focus,
  record,
  arrival = "arrive",
  landing,
  onRecordChange,
}: {
  /** Every stage, in the order the act moves through them. */
  order: readonly S[];
  /**
   * Which scene each stage is looked at in. Stages sharing a scene do not remount, so
   * they do not animate — that is how a guarded act and its outcome stay one beat.
   */
  scene: Record<S, string>;
  /**
   * Where focus goes on entering a given stage, when the title is not the right answer.
   * A stage whose whole purpose is one field should land on that field.
   */
  focus?: Partial<Record<S, React.RefObject<HTMLElement | null>>>;
  /**
   * The record on show, where the overlay can be walked from one to the next without
   * closing. Changing it returns to the first stage. Overlays that hold a single record
   * for their whole life leave it unset.
   */
  record?: React.Key;
  /**
   * What a change of record *means*, which is not the same question at every overlay.
   *
   * `arrive` — the default — is a different record replacing this one **in a window that
   * stays open**: the officer presses "View next application" and the overlay keeps its
   * place on screen, so the new record rises to say it is a new thing rather than a step.
   *
   * `forward` is for the other case, where the "record" is a fresh *opening* of the same
   * component. There the overlay is already rising on its own (`OVERLAY_RISE`), and a
   * stage that rises inside it is the same gesture played twice — measured at 500ms of
   * stage rise inside a 300ms panel rise on the bulk reschedule act. The stage just
   * enters; the window's own entrance is the one that means something.
   */
  arrival?: StageMotion;
  /**
   * Where focus goes when a different record arrives — normally wherever the overlay
   * sends it on open, since the button that opened this one left with the stage before
   * it. Defaults to the title.
   */
  landing?: React.RefObject<HTMLElement | null>;
  /**
   * The call site's own reset, run during render at the moment the record changes — a
   * typed rejection reason must not survive onto somebody else's request. This is React's
   * documented "adjusting state when a prop changes", so nothing stale is ever painted;
   * it must only set state owned by the caller.
   */
  onRecordChange?: () => void;
}) {
  const [stage, setStage] = React.useState<S>(order[0]);
  const [motion, setMotion] = React.useState<StageMotion>("forward");
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  /* Where focus goes, held in a ref rather than read through the effect's dependencies:
     both are object literals at the call site, so as dependencies they would be new on
     every render and the effect would re-fire — moving focus while somebody is typing.
     Refreshed in its own effect because the lint gate refuses a ref written during render,
     and declared *before* the focus effect so it is already current when that one runs:
     effects fire in declaration order. */
  const where = React.useRef({ focus, landing });
  React.useEffect(() => {
    where.current = { focus, landing };
  });

  /* A different record in the same window has not progressed anywhere — it was replaced,
     so it rises rather than sliding, and it goes back to the first stage. Adjusted during
     render so the new record never appears for a frame wearing the last one's stage.

     The arrival is counted rather than flagged: a flag is a ref, a ref may not be written
     during render, and a count is state the effect below can compare against what it last
     answered for. Two arrivals in a row are two different numbers, which a boolean that
     never got read would not have been. */
  const [shown, setShown] = React.useState(record);
  const [arrivals, setArrivals] = React.useState(0);
  if (record !== shown) {
    setShown(record);
    setStage(order[0]);
    setMotion(arrival);
    setArrivals((n) => n + 1);
    onRecordChange?.();
  }

  const go = React.useCallback(
    (to: S) => {
      /* Same scene, same place on screen: the class must not change, or a stage that was
         never going to remount would replay its entrance where it stands. */
      if (scene[to] !== scene[stage]) {
        setMotion(order.indexOf(to) < order.indexOf(stage) ? "back" : "forward");
      }
      setStage(to);
    },
    [order, scene, stage],
  );

  /* What focus has already answered for. It fires on a *change*, never on the overlay's
     first paint: the dialog's own `onOpenAutoFocus` has put focus somewhere deliberate by
     then, and repeating it here would be the same move twice, or a worse one. */
  const answered = React.useRef<{ stage: S | null; arrivals: number }>({
    stage: null,
    arrivals: 0,
  });

  React.useEffect(() => {
    const last = answered.current;
    answered.current = { stage, arrivals };
    /* A record that has just arrived takes focus wherever the overlay sends it on open —
       the button that opened this one went with the stage that left, and focus left on an
       unmounted control drops to the document with a modal still up. */
    if (arrivals !== last.arrivals) {
      (where.current.landing ?? titleRef).current?.focus();
      return;
    }
    if (last.stage === null || last.stage === stage) return;
    (where.current.focus?.[stage] ?? titleRef).current?.focus();
  }, [stage, arrivals]);

  return {
    stage,
    motion,
    /** What `StagedOverlay` mounts the stage on. */
    sceneKey: scene[stage],
    /** What `StagedOverlay` focuses on a stage change. */
    titleRef,
    go,
  };
}
