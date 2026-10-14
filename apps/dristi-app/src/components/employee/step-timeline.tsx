import type * as React from "react";

import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { cn } from "@/lib/utils";

/**
 * A dated chain of steps, grouped by phase — the court side's one timeline treatment.
 *
 * It was built for the waiting complaint's file (`register-case-screen.tsx`) and the
 * cause list's case overview now reads the same way (owner, 2026-09-12), so it lives
 * here rather than in either of them. Both screens show the same thing — what happened
 * to this cheque, and what the court has done since — and two copies of that treatment
 * would drift the way sixteen copies of the table row did before `check:table-rows`
 * existed. Nothing here knows which screen it is on.
 *
 * **The measures are gone, and that is the design** (owner, 2026-09-12: *"I'm not
 * understanding what the 84 days means. Like was it 84 days ago?… we just show the
 * timeline directly"*). A span stated as a number of days is a figure the reader has to
 * re-anchor to two events before it means anything. The dates are the anchor, so the
 * dates are what a step shows; the note column is for what a step *means* — the
 * statutory window it closes — and never for restating the arithmetic.
 *
 * The container it sits in must carry `@container`: the three-column split is a
 * container query, so the same group reads correctly in a page panel and in a dialog
 * sheet without either of them knowing the other's width.
 */

/** One column of dated steps, under the phase it belongs to. */
export function StepGroup({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h3 className="text-body-compact font-semibold text-muted-foreground">
        {heading}
      </h3>
      <Timeline className="text-body-compact">{children}</Timeline>
    </div>
  );
}

/**
 * One step: its name, and its date against the far edge where dates line up. Composed as
 * the item's children because the DS item's own title slot takes a string, and a step's
 * date is a `<time>`.
 *
 * **The spacing between steps lives inside the step, not under it.** The DS item spaces
 * itself with `pb-6` on the `li`, and its rail stretches only to the item's content box —
 * so on the render the line stopped at every step and the gap between them was blank.
 * Moving the spacing into the content makes the rail run through it to the next dot.
 * Upstream DS feedback: the rail should span the item's padding (brief §0.5).
 */
export function Step({
  status = "past",
  label,
  date,
  note,
  aside,
  tone,
  href,
}: {
  status?: "past" | "current" | "future";
  label: string;
  date: React.ReactNode;
  /** What the step means for the decision — a statutory limit, or the wait so far. */
  note?: string;
  /** A second fact about the same step, always quiet — "condonation sought". */
  aside?: string;
  tone?: "warning";
  /** The thing the step is about — an order, a process, an application — in a new tab,
   *  so the screen the bench is on stays where it was. */
  href?: string;
}) {
  return (
    <TimelineItem status={status} className="pb-0">
      {/* Three columns once the panel is wide: the step, what it means, and the day it
          closed. The date column is fixed, so every date in the chain shares one edge
          and one right margin however long the step's name runs. Narrow, the note drops
          to a line of its own under the step and the date keeps the far corner. */}
      <div className="pb-4 group-last/timeline-item:pb-0">
        <div className="-mx-3 -my-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 rounded-lg px-3 py-2 transition-colors hover:bg-surface-sunken @xl:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_6.5rem]">
          {/* Regular weight: the group's heading is the one semibold line in the column,
              and the date's muted ink is what separates it from the step's name. */}
          <span className="col-start-1 row-start-1 min-w-0">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener"
                className="rounded-sm text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              label
            )}
          </span>
          <span className="col-start-2 row-start-1 shrink-0 text-right tabular-nums text-muted-foreground @xl:col-start-3">
            {date}
          </span>
          {note ? (
            <span
              className={cn(
                "col-span-2 col-start-1 row-start-2 min-w-0 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1",
                tone === "warning"
                  ? "text-warning-ink"
                  : "text-muted-foreground",
              )}
            >
              {note}
              {aside ? (
                <span
                  className={cn(
                    "block",
                    tone === "warning" && "text-muted-foreground",
                  )}
                >
                  {aside}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
    </TimelineItem>
  );
}
