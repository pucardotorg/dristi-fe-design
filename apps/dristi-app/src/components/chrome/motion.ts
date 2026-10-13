/**
 * The app's motion vocabulary — four movements, and nothing else.
 *
 * Motion here is not decoration: it says **what happened to what the reader was looking
 * at**. A screen that replaces another with no movement leaves the reader checking the
 * title to find out whether anything changed; a screen that moves for its own sake makes
 * them wait. So each movement is tied to one event, and the same event moves the same way
 * everywhere in the product (`ui-craft` §8).
 *
 * - **Arriving forward** — a record replaced by the next one, or opened from a list.
 *   It rises: the gesture of a file being laid on the desk.
 * - **Arriving back** — returning to the list. It comes in from the left, the direction
 *   the list was left in.
 * - **An overlay opening** over the page. It rises too, shorter, because it is a layer
 *   over what stays put rather than a new place.
 * - **Moving between stages** of one overlay. The stage travels sideways, in the
 *   direction the reader is going; a record replaced in the same window rises instead.
 * - **Resolving in place** — an act settling into its outcome inside that overlay. The
 *   thing that changed fades and lifts a few pixels; nothing around it moves.
 *
 * Every one of them is `motion-reduce`-guarded, and `fill-mode-both` holds the first
 * frame so nothing flashes at its final position before it starts.
 */

/** A page that has just arrived, by the direction the reader travelled. */
export const ARRIVAL = {
  next: "animate-in fade-in-0 slide-in-from-bottom-8 fill-mode-both duration-500 motion-reduce:animate-none",
  back: "animate-in fade-in-0 slide-in-from-left-8 fill-mode-both duration-300 motion-reduce:animate-none",
} as const;

export type Arrival = keyof typeof ARRIVAL;

/**
 * An overlay that rises into place, rather than snapping open at 95% scale.
 *
 * The DS `Dialog` opens with a 100ms zoom, which is right for a menu and abrupt for a
 * decision: the owner read it as exactly that on the registrations overlay (2026-09-12).
 * This keeps the DS's fade and its own tokens, cancels the zoom, and lets the panel come
 * up 16px over 300ms — the same rise a page makes when it arrives, at a layer's distance
 * rather than a page's. Closing is quicker and smaller, because leaving needs less
 * explaining than arriving.
 *
 * **The reduced-motion guard is on the panel, not only on what moves inside it.** This
 * file has claimed since it was written that every movement in it is `motion-reduce`-
 * guarded, and for this one that was not true: the guard sat on `ARRIVAL`, `STAGE_SLIDE`
 * and `RESOLVE_IN_PLACE` while the overlay itself kept rising. Measured with
 * `prefers-reduced-motion: reduce` emulated (2026-09-16): the stage reported
 * `animation-name: none` and the panel it sits in reported `enter 0.3s`. The animation
 * being overridden is the DS `Dialog`'s own `data-open:animate-in`, which carries no
 * guard either, so cancelling it has to happen here — and now does, on every overlay in
 * the product that uses this constant.
 */
export const OVERLAY_RISE =
  /* Both durations are stated per state: a bare `duration-300` beside a
     `data-closed:duration-200` lost to it in the merge and opened in 200ms (measured). */
  /* The guard is stacked onto the same state variants rather than written bare. A bare
     `motion-reduce:animate-none` is one class (0,1,0) against the primitive's
     `data-open:animate-in`, which is an attribute selector plus a class (0,2,0) — so it
     lost, and the panel went on rising with reduced motion asked for (measured). Matching
     the state in the variant matches the specificity. */
  "data-open:duration-300 data-open:zoom-in-100 data-open:slide-in-from-bottom-4 data-closed:duration-200 data-closed:zoom-out-100 data-closed:slide-out-to-bottom-2 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none";

