"use client";

/**
 * **Where a bulk filing is, at two levels, the same way on every screen of it.**
 *
 * The first level is the batch's six steps, from the complainants to payment, as the DS
 * stepper: the upload, the batch and an open case all show the same row, so the filer
 * never learns two maps. The second is where they are inside the current step: its
 * stages (Complainant · Advocate · Documents, or Excel file · Match columns · Check), or
 * the case they have open. That row stays pinned under the top bar, because it is the one
 * a filer who looks away and back needs (PM review of v7, 2026-11-03: inside Cases the
 * stages were invisible, and after a glance away he had no idea where he was).
 *
 * The step row scrolls with the page; pinning both would take a sixth of a laptop screen.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { TOP_BAR_HEIGHT } from "@/components/filing/chrome";
import { Stepper, StepperItem } from "@/components/ui/stepper";

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
  /** Work waiting there, in words ("19 to fix"); `ready` for work that can simply go ahead. */
  note?: string;
  tone?: "attention" | "ready";
};

export type Stage = {
  id: string;
  title: string;
  href?: string;
  done?: boolean;
};

/** The six steps, with the current one marked and the reachable ones opening. */
export function BulkStepRow({
  marks,
  className,
}: {
  marks: Record<BulkStepId, StepMark>;
  className?: string;
}) {
  const router = useRouter();
  return (
    <nav aria-label="Batch steps" className={cn("bg-card px-6 pt-4 pb-3 lg:px-12", className)}>
      <Stepper className="max-w-4xl">
        {BULK_STEPS.map((s, i) => {
          const m = marks[s.id];
          const open = m.href && m.status !== "current" ? m.href : null;
          return (
            <StepperItem
              key={s.id}
              step={i + 1}
              title={s.title}
              // Six titles don't fit a phone: there only the current step keeps its words,
              // the rest stay for screen readers.
              className={m.status === "current" ? undefined : "max-sm:[&>div:last-child]:sr-only"}
              status={m.status}
              aria-current={m.status === "current" ? "step" : undefined}
              onActivate={open ? () => router.push(open) : undefined}
              activateLabel={m.note ? `${s.title}, ${m.note}` : s.title}
            >
              {m.note ? (
                <span
                  className={cn(
                    "block text-body-compact tabular-nums max-sm:sr-only",
                    m.tone === "ready" ? "text-muted-foreground" : "text-warning-ink",
                  )}
                >
                  {m.note}
                </span>
              ) : null}
            </StepperItem>
          );
        })}
      </Stepper>
    </nav>
  );
}

/**
 * The pinned second row: the current step's stages, as a child of that step. It is a tray
 * in the current step's own tint (the DS stepper draws the current circle in brand-muted),
 * with a pointer up to that circle, so it reads as "inside step 2" rather than as a second
 * bar. Inside, the stages are a small stepper of their own: done in primary, the one on
 * screen raised, the rest still to come.
 */
export function BulkStageRow({
  step,
  stages,
  current,
  className,
}: {
  step: BulkStepId;
  stages: Stage[];
  current: string;
  className?: string;
}) {
  const n = BULK_STEPS.findIndex((s) => s.id === step);
  const title = BULK_STEPS[n].title;
  const at = stages.findIndex((s) => s.id === current);
  return (
    <div
      className={cn("sticky z-20 border-b border-hairline bg-card px-6 pb-3 lg:px-12", className)}
      style={{ top: TOP_BAR_HEIGHT }}
    >
      {/* The stepper's own width, so the pointer lands under the current circle. */}
      <div className="relative w-full max-w-4xl">
        <span
          aria-hidden
          className="absolute -top-1.5 size-3 rotate-45 rounded-xs bg-brand-muted"
          style={{ left: `calc(${((n + 0.5) / BULK_STEPS.length) * 100}% - 0.375rem)` }}
        />
        <nav
          aria-label={`Stages of step ${n + 1}, ${title}`}
          className="relative flex items-center gap-3 overflow-x-auto rounded-lg bg-brand-muted px-2 py-1.5 text-brand-muted-foreground"
        >
          <span className="shrink-0 pl-1 text-body-compact font-semibold">
            <span className="sr-only">Step </span>
            {n + 1}. {title}
          </span>
          <span aria-hidden className="h-5 w-px shrink-0 bg-primary/25" />
          <ol className="flex items-center">
            {stages.map((s, i) => {
              const here = i === at;
              const done = s.done && !here;
              const mark = done ? (
                <CircleCheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-full border-2",
                    here ? "border-primary bg-primary" : "border-primary/40",
                  )}
                />
              );
              const cls = cn(
                "inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-body-compact whitespace-nowrap transition-colors",
                here
                  ? "bg-card font-semibold text-foreground shadow-raised"
                  : s.href
                    ? "hover:bg-brand-muted-hover"
                    : "",
              );
              return (
                <React.Fragment key={s.id}>
                  {i ? (
                    <li
                      aria-hidden
                      className={cn("h-px w-4 shrink-0", i <= at ? "bg-primary" : "bg-primary/25")}
                    />
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
      </div>
    </div>
  );
}
