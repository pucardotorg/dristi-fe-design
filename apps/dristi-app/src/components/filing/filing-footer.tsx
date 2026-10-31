"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFieldPolicy } from "@/components/filing/field-policy";
import { useInCorrection } from "@/components/filing/posture";
import { SavingIndicator } from "@/components/filing/saving-indicator";
import { useMissingGuard } from "@/lib/filing/store";

/**
 * Once the errors have rendered, move to the first field in error and centre it, so it is
 * not left under the sticky footer — on a phone it is usually far above the button.
 */
function focusFirstMissing() {
  window.requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>('[data-slot="field"][data-invalid="true"]');
    if (!field) return;
    const control = Array.from(
      field.querySelectorAll<HTMLElement>("input, textarea, button, [role='combobox'], [tabindex='0']")
    ).find((el) => !el.closest("label, [data-slot='field-label']") && !el.hasAttribute("disabled"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    field.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    control?.focus({ preventScroll: true });
  });
}

/**
 * Sticky action bar under every filing screen: Back on the left, save state and the one
 * primary action on the right. Pass either `backHref`/`continueHref` (links) or
 * `onBack`/`onContinue` (handlers — used when a screen must validate first).
 */
export function FilingFooter({
  backHref,
  onBack,
  backLabel = "Back",
  continueHref,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  continueBlocked = false,
  continueHint,
  continueVariant = "default",
  showSaveState = true,
  leading,
  status,
  extra,
  className,
}: {
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  continueHref?: string;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /**
   * The step is not ready but the action stays focusable and clickable so pressing it can
   * explain why (aria-disabled + dimmed). Use with `onContinue`.
   */
  continueBlocked?: boolean;
  /**
   * Why it is not ready, on the control itself rather than as a sentence beside it — on
   * hover and on focus (owner, 2026-09-24). It needs `continueBlocked`, because a
   * `disabled` button fires no pointer events and would never show it.
   */
  continueHint?: string;
  /** "outline" when another control on the screen is the focal action (ration teal). */
  continueVariant?: "default" | "outline";
  showSaveState?: boolean;
  /** Left-side status (e.g. "3 required documents still needed"); replaces Back's slot when Back is absent. */
  leading?: React.ReactNode;
  /** A right-side statement about the step ("2 sections incomplete"), where the save
   *  state sits. On a phone it joins the status line above the buttons. */
  status?: React.ReactNode;
  /** Extra controls (buttons) between the save state and the primary action. */
  extra?: React.ReactNode;
  className?: string;
}) {
  /*
   * A correction round is not a walk through the filing: there is no Back / Continue,
   * and the one primary action is "Submit corrections to scrutiny" in the queue footer
   * (brief D14 — ration teal). So the walking footer stands down.
   */
  const inCorrection = useInCorrection();
  // A host can send the primary action somewhere else (`FieldPolicy.next`).
  const policy = useFieldPolicy();
  const hostNext = policy?.next ?? null;
  if (hostNext) {
    continueHref = hostNext.href;
    continueLabel = hostNext.label;
    continueDisabled = false;
    continueBlocked = false;
    onContinue = undefined;
    if (hostNext.status !== undefined) status = hostNext.status;
  }

  /*
   * Continue does not leave a section with required fields empty: it shows them and puts
   * the cursor in the first (#11, owner 2026-10-30). The Sections list and Back stay free.
   * A host checks its cases its own way, so it is left alone.
   */
  const guard = useMissingGuard();
  const stopIfMissing = policy ? null : guard;
  const stayed = () => {
    if (!stopIfMissing?.()) return false;
    focusFirstMissing();
    return true;
  };
  if (stopIfMissing && onContinue) {
    const go = onContinue;
    onContinue = () => {
      if (!stayed()) go();
    };
  }
  const back =
    backHref !== undefined ? (
      <Button asChild variant="outline" size="lg">
        <Link href={backHref}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          {backLabel}
        </Link>
      </Button>
    ) : onBack ? (
      <Button type="button" variant="outline" size="lg" onClick={onBack}>
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {backLabel}
      </Button>
    ) : null;

  const blockedPrimary = (
    <Button
      type="button"
      size="lg"
      variant={continueVariant}
      onClick={onContinue}
      aria-disabled
      className="opacity-50"
    >
      {continueLabel}
      <ArrowRightIcon data-icon="inline-end" aria-hidden />
    </Button>
  );

  const primary =
    continueBlocked && continueHint ? (
      /* Radix opens it on focus as well as hover, and describes the button with it while
         it is open, so a keyboard reader hears the reason on the way past. */
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{blockedPrimary}</TooltipTrigger>
          <TooltipContent side="top">{continueHint}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : continueHref !== undefined && !continueDisabled ? (
      <Button asChild size="lg" variant={continueVariant}>
        <Link
          href={continueHref}
          onClick={(event) => {
            if (stayed()) event.preventDefault();
          }}
        >
          {continueLabel}
          <ArrowRightIcon data-icon="inline-end" aria-hidden />
        </Link>
      </Button>
    ) : (
      <Button
        type="button"
        size="lg"
        variant={continueVariant}
        onClick={onContinue}
        disabled={continueDisabled}
        aria-disabled={continueDisabled || continueBlocked || undefined}
        className={cn(continueBlocked && "opacity-50")}
      >
        {continueLabel}
        <ArrowRightIcon data-icon="inline-end" aria-hidden />
      </Button>
    );

  if (inCorrection) return null;

  const hasStatusLine = Boolean(leading || status || showSaveState);

  return (
    <footer
      className={cn(
        "sticky bottom-0 z-30 border-t border-hairline bg-card px-6 pt-3 pb-[calc(--spacing(3)+env(safe-area-inset-bottom))] sm:pb-3",
        className
      )}
    >
      {/* Phone: the actions stack, as every dialog footer in the product does below
          `sm`: the primary action on top at full width, Back under it. A second
          control (Print) shares Back's row half and half. What the step has to say
          sits on one quiet line above them. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {hasStatusLine ? (
          /* One quiet line. The save state always sits on the right (owner, Sept 22):
             alone, or closing the line after the step's own statement on the left. */
          <div className="flex items-center justify-between gap-3 text-caption [&_*]:text-caption">
            {leading || status ? (
              <>
                <div className="min-w-0">{leading ?? status}</div>
                <div className="flex shrink-0 items-center gap-3">
                  {leading ? status : null}
                  {showSaveState ? <SavingIndicator /> : null}
                </div>
              </>
            ) : (
              <span className="ml-auto flex">
                <SavingIndicator />
              </span>
            )}
          </div>
        ) : null}
        <div className="flex flex-col [&>*]:w-full">{primary}</div>
        {back || extra ? (
          <div className="flex items-center gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            {back}
            {extra}
          </div>
        ) : null}
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 sm:flex">
        <div className="flex min-w-0 items-center gap-3">
          {back}
          {leading}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 sm:gap-4">
          {showSaveState ? <SavingIndicator /> : null}
          {status}
          {extra}
          {primary}
        </div>
      </div>
    </footer>
  );
}