/**
 * One stage of a staged overlay giving way to the next — **the movement that keeps a
 * journey inside one window from reading as a second window.**
 *
 * Written for the registrations overlay (`approve-registrations-dialog.tsx`,
 * 2026-09-12) and shared from here since the bulk reschedule act adopted it (owner,
 * 2026-09-16: *"everything should happen in one modal with all those
 * motion+interaction"*). Two overlays hand-writing the same three class strings is how
 * one of them ends up 200ms out from the other, which is the whole reason this file
 * exists.
 *
 * The direction is the meaning, so the caller says which way it is going rather than
 * letting the stage pick:
 *
 * - **forward** — the next question. It arrives from the right, the way it is heading.
 * - **back** — the question before it, arriving from the left, the way it came.
 * - **arrive** — not a step at all: a different record in the same window. It rises and
 *   fades over half a second, long enough to read as a new thing settling in. Sideways
 *   means *this one moved on*; upward means *here is another one*.
 *
 * `fill-mode-both` holds the first frame so nothing flashes at its final position before
 * the animation starts, and `motion-reduce:animate-none` leaves a plain swap.
 *
 * **What must not move is the frame.** A header or footer that swaps instantly over a
 * stage that animates is half the abruptness on its own; the chrome stays put and only
 * the stage between them travels. And a settled outcome is *not* a stage change — the
 * scene it settles in stays where it is and uses `RESOLVE_IN_PLACE`.
 */
export const STAGE_SLIDE = {
  forward:
    "animate-in fade-in-0 slide-in-from-right-8 fill-mode-both duration-300 motion-reduce:animate-none",
  back: "animate-in fade-in-0 slide-in-from-left-8 fill-mode-both duration-300 motion-reduce:animate-none",
  arrive:
    "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500 ease-out motion-reduce:animate-none",
} as const;

export type StageMotion = keyof typeof STAGE_SLIDE;

/** Interruptible stage travel uses the same timing as the CSS stage recipe. */
export const STAGE_SLIDE_OPTIONS: KeyframeAnimationOptions = {
  duration: 300,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};

/** Small controls reveal a layer quickly; mirrored pairs can share a stagger. */
export const CONTROL_REVEAL = {
  duration: 140,
  fadeDuration: 125,
  stagger: 30,
  easing: STAGE_SLIDE_OPTIONS.easing,
} as const;

/** Something inside an overlay resolving into its outcome, in place. */
export const RESOLVE_IN_PLACE =
  "animate-in fade-in-0 slide-in-from-bottom-1 duration-500 motion-reduce:animate-none";

/**
 * One step of an overlay giving way to the next **when the steps differ in height**
 * (owner, 2026-10-06, on Join a Case): the window fades out softly, takes the next step
 * and its height while it is clear, and fades back in — with the content drifting a
 * hint (8px) the way the person is going, so the fade still says *forward* or *back*.
 *
 * Arrived at over several rounds, each the owner's call. Anything that resized the window
 * on screen read as janky however it was eased — a slide fighting the resize, a centred
 * glide moving the header, a choreographed morph. So the resize is never seen: it happens
 * in the moment the window is clear. The fade is a sine in-out at both ends, so it neither
 * snaps out nor pops in, and the drift is small enough to read as a light swipe, not a
 * slide. The window itself never translates, so it stays centred on the work area.
 *
 * `STAGE_FADE_PANEL` is the window's fade, `STAGE_FADE.scene` the step's drift inside it;
 * `useStageFade` applies both and waits `STAGE_FADE_OUT_MS` before mounting the next
 * step. Reduced motion swaps instantly.
 */
const SOFT = "ease-[cubic-bezier(0.45,0,0.55,1)]";

/**
 * The window's own fade, as values rather than classes: a dialog inside the app chrome
 * already carries `md:ease-linear md:duration-200` for following the sidebar
 * (`useChromePageDialog`), and those would flatten this curve. So `useStageFade` writes
 * the transition inline, keeping the chrome's `left` transition beside it.
 */
export const STAGE_FADE_PANEL = {
  outMs: 200,
  inMs: 300,
  ease: "cubic-bezier(0.45,0,0.55,1)",
} as const;

export const STAGE_FADE = {
  scene: {
    forward: {
      out: `-translate-x-2 transition-[translate] duration-200 ${SOFT} motion-reduce:transition-none`,
      in: `animate-in slide-in-from-right-2 duration-300 ${SOFT} motion-reduce:animate-none`,
    },
    back: {
      out: `translate-x-2 transition-[translate] duration-200 ${SOFT} motion-reduce:transition-none`,
      in: `animate-in slide-in-from-left-2 duration-300 ${SOFT} motion-reduce:animate-none`,
    },
  },
} as const;

/** How long the window takes to clear before the next step mounts. */
export const STAGE_FADE_OUT_MS = STAGE_FADE_PANEL.outMs;
