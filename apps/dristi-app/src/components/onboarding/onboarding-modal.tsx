"use client";

import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon, GlobeIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper, StepperItem } from "@/components/ui/stepper";
import { HelpPanel } from "@/components/onboarding/help-panel";
import {
  ChoicesStep,
  DateStep,
  HelpStep,
  JoinStep,
  PapersStep,
} from "@/components/onboarding/steps";
import { VideoSlot } from "@/components/onboarding/video-slot";
import {
  LOCALES,
  STEP_ORDER,
  choices,
  dateStep,
  help,
  join,
  papers,
  pick,
  stepTitles,
  ui,
  type CaseSummary,
  type Locale,
  type StepId,
} from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";

const stepHeadings: Record<StepId, (typeof papers)["heading"]> = {
  papers: papers.heading,
  choices: choices.heading,
  date: dateStep.heading,
  help: help.heading,
  join: join.heading,
};

/**
 * Accused onboarding.
 *
 * Decisions this implements (Abhiram / Anshumanth, Jul 31 2026):
 * · full-page modal over the registration screen, dimmed underneath
 * · opens 1s after landing, only on a summons URL — direct traffic never sees it
 * · progress indicator + a close that returns to the registration page underneath
 * · explains the summons and the settle/contest options before join-a-case
 * · pre-registration case view: papers are step one, read-only
 * · help is an open panel, never a tooltip
 *
 * Chrome order is deliberate: language and close sit in a thin utility bar, then a
 * divider, then the journey markers, then the step heading. A reader who is frightened
 * should meet "where am I" and "what is this" before anything else on the page.
 */
