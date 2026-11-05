"use client";

/**
 * **Where a bulk filing is, at two levels, the same way on every screen of it** (v8).
 *
 * One pinned block under the top bar. The first row is the batch's six steps, inline: a
 * small numbered dot, the step's name beside it, and what is left there as a count. The
 * second row, when there is one, is where you are inside the current step: its stages
 * ("Step 2 · Cases: Choose a format › Upload › Check"), or the case you have open. It sits
 * on the sunken surface under a hairline, so it reads as part of the step above, and the
 * stage on screen is the raised white one (owner's v8 prototype; PM review of v7: inside
 * Cases the stages were invisible).
 *
 * Both rows stay pinned, because they are what a filer who looks away and back needs. At
 * one line each the block is about 120px, where the DS stepper's circle-over-label rows
 * took 170px (round-2 audit).
 */

import * as React from "react";
import Link from "next/link";
import { CheckIcon, ChevronRightIcon, CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { TOP_BAR_HEIGHT } from "@/components/filing/chrome";
import { Badge } from "@/components/ui/badge";

export type BulkStepId = "common" | "cases" | "details" | "documents" | "sign" | "pay";

/** The batch's steps, in the order the owner set for v8: details are fixed before documents. */
export const BULK_STEPS: { id: BulkStepId; title: string }[] = [
  { id: "common", title: "Common details" },
  { id: "cases", title: "Cases" },
  { id: "details", title: "Case details" },
  { id: "documents", title: "Documents" },
  { id: "sign", title: "Review and sign" },
  { id: "pay", title: "Pay" },
];

export type StepMark = {
  status: "complete" | "current" | "upcoming";
  /** Where the step opens. Without one, the step can't be opened yet. */
  href?: string;
  /** Work waiting there, in words ("3 to fix"); `ready` for work that can simply go ahead. */
  note?: string;
  tone?: "attention" | "ready";
};

export type Stage = {
  id: string;
  title: string;
  href?: string;
  done?: boolean;
  /** Something in it still needs the filer. */
  warn?: boolean;
};

/** The column the steps line up with: the page's own content width. */
export type BulkWidth = "narrow" | "medium" | "wide" | "full";
export const BULK_COLUMN: Record<BulkWidth, string> = {
  narrow: "mx-auto w-full max-w-4xl",
  medium: "mx-auto w-full max-w-5xl",
  wide: "mx-auto w-full max-w-6xl",
  full: "w-full",
};

/**
 * The pinned block: the six steps, and under them the current step's second row
 * (`<StageRow>` or the open case's strip).
 */
export function BulkSteps({
  marks,
  second,
  width = "narrow",
  gutter = "px-6 lg:px-12",
  className,
}: {
  marks: Record<BulkStepId, StepMark>;
  second?: React.ReactNode;
  width?: BulkWidth;
  /** The page's own side padding, so the rows line up with the content under them. */
  gutter?: string;
  className?: string;
}) {
  const column = BULK_COLUMN[width];
  return (
    <div
      className={cn("sticky z-20 border-b border-hairline bg-card", className)}
      style={{ top: TOP_BAR_HEIGHT }}
    >
      <nav aria-label="Batch steps" className={gutter}>
        <ol className={cn(column, "flex items-center gap-1 overflow-x-auto py-3")}>
          {BULK_STEPS.map((s, i) => {
            const m = marks[s.id];
            const current = m.status === "current";
            const done = m.status === "complete";
            const dot = (
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold tabular-nums",
                  current
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-success-muted text-success-muted-foreground"
                      : "border border-input text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
            );
            const count =
              m.note && !current ? (
                <Badge variant={m.tone === "ready" ? "secondary" : "warning"} className="tabular-nums">
                  {m.note}
                </Badge>
              ) : null;
            // Six names don't fit a phone: there only the current one keeps its words.
            const label = <span className={current ? undefined : "max-sm:sr-only"}>{s.title}</span>;
            const cls = cn(
              "inline-flex h-10 items-center gap-2 rounded-lg text-body-compact whitespace-nowrap transition-colors",
              i ? "px-2" : "pr-2",
            );
            return (
              <React.Fragment key={s.id}>
                {i ? <li aria-hidden className="h-px max-w-6 min-w-4 flex-1 bg-border" /> : null}
                <li className="shrink-0">
                  {m.href && !current ? (
                    <Link
                      href={m.href}
                      className={cn(cls, "text-foreground hover:bg-accent")}
                      aria-label={m.note ? `${s.title}, ${m.note}` : undefined}
                    >
                      {dot}
                      {label}
                      {count}
                    </Link>
                  ) : (
                    <span
                      className={cn(cls, current ? "font-semibold text-foreground" : "text-muted-foreground")}
                      aria-current={current ? "step" : undefined}
                    >
                      {dot}
                      {label}
                      {count}
                    </span>
                  )}
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      </nav>
      {second ? (
        <div className={cn("border-t border-hairline bg-surface-sunken", gutter)}>
          <div className={column}>{second}</div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The stages of the current step, as places you can see and go back to: done ones ticked,
 * the one on screen raised, the rest numbered and still to come.
 */
export function StageRow({
  label,
  stages,
  current,
}: {
  label: string;
  stages: Stage[];
  current: string;
}) {
  const at = stages.findIndex((s) => s.id === current);
  return (
    <nav aria-label={label} className="flex items-center gap-3 overflow-x-auto py-2">
      <span className="shrink-0 text-caption font-medium text-muted-foreground">{label}</span>
      <ol className="flex items-center gap-1">
        {stages.map((s, i) => {
          const here = i === at;
          const done = !here && (s.done ?? i < at);
          const mark = s.warn ? (
            <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-warning-ink" />
          ) : done ? (
            <CircleCheckIcon aria-hidden className="size-4 shrink-0 text-success" />
          ) : (
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-caption tabular-nums",
                here ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
            >
              {i + 1}
            </span>
          );
          const cls = cn(
            "inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-body-compact whitespace-nowrap transition-colors",
            here
              ? "bg-card font-semibold text-foreground shadow-raised"
              : s.href
                ? "text-foreground hover:bg-accent"
                : "text-muted-foreground",
          );
          return (
            <React.Fragment key={s.id}>
              {i ? (
                <li aria-hidden className="text-muted-foreground">
                  <ChevronRightIcon className="size-3.5" />
                </li>
              ) : null}
              <li className="shrink-0">
                {s.href && !here ? (
                  <Link href={s.href} className={cls}>
                    {mark}
                    {s.title}
                    {done ? <span className="sr-only">, done</span> : null}
                  </Link>
                ) : (
                  <span className={cls} aria-current={here ? "step" : undefined}>
                    {mark}
                    {s.title}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
