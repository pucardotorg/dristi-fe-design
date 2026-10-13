"use client";

import * as React from "react";
import { Hourglass } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { advHome, fillCopy } from "@/lib/advocate/content";
import type { HearingQueue } from "@/lib/advocate/home";

/** The tag's own words, read out and shown on hover: "3 hearings before yours…". */
export function queueSentence(queue: HearingQueue, locale: Locale): string {
  if (queue.ahead === 0) return pick(advHome.queueIsNext, locale);
  if (queue.ahead === 1) return pick(advHome.queueAheadOne, locale);
  return fillCopy(advHome.queueAheadMany, locale, { n: String(queue.ahead) });
}

/** The tag's face: hourglass and count, or "Next" a step darker (never teal:
 * teal is the action colour). Shared by the live tag and the phone card's
 * width placeholder. */
export const QUEUE_TAG =
  "inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md border border-hairline px-2 text-caption font-semibold tabular-nums";
export function queueTone(queue: HearingQueue): string {
  return queue.ahead === 0
    ? "bg-accent-strong text-foreground"
    : "bg-surface-sunken text-muted-foreground";
}
export function QueueFace({ queue, locale }: { queue: HearingQueue; locale: Locale }) {
  return (
    <>
      <Hourglass aria-hidden="true" className="size-3.5" />
      <span aria-hidden="true">{queue.ahead === 0 ? pick(advHome.queueNext, locale) : queue.ahead}</span>
    </>
  );
}

/**
 * How many matters are still to be called before this one in its court today,
 * as a tag in the row's action column, styled like the access tag: a soft
 * fill, no outline, so it reads as information, not an action. It is a button
 * so touch can reach the sentence: a tap (or click) opens it in a small popup,
 * and a mouse also gets it on hover.
 */
export function QueueTag({
  queue,
  locale,
  className,
}: {
  queue: HearingQueue;
  locale: Locale;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const sentence = queueSentence(queue, locale);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={sentence}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                QUEUE_TAG,
                queueTone(queue),
                "relative z-10 transition-colors hover:bg-accent-strong data-[state=open]:bg-accent-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                className
              )}
            >
              <QueueFace queue={queue} locale={locale} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        {open ? null : <TooltipContent side="top">{sentence}</TooltipContent>}
      </Tooltip>
      <PopoverContent
        align="end"
        collisionPadding={16}
        onClick={(event) => event.stopPropagation()}
        className="w-auto max-w-64 p-3 text-body-compact"
      >
        {sentence}
      </PopoverContent>
    </Popover>
  );
}