export function OnboardingModal({
  open,
  onOpenChange,
  caseSummary,
  locale,
  onLocaleChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseSummary?: CaseSummary;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) {
  const [index, setIndex] = React.useState(0);
  const step = STEP_ORDER[index];
  const isFirst = index === 0;
  const isLast = index === STEP_ORDER.length - 1;

  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Move the reader back to the top of the panel on every step change, so a long step
  // never starts mid-sentence.
  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const stepProps = { locale, caseSummary };

  function resetFlow() {
    setIndex(0);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetFlow();
    onOpenChange(next);
  }

  function handleClose() {
    resetFlow();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          lang={locale}
          className={cn(
            "fixed inset-0 z-50 flex h-dvh w-auto flex-col overflow-hidden bg-popover text-popover-foreground outline-none",
            "duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            "focus-visible:ring-3 focus-visible:ring-ring/50",
            "md:inset-4 md:h-[calc(100dvh-2rem)] md:rounded-xl md:shadow-modal md:ring-1 md:ring-hairline",
            "lg:inset-6 lg:h-[calc(100dvh-3rem)] xl:inset-8 xl:h-[calc(100dvh-4rem)]"
          )}
        >
          <DialogDescription className="sr-only">
            {pick(stepTitles[step], locale)}
          </DialogDescription>

          {/* -------------------------------------------------- utility bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-hairline px-4 py-3 md:px-6">
            <Select
              value={locale}
              onValueChange={(value) => onLocaleChange(value as Locale)}
            >
              {/* Duplicated inside the modal: the page header's language control sits
                behind the scrim and cannot be reached while this is open. */}
              <SelectTrigger
                className="w-auto max-w-full"
                aria-label={pick(ui.language, locale)}
              >
                <GlobeIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleClose}
              aria-label={pick(ui.readLater, locale)}
            >
              <XIcon aria-hidden />
              <span className="sr-only">{pick(ui.readLater, locale)}</span>
            </Button>
          </div>

          {/* ---------------------------------------------- journey markers */}
          <nav
            aria-label="Progress"
            className="shrink-0 border-b border-hairline"
          >
            <div className="mx-auto w-full max-w-3xl px-6 py-4 md:max-w-6xl md:px-8 lg:px-12">
              <div className="flex w-full flex-col items-center gap-3">
                <Stepper
                  className={cn(
                    "w-full",
                    "[&_[data-slot=stepper-item]]:items-center",
                    "[&_[data-slot=stepper-item]>div:first-child]:relative [&_[data-slot=stepper-item]>div:first-child]:justify-center",
                    "[&_[data-slot=stepper-connector]]:absolute [&_[data-slot=stepper-connector]]:top-4 [&_[data-slot=stepper-connector]]:left-[calc(50%+1rem)] [&_[data-slot=stepper-connector]]:mx-0 [&_[data-slot=stepper-connector]]:h-px [&_[data-slot=stepper-connector]]:w-[calc(100%-2rem)] [&_[data-slot=stepper-connector]]:min-w-0 [&_[data-slot=stepper-connector]]:flex-none",
                    "[&_[data-slot=stepper-item]>div:last-child]:w-full [&_[data-slot=stepper-item]>div:last-child]:pr-0 [&_[data-slot=stepper-item]>div:last-child]:text-center",
                    "max-md:[&_[data-slot=stepper-item]>div:last-child]:hidden"
                  )}
                >
                  {STEP_ORDER.map((id, i) => (
                    <StepperItem
                      key={id}
                      step={i + 1}
                      title={pick(stepTitles[id], locale)}
                      status={
                        i < index
                          ? "complete"
                          : i === index
                            ? "current"
                            : "upcoming"
                      }
                      aria-current={i === index ? "step" : undefined}
                      // Markers are navigable: the reader can jump to any stage
                      // rather than being held to Back / Continue.
                      onActivate={i === index ? undefined : () => setIndex(i)}
                      activateLabel={pick(stepTitles[id], locale)}
                    />
                  ))}
                </Stepper>

                <p
                  className="text-center text-body font-medium text-foreground md:hidden"
                  aria-live="polite"
                >
                  {pick(stepTitles[step], locale)}
                </p>
              </div>
            </div>
          </nav>

          {/* --------------------------------------------------------- body */}
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto bg-muted">
            <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-8 p-6 md:max-w-6xl md:grid-cols-12 md:items-start md:gap-12 md:p-8 lg:p-12">
              <section className="flex min-w-0 flex-col gap-6 md:col-span-7 lg:col-span-8">
                <DialogTitle className="max-w-3xl text-title font-semibold text-pretty text-foreground md:text-title-l">
                  {pick(stepHeadings[step], locale)}
                </DialogTitle>

                {step === "papers" && <PapersStep {...stepProps} />}
                {step === "choices" && <ChoicesStep {...stepProps} />}
                {step === "date" && <DateStep {...stepProps} />}
                {step === "help" && <HelpStep {...stepProps} />}
                {step === "join" && (
                  <JoinStep {...stepProps} onFinish={handleClose} />
                )}
              </section>

              <aside className="flex min-w-0 flex-col gap-6 md:sticky md:top-0 md:col-span-5 md:self-start lg:col-span-4">
                <div className="min-w-0">
                  <VideoSlot step={step} locale={locale} />
                </div>
                <div className="min-w-0">
                  <HelpPanel step={step} locale={locale} />
                </div>
              </aside>
            </div>
          </div>

          {/* ------------------------------------------------------- footer */}
          {/* The rule runs the full width; the buttons keep to the content's own column,
              so Back and Proceed line up with the page above them (owner, 2026-10-14). */}
          <footer className="shrink-0 border-t border-hairline bg-muted">
            <div className="mx-auto flex w-full max-w-3xl flex-col-reverse gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:max-w-6xl md:px-8 lg:px-12">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              data-icon="inline-start"
            >
              <ArrowLeftIcon aria-hidden />
              {pick(ui.back, locale)}
            </Button>

            {isLast ? (
              <Button
                className="w-full sm:hidden"
                onClick={handleClose}
                data-icon="inline-end"
              >
                {pick(join.cta, locale)}
                <ArrowRightIcon aria-hidden />
              </Button>
            ) : (
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  setIndex((i) => Math.min(STEP_ORDER.length - 1, i + 1))
                }
                data-icon="inline-end"
              >
                {pick(ui.proceed, locale)}
                <ArrowRightIcon aria-hidden />
              </Button>
            )}
            </div>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
