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
  /** `fix` blocks filing (red, as everywhere in the flow); `ready` can go ahead; else a check. */
  tone?: "fix" | "attention" | "ready";
};

export type Stage = {
  id: string;
  title: string;
  href?: string;
  done?: boolean;
  /** Something in it still needs the filer. */
  warn?: boolean;
};

/**
 * The column the steps sit in: one centred width on every screen of a batch, whatever the
 * page under it does. Round 3: the row took each page's width, so it slid between four left
 * edges from step to step, and on a narrow page it scrolled the current step out of sight.
 */
export const STEPS_COLUMN = "mx-auto w-full max-w-5xl";

/**
 * The page columns under the steps. One column for the whole flow (owner, 2026-11-11): with
 * a form column and a list column, the steps, the stages and the title sat on three left
 * edges and the title jumped between pages. Every screen now shares the steps' column, so
 * all three start on one line. The two names stay for the screens that choose one.
 */
export type BulkWidth = "medium" | "wide";
export const BULK_COLUMN: Record<BulkWidth, string> = {
  medium: STEPS_COLUMN,
  wide: STEPS_COLUMN,
};

/**
 * How much of the row has to give way to fit: 0 shows everything; 1 drops the names of the
 * steps you are not on (the dot and the count stay); 2 drops their counts too; 3 closes up
 * the rules between the dots, which only a phone needs. The step you are on always keeps
 * its name, and nothing scrolls or clips.
 */
function useFit(key: string) {
  const ref = React.useRef<HTMLOListElement>(null);
  const [level, setLevel] = React.useState(0);
  // The row's full width at each level, measured when it was last shown at that level.
  const widths = React.useRef<number[]>([]);
  // New counts can change the row's width: measure again from the full row.
  const [measured, setMeasured] = React.useState(key);
  if (measured !== key) {
    setMeasured(key);
    setLevel(0);
  }
  React.useLayoutEffect(() => {
    widths.current = [];
  }, [key]);
  React.useLayoutEffect(() => {
    const ol = ref.current;
    if (!ol) return;
    const check = () => {
      widths.current[level] = ol.scrollWidth;
      if (ol.scrollWidth > ol.clientWidth + 1 && level < 3) setLevel(level + 1);
      else if (level > 0 && ol.clientWidth >= (widths.current[level - 1] ?? Infinity)) setLevel(level - 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(ol);
    return () => ro.disconnect();
  }, [level, key]);
  return { ref, level };
}

/**
 * The pinned block: the six steps, and under them the current step's second row
 * (`<StageRow>` or the open case's strip), both in the one steps column.
 */
export function BulkSteps({
  marks,
  second,
  secondColumn = STEPS_COLUMN,
  gutter = "px-6 lg:px-12",
  className,
}: {
  marks: Record<BulkStepId, StepMark>;
  second?: React.ReactNode;
  /**
   * The column the second row sits in: the page's own (`BULK_COLUMN[width]`, or the form
   * column), so the current step's stages start on the page title's left edge rather than
   * floating in the wider steps column (owner, 2026-11-11).
   */
  secondColumn?: string;
  /** The page's own side padding, so the rows line up with the content under them. */
  gutter?: string;
  className?: string;
}) {
  const { ref, level } = useFit(JSON.stringify(marks));
  return (
    <div
      className={cn("sticky z-20 border-b border-hairline bg-card", className)}
      style={{ top: TOP_BAR_HEIGHT }}
    >
      <nav aria-label="Batch steps" className={gutter}>
        <ol ref={ref} className={cn(STEPS_COLUMN, "flex items-center gap-1 overflow-hidden py-3")}>
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
            // Past level 1 the count is left to the link's label: a badge can't be hidden
            // with `sr-only`, whose 1px loses to the badge's own width.
            const count =
              m.note && !current && level < 2 ? (
                <Badge
                  variant={m.tone === "ready" ? "secondary" : m.tone === "fix" ? "destructive" : "warning"}
                  className="text-body-compact tabular-nums"
                >
                  {m.note}
                </Badge>
              ) : null;
            const label = <span className={current || level === 0 ? undefined : "sr-only"}>{s.title}</span>;
            const cls = cn(
              "inline-flex h-10 items-center gap-2 rounded-lg text-body-compact whitespace-nowrap transition-colors",
              i ? (level > 2 ? "px-1" : "px-2") : "pr-2",
            );
            return (
              <React.Fragment key={s.id}>
                {i ? <li aria-hidden className={cn("h-px max-w-6 min-w-2 flex-1 bg-border", level > 2 && "hidden")} /> : null}
                <li className="shrink-0">
                  {m.href && !current ? (
                    <Link
                      href={m.href}
                      className={cn(cls, "text-foreground hover:bg-accent")}
                      aria-label={m.note ? `${s.title}, ${m.note}` : undefined}
                      title={level ? s.title : undefined}
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
          <div className={secondColumn}>{second}</div>
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
    // The label names the row for assistive tech only: on screen it repeated the step the
    // row above already shows as current. The current stage's raised pill starts on the page
    // column's edge, not outset past it (owner, 2026-11-11).
    <nav aria-label={label} className="py-2">
      <ol className="flex flex-wrap items-center gap-1">
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
                // The steps above own solid navy for "you are here"; a stage's current disc
                // is the brand tint, so the two levels never share a marker (owner, 2026-11-11).
                here ? "border-brand-muted bg-brand-muted text-brand-muted-foreground" : "border-input",
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
