"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { LeaveGuardProvider } from "@/components/filing/leave-guard";
import { PolicyLock, useFieldPolicy } from "@/components/filing/field-policy";
import { useInCorrection } from "@/components/filing/posture";
import { SectionsRail, SectionsTrigger } from "@/components/filing/sections-rail";

/**
 * Where the source rail mounts. `SourcePanel` is rendered deep inside a section, but the
 * rail has to be a *column* beside the form — otherwise it can only cover the form or
 * float over the sticky footer. The slot lets it stay a sibling of the content column
 * without every section having to know about the shell's layout.
 */
const SourceRailSlot = React.createContext<HTMLElement | null>(null);

export function useSourceRailSlot(): HTMLElement | null {
  return React.useContext(SourceRailSlot);
}

/**
 * Frame for the form sections: the Sections rail, the screen, and the source rail's
 * column — three siblings in the row the filings shell opened. Screens supply their own
 * `FilingMain` + `FilingFooter`.
 */
export function FilingShell({
  children,
  banner = null,
}: {
  children: React.ReactNode;
  /** A host's own strip above every section (bulk filing: which case of the batch this is). */
  banner?: React.ReactNode;
}) {
  const [slot, setSlot] = React.useState<HTMLElement | null>(null);

  return (
    <LeaveGuardProvider>
      <SourceRailSlot.Provider value={slot}>
        <SectionsRail />

        {/* The canvas tint (see `FilingMain`) runs the full column, not just the form
            card area, so the sticky Sections trigger can float transparently over the
            content that scrolls beneath it instead of masking it behind a band. `FilingMain`
            fills the rest, so this only ever shows in the trigger's own strip. */}
        <main className="flex min-w-0 flex-1 flex-col bg-muted dark:bg-background">
          <SectionsTrigger />
          {banner}
          {children}
        </main>

        {/* Zero-width until a source or signing rail mounts into it. */}
        <div ref={setSlot} className="flex shrink-0" />
      </SourceRailSlot.Provider>
    </LeaveGuardProvider>
  );
}

/**
 * The scrolling column of a filing screen.
 *
 * A `div`, not a `main`: inside `FilingShell` the landmark is the shell's own `main`, and
 * the two screens outside it (upload, sign) carry theirs.
 *
 * The column carries `bg-muted` (neutral-2) in light mode — the one warm step that
 * separates the form canvas from the white cards on it. Filling a long form is a
 * one-card-at-a-time job, and on a white-on-white page the panel edge rests entirely on a
 * 5% shadow, which is the first thing to vanish on a poor display or for a reader with low
 * vision. The tint is scoped to this column on purpose: the top bar and the sticky footer
 * stay `bg-card` white, so the tint reads as the writing surface rather than as a grey
 * page. The Sections rail already sat on `bg-sidebar` (also neutral-2) and so shares the
 * canvas tone — that is the composition the owner chose from the studies, with the cards
 * as the only white.
 *
 * Dark mode deliberately keeps `bg-background`: there, `muted` is neutral-2, which the DS
 * assigns to `surface-raised`, while cards sit at neutral-1 — tinting the canvas would put
 * the page *above* the cards and read them as recesses. The DS keeps dark flat on purpose
 * ("Dark stays flat: page and card share neutral-1", globals.css), so dark is unchanged
 * and its depth question belongs upstream, not here.
 *
 * Owner-approved 2026-08-26 from the canvas studies (variant 3, "Whisper + lift");
 * supersedes the blanket no-grey-canvas rule for the filing form only.
 */
export function FilingMain({
  children,
  width = "default",
  sourceOpen = false,
  className,
}: {
  children: React.ReactNode;
  width?: "default" | "wide" | "narrow";
  /** The source rail has taken a column, so the form has less width to spend on gutters. */
  sourceOpen?: boolean;
  className?: string;
}) {
  /*
   * In a correction round this column is the middle of three panes and the frame around
   * it already carries the page gutters, so it drops the wide ones and its own max-width
   * rather than leaving the form stranded in the centre of a narrow column.
   */
  const inCorrection = useInCorrection();
  // A section a host has set for every case (bulk filing's advocates) is locked whole.
  const locked = useFieldPolicy()?.lockedAt(null) ?? null;
  const body = locked ? <PolicyLock reason={locked}>{children}</PolicyLock> : children;

  if (inCorrection) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-6", className)}>{body}</div>
    );
  }

  return (
    <div
      className={cn(
        /* 24px gutters at every width, the page frame's own (`PAGE_GUTTER`): at 16 the
           title sat tighter to the glass than on any other screen. The cards give the
           8px back on a phone by padding at 16, the product's phone card padding, so a
           field is exactly as wide as it was. */
        "flex-1 bg-muted px-6 pb-8 pt-6 max-sm:[&_[data-slot=card]]:[--card-spacing:--spacing(4)] dark:bg-background",
        sourceOpen ? "lg:px-6" : "lg:px-12",
        className
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-6",
          width === "default" && "max-w-4xl",
          width === "wide" && "max-w-5xl",
          width === "narrow" && "mx-auto max-w-2xl"
        )}
      >
        {body}
      </div>
    </div>
  );
}
