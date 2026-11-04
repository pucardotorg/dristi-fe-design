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
              status={m.status}
              aria-current={m.status === "current" ? "step" : undefined}
              onActivate={open ? () => router.push(open) : undefined}
              activateLabel={m.note ? `${s.title}, ${m.note}` : s.title}
            >
              {m.note ? (
                <span
                  className={cn(
                    "block text-body-compact tabular-nums",
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

/** The pinned second row: a step's stages, with the one on screen raised. */
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
  return (
    <PinnedRow className={className}>
      <nav aria-label={`Stages of ${title}`} className="flex items-center gap-3 overflow-x-auto py-2">
        <span className="shrink-0 text-body-compact font-medium text-muted-foreground">
          Step {n + 1} · {title}
        </span>
        <ol className="flex items-center gap-1">
          {stages.map((s, i) => {
            const here = s.id === current;
            const mark = s.done && !here ? (
              <CircleCheckIcon className="size-4 text-success-ink" aria-hidden />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "size-2.5 shrink-0 rounded-full border",
                  here ? "border-primary bg-primary" : "border-input",
                )}
              />
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
                    ›
                  </li>
                ) : null}
                <li className="shrink-0">
                  {s.href && !here ? (
                    <Link href={s.href} className={cls}>
                      {mark}
                      {s.title}
                      {s.done ? <span className="sr-only">, done</span> : null}
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
    </PinnedRow>
  );
}

/** A strip pinned under the top bar, across the content column. */
export function PinnedRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("sticky z-20 border-y border-hairline bg-surface-sunken px-6 lg:px-12", className)}
      style={{ top: TOP_BAR_HEIGHT }}
    >
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}
